import { DatabaseManager } from './DatabaseManager.js';
import { Observation } from '../types/index.js';

export class ObservationStore {
  private db = DatabaseManager.getInstance().getDb();

  public saveObservation(obs: Observation): number {
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

  public getObservationsByProject(project: string): Observation[] {
    const stmt = this.db.prepare('SELECT * FROM observations WHERE project = ? ORDER BY created_at_epoch DESC');
    const rows = stmt.all(project) as any[];
    
    return rows.map(row => ({
      ...row,
      facts: JSON.parse(row.facts),
      concepts: JSON.parse(row.concepts),
      files_read: JSON.parse(row.files_read),
      files_modified: JSON.parse(row.files_modified)
    }));
  }

  public searchObservations(query: string, project?: string): any[] {
    let stmt;
    let params;

    if (!query || query.trim() === '') {
      // Return all if no query
      if (project) {
        stmt = this.db.prepare('SELECT * FROM observations WHERE project = ? ORDER BY created_at_epoch DESC');
        params = [project];
      } else {
        stmt = this.db.prepare('SELECT * FROM observations ORDER BY created_at_epoch DESC');
        params = [];
      }
    } else {
      // Use FTS5 for search
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
    }));
  }
}
