import { IMemoryProvider } from '../interfaces/IMemoryProvider.js';
import { Session, Observation, SessionSummary, Handoff, UserPrompt } from '../types/index.js';
import { DatabaseManager } from '../storage/DatabaseManager.js';
import { sanitizeFtsQuery } from '../utils/fts-sanitize.js';
import { logger } from '../shared/logger.js';

export class SQLiteProvider implements IMemoryProvider {
  private dbManager: DatabaseManager;

  constructor(dbPath?: string) {
    this.dbManager = DatabaseManager.getInstance(dbPath);
  }

  private get db() {
    return this.dbManager.getDb();
  }

  async initialize(): Promise<void> {
    // DatabaseManager handles initialization
  }

  async close(): Promise<void> {
    this.dbManager.close();
  }

  // ── Session Management ──

  async createSession(session: Session): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO sessions (
        session_id, project, cli_tool, cli_version, status,
        pause_reason, parent_session_id, user_prompt,
        created_at, created_at_epoch
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      session.session_id, session.project, session.cli_tool,
      session.cli_version || null, session.status,
      session.pause_reason || null, session.parent_session_id || null,
      session.user_prompt || null, session.created_at, session.created_at_epoch
    );
  }

  async getSession(sessionId: string): Promise<Session | undefined> {
    return this.db.prepare('SELECT * FROM sessions WHERE session_id = ?')
      .get(sessionId) as Session | undefined;
  }

  async getProjectSessions(project: string): Promise<Session[]> {
    return this.db.prepare(
      'SELECT * FROM sessions WHERE project = ? ORDER BY created_at_epoch DESC'
    ).all(project) as Session[];
  }

  async getRecentSessions(project: string, limit: number = 5): Promise<Session[]> {
    return this.db.prepare(
      'SELECT * FROM sessions WHERE project = ? ORDER BY created_at_epoch DESC LIMIT ?'
    ).all(project, limit) as Session[];
  }

  async getLastActiveSession(project: string): Promise<Session | undefined> {
    return this.db.prepare(
      'SELECT * FROM sessions WHERE project = ? ORDER BY created_at_epoch DESC LIMIT 1'
    ).get(project) as Session | undefined;
  }

  async updateSessionStatus(sessionId: string, status: Session['status'], reason?: string): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const completedAt = (status === 'completed') ? now : null;
    this.db.prepare(`
      UPDATE sessions
      SET status = ?, pause_reason = ?, updated_at_epoch = ?, completed_at_epoch = COALESCE(?, completed_at_epoch)
      WHERE session_id = ?
    `).run(status, reason || null, now, completedAt, sessionId);
  }

  async getAllProjects(): Promise<string[]> {
    const rows = this.db.prepare(
      'SELECT DISTINCT project FROM sessions UNION SELECT DISTINCT project FROM observations'
    ).all() as { project: string }[];
    return rows.map(r => r.project);
  }

  // ── Observation Management ──

  async saveObservation(obs: Observation): Promise<number> {
    const result = this.db.prepare(`
      INSERT INTO observations (
        session_id, project, cli_tool, type, title, subtitle,
        facts, narrative, concepts, files_read, files_modified,
        prompt_number, discovery_tokens, created_at, created_at_epoch
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      obs.session_id, obs.project, obs.cli_tool, obs.type,
      obs.title || null, obs.subtitle || null,
      JSON.stringify(obs.facts || []),
      obs.narrative || null,
      JSON.stringify(obs.concepts || []),
      JSON.stringify(obs.files_read || []),
      JSON.stringify(obs.files_modified || []),
      obs.prompt_number || null, obs.discovery_tokens || 0,
      obs.created_at, obs.created_at_epoch
    );
    return result.lastInsertRowid as number;
  }

  async getObservationsByProject(project: string, limit: number = 50): Promise<Observation[]> {
    const rows = this.db.prepare(
      'SELECT * FROM observations WHERE project = ? ORDER BY created_at_epoch DESC LIMIT ?'
    ).all(project, limit) as any[];
    return rows.map(this.parseObservationRow);
  }

  async getObservationsBySession(sessionId: string): Promise<Observation[]> {
    const rows = this.db.prepare(
      'SELECT * FROM observations WHERE session_id = ? ORDER BY created_at_epoch DESC'
    ).all(sessionId) as any[];
    return rows.map(this.parseObservationRow);
  }

  async searchObservations(query: string, project?: string, cliTool?: string, limit: number = 20): Promise<Observation[]> {
    const sanitized = sanitizeFtsQuery(query);

    if (!sanitized) {
      // No query - return recent observations
      let sql = 'SELECT * FROM observations';
      const conditions: string[] = [];
      const params: any[] = [];

      if (project) { conditions.push('project = ?'); params.push(project); }
      if (cliTool) { conditions.push('cli_tool = ?'); params.push(cliTool); }
      if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
      sql += ' ORDER BY created_at_epoch DESC LIMIT ?';
      params.push(limit);

      const rows = this.db.prepare(sql).all(...params) as any[];
      return rows.map(this.parseObservationRow);
    }

    // FTS5 search with sanitized query
    let sql = `
      SELECT o.*, rank
      FROM observations o
      JOIN observations_fts f ON o.id = f.rowid
      WHERE observations_fts MATCH ?
    `;
    const params: any[] = [sanitized];

    if (project) { sql += ' AND o.project = ?'; params.push(project); }
    if (cliTool) { sql += ' AND o.cli_tool = ?'; params.push(cliTool); }
    sql += ' ORDER BY rank LIMIT ?';
    params.push(limit);

    try {
      const rows = this.db.prepare(sql).all(...params) as any[];
      return rows.map(this.parseObservationRow);
    } catch (err) {
      logger.warn('FTS5 search failed, falling back to LIKE', { query, error: String(err) });
      // Fallback to LIKE search
      let fallbackSql = 'SELECT * FROM observations WHERE (title LIKE ? OR narrative LIKE ?)';
      const likeParam = `%${query}%`;
      const fallbackParams: any[] = [likeParam, likeParam];
      if (project) { fallbackSql += ' AND project = ?'; fallbackParams.push(project); }
      fallbackSql += ' ORDER BY created_at_epoch DESC LIMIT ?';
      fallbackParams.push(limit);
      const rows = this.db.prepare(fallbackSql).all(...fallbackParams) as any[];
      return rows.map(this.parseObservationRow);
    }
  }

  async getObservationCount(project?: string): Promise<number> {
    if (project) {
      const row = this.db.prepare('SELECT COUNT(*) as count FROM observations WHERE project = ?').get(project) as any;
      return row.count;
    }
    const row = this.db.prepare('SELECT COUNT(*) as count FROM observations').get() as any;
    return row.count;
  }

  async getTimeline(project: string, anchorId?: number, before: number = 5, after: number = 5): Promise<Observation[]> {
    if (anchorId) {
      // Get observations around the anchor
      const anchor = this.db.prepare('SELECT created_at_epoch FROM observations WHERE id = ?').get(anchorId) as any;
      if (!anchor) return [];

      const beforeRows = this.db.prepare(
        'SELECT * FROM observations WHERE project = ? AND created_at_epoch <= ? ORDER BY created_at_epoch DESC LIMIT ?'
      ).all(project, anchor.created_at_epoch, before + 1) as any[];

      const afterRows = this.db.prepare(
        'SELECT * FROM observations WHERE project = ? AND created_at_epoch > ? ORDER BY created_at_epoch ASC LIMIT ?'
      ).all(project, anchor.created_at_epoch, after) as any[];

      const combined = [...beforeRows.reverse(), ...afterRows];
      return combined.map(this.parseObservationRow);
    }

    // No anchor - return most recent
    const rows = this.db.prepare(
      'SELECT * FROM observations WHERE project = ? ORDER BY created_at_epoch DESC LIMIT ?'
    ).all(project, before + after) as any[];
    return rows.reverse().map(this.parseObservationRow);
  }

  // ── Session Summary Management ──

  async saveSummary(summary: SessionSummary): Promise<number> {
    const result = this.db.prepare(`
      INSERT OR REPLACE INTO session_summaries (
        session_id, project, cli_tool, request, investigated,
        learned, completed, next_steps, notes,
        files_read, files_edited, discovery_tokens,
        created_at, created_at_epoch
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      summary.session_id, summary.project, summary.cli_tool,
      summary.request || null, summary.investigated || null,
      summary.learned || null, summary.completed || null,
      summary.next_steps || null, summary.notes || null,
      JSON.stringify(summary.files_read || []),
      JSON.stringify(summary.files_edited || []),
      summary.discovery_tokens || 0,
      summary.created_at, summary.created_at_epoch
    );
    return result.lastInsertRowid as number;
  }

  async getSummary(sessionId: string): Promise<SessionSummary | undefined> {
    const row = this.db.prepare(
      'SELECT * FROM session_summaries WHERE session_id = ?'
    ).get(sessionId) as any;
    if (!row) return undefined;
    return this.parseSummaryRow(row);
  }

  async getRecentSummaries(project: string, limit: number = 5): Promise<SessionSummary[]> {
    const rows = this.db.prepare(
      'SELECT * FROM session_summaries WHERE project = ? ORDER BY created_at_epoch DESC LIMIT ?'
    ).all(project, limit) as any[];
    return rows.map(this.parseSummaryRow);
  }

  // ── User Prompt Management ──

  async saveUserPrompt(prompt: UserPrompt): Promise<number> {
    const result = this.db.prepare(`
      INSERT INTO user_prompts (
        session_id, project, cli_tool, prompt_number, prompt_text, created_at_epoch
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      prompt.session_id, prompt.project, prompt.cli_tool,
      prompt.prompt_number, prompt.prompt_text, prompt.created_at_epoch
    );
    return result.lastInsertRowid as number;
  }

  async getSessionPrompts(sessionId: string): Promise<UserPrompt[]> {
    return this.db.prepare(
      'SELECT * FROM user_prompts WHERE session_id = ? ORDER BY prompt_number ASC'
    ).all(sessionId) as UserPrompt[];
  }

  // ── Handoff Management ──

  async createHandoff(handoff: Handoff): Promise<number> {
    // Also pause the source session
    if (handoff.from_session_id) {
      await this.updateSessionStatus(handoff.from_session_id, 'paused', handoff.reason);
    }

    const result = this.db.prepare(`
      INSERT INTO handoffs (
        project, from_session_id, from_cli, state_snapshot,
        reason, created_at_epoch
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      handoff.project, handoff.from_session_id, handoff.from_cli,
      JSON.stringify(handoff.state_snapshot),
      handoff.reason, handoff.created_at_epoch
    );
    return result.lastInsertRowid as number;
  }

  async getPendingHandoff(project: string): Promise<Handoff | undefined> {
    const row = this.db.prepare(`
      SELECT * FROM handoffs
      WHERE project = ? AND picked_up_at_epoch IS NULL
      ORDER BY created_at_epoch DESC
      LIMIT 1
    `).get(project) as any;
    if (!row) return undefined;
    return { ...row, state_snapshot: JSON.parse(row.state_snapshot) };
  }

  async markHandoffPickedUp(id: number, toSessionId: string, toCli: string): Promise<void> {
    this.db.prepare(`
      UPDATE handoffs
      SET picked_up_at_epoch = ?, to_session_id = ?, to_cli = ?
      WHERE id = ?
    `).run(Math.floor(Date.now() / 1000), toSessionId, toCli, id);
  }

  async getHandoffHistory(project: string, limit: number = 10): Promise<Handoff[]> {
    const rows = this.db.prepare(
      'SELECT * FROM handoffs WHERE project = ? ORDER BY created_at_epoch DESC LIMIT ?'
    ).all(project, limit) as any[];
    return rows.map(row => ({ ...row, state_snapshot: JSON.parse(row.state_snapshot) }));
  }

  // ── Auto-Detection ──

  async detectRecentActivity(project: string, withinMinutes: number = 30): Promise<Session | undefined> {
    const cutoff = Math.floor(Date.now() / 1000) - (withinMinutes * 60);
    return this.db.prepare(`
      SELECT * FROM sessions
      WHERE project = ? AND created_at_epoch > ?
      ORDER BY created_at_epoch DESC LIMIT 1
    `).get(project, cutoff) as Session | undefined;
  }

  // ── Helpers ──

  private parseObservationRow(row: any): Observation {
    return {
      ...row,
      facts: row.facts ? JSON.parse(row.facts) : [],
      concepts: row.concepts ? JSON.parse(row.concepts) : [],
      files_read: row.files_read ? JSON.parse(row.files_read) : [],
      files_modified: row.files_modified ? JSON.parse(row.files_modified) : [],
    };
  }

  private parseSummaryRow(row: any): SessionSummary {
    return {
      ...row,
      files_read: row.files_read ? JSON.parse(row.files_read) : [],
      files_edited: row.files_edited ? JSON.parse(row.files_edited) : [],
    };
  }
}
