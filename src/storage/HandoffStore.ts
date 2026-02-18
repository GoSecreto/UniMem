import { DatabaseManager } from './DatabaseManager.js';
import { Handoff } from '../types/index.js';

export class HandoffStore {
  private db = DatabaseManager.getInstance().getDb();

  public createHandoff(handoff: Handoff): number {
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

  public getPendingHandoff(project: string): Handoff | undefined {
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

  public markHandoffPickedUp(id: number, toSessionId: string, toCli: string): void {
    const stmt = this.db.prepare(`
      UPDATE handoffs 
      SET picked_up_at_epoch = ?, to_session_id = ?, to_cli = ? 
      WHERE id = ?
    `);
    stmt.run(Math.floor(Date.now() / 1000), toSessionId, toCli, id);
  }
}
