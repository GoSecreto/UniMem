import { DatabaseManager } from './DatabaseManager.js';
import { Session } from '../types/index.js';

export class SessionStore {
  private db = DatabaseManager.getInstance().getDb();

  public createSession(session: Session): void {
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

  public getSession(sessionId: string): Session | undefined {
    const stmt = this.db.prepare('SELECT * FROM sessions WHERE session_id = ?');
    const row = stmt.get(sessionId) as any;
    return row ? row : undefined;
  }

  public getProjectSessions(project: string): Session[] {
    const stmt = this.db.prepare('SELECT * FROM sessions WHERE project = ? ORDER BY created_at_epoch DESC');
    return stmt.all(project) as Session[];
  }

  public getAllProjects(): string[] {
    const stmt = this.db.prepare('SELECT DISTINCT project FROM sessions UNION SELECT DISTINCT project FROM observations');
    const rows = stmt.all() as { project: string }[];
    return rows.map(r => r.project);
  }

  public updateSessionStatus(sessionId: string, status: Session['status'], reason?: string): void {
    const stmt = this.db.prepare(`
      UPDATE sessions 
      SET status = ?, pause_reason = ?, updated_at_epoch = ? 
      WHERE session_id = ?
    `);
    stmt.run(status, reason || null, Math.floor(Date.now() / 1000), sessionId);
  }
}
