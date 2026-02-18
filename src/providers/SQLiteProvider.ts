import { IMemoryProvider } from '../interfaces/IMemoryProvider.js';
import { Session, Observation, Handoff } from '../types/index.js';
import { DatabaseManager } from '../storage/DatabaseManager.js';

export class SQLiteProvider implements IMemoryProvider {
  private db = DatabaseManager.getInstance().getDb();

  async initialize(): Promise<void> {
    // Initialization logic is currently in DatabaseManager
  }

  async close(): Promise<void> {
    this.db.close();
  }

  // Session Management
  async createSession(session: Session): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO sessions (
        session_id, project, cli_tool, cli_version, status, 
        pause_reason, parent_session_id, user_prompt, 
        created_at, created_at_epoch
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      session.session_id,
      session.project,
      session.cli_tool,
      session.cli_version || null,
      session.status,
      session.pause_reason || null,
      session.parent_session_id || null,
      session.user_prompt || null,
      session.created_at,
      session.created_at_epoch
    );
  }

  async getSession(sessionId: string): Promise<Session | undefined> {
    const stmt = this.db.prepare('SELECT * FROM sessions WHERE session_id = ?');
    return stmt.get(sessionId) as Session | undefined;
  }

  async getProjectSessions(project: string): Promise<Session[]> {
    const stmt = this.db.prepare('SELECT * FROM sessions WHERE project = ? ORDER BY created_at_epoch DESC');
    return stmt.all(project) as Session[];
  }

  async updateSessionStatus(sessionId: string, status: Session['status'], reason?: string): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE sessions 
      SET status = ?, pause_reason = ?, updated_at_epoch = ? 
      WHERE session_id = ?
    `);
    stmt.run(status, reason || null, Math.floor(Date.now() / 1000), sessionId);
  }

  async getAllProjects(): Promise<string[]> {
    const stmt = this.db.prepare('SELECT DISTINCT project FROM sessions UNION SELECT DISTINCT project FROM observations');
    const rows = stmt.all() as { project: string }[];
    return rows.map(r => r.project);
  }

  // Observation Management
  async saveObservation(obs: Observation): Promise<number> {
    const stmt = this.db.prepare(`
      INSERT INTO observations (
        session_id, project, cli_tool, type, title, subtitle, 
        facts, narrative, concepts, files_read, files_modified, 
        prompt_number, discovery_tokens, created_at, created_at_epoch
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      obs.session_id,
      obs.project,
      obs.cli_tool,
      obs.type,
      obs.title || null,
      obs.subtitle || null,
      JSON.stringify(obs.facts),
      obs.narrative || null,
      JSON.stringify(obs.concepts),
      JSON.stringify(obs.files_read),
      JSON.stringify(obs.files_modified),
      obs.prompt_number || null,
      obs.discovery_tokens || 0,
      obs.created_at,
      obs.created_at_epoch
    );

    return result.lastInsertRowid as number;
  }

  async getObservationsByProject(project: string): Promise<Observation[]> {
    const stmt = this.db.prepare('SELECT * FROM observations WHERE project = ? ORDER BY created_at_epoch DESC');
    const rows = stmt.all(project) as any[];
    
    return rows.map(row => ({
      ...row,
      facts: row.facts ? JSON.parse(row.facts) : [],
      concepts: row.concepts ? JSON.parse(row.concepts) : [],
      files_read: row.files_read ? JSON.parse(row.files_read) : [],
      files_modified: row.files_modified ? JSON.parse(row.files_modified) : []
    }));
  }

  async searchObservations(query: string, project?: string): Promise<Observation[]> {
    let stmt;
    let params;

    if (!query || query.trim() === '') {
      if (project) {
        stmt = this.db.prepare('SELECT * FROM observations WHERE project = ? ORDER BY created_at_epoch DESC');
        params = [project];
      } else {
        stmt = this.db.prepare('SELECT * FROM observations ORDER BY created_at_epoch DESC');
        params = [];
      }
    } else {
      const sql = `
        SELECT o.*, rank 
        FROM observations o
        JOIN observations_fts f ON o.id = f.rowid
        WHERE observations_fts MATCH ?
        ${project ? 'AND o.project = ?' : ''}
        ORDER BY rank
      `;
      stmt = this.db.prepare(sql);
      params = project ? [query, project] : [query];
    }

    const rows = stmt.all(...params) as any[];
    return rows.map(row => ({
      ...row,
      facts: row.facts ? JSON.parse(row.facts) : [],
      concepts: row.concepts ? JSON.parse(row.concepts) : [],
      files_read: row.files_read ? JSON.parse(row.files_read) : [],
      files_modified: row.files_modified ? JSON.parse(row.files_modified) : []
    })) as Observation[];
  }

  // Handoff Management
  async createHandoff(handoff: Handoff): Promise<number> {
    const stmt = this.db.prepare(`
      INSERT INTO handoffs (
        project, from_session_id, from_cli, state_snapshot, 
        reason, created_at_epoch
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      handoff.project,
      handoff.from_session_id,
      handoff.from_cli,
      JSON.stringify(handoff.state_snapshot),
      handoff.reason,
      handoff.created_at_epoch
    );

    return result.lastInsertRowid as number;
  }

  async getPendingHandoff(project: string): Promise<Handoff | undefined> {
    const stmt = this.db.prepare(`
      SELECT * FROM handoffs 
      WHERE project = ? AND picked_up_at_epoch IS NULL 
      ORDER BY created_at_epoch DESC 
      LIMIT 1
    `);
    const row = stmt.get(project) as any;
    if (!row) return undefined;
    
    return {
      ...row,
      state_snapshot: JSON.parse(row.state_snapshot)
    };
  }

  async markHandoffPickedUp(id: number, toSessionId: string, toCli: string): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE handoffs 
      SET picked_up_at_epoch = ?, to_session_id = ?, to_cli = ? 
      WHERE id = ?
    `);
    stmt.run(Math.floor(Date.now() / 1000), toSessionId, toCli, id);
  }
}
