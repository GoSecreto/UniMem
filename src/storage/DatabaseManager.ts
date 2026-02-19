import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { DB_PATH, ensureUnimemHome } from '../shared/paths.js';
import { logger } from '../shared/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class DatabaseManager {
  private db: Database.Database;
  private static instance: DatabaseManager;

  private constructor(dbPath: string) {
    ensureUnimemHome();

    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);

    // Performance optimizations (same as claude-mem proven config)
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('mmap_size = 268435456');
    this.db.pragma('cache_size = 10000');
    this.db.pragma('temp_store = memory');
    this.db.pragma('foreign_keys = ON');

    this.runMigrations();
  }

  public static getInstance(dbPath?: string): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager(dbPath || DB_PATH);
    }
    return DatabaseManager.instance;
  }

  private runMigrations(): void {
    // Create migrations tracking table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        applied_at TEXT NOT NULL
      )
    `);

    // Check if initial schema has been applied
    const applied = this.db.prepare(
      'SELECT name FROM _migrations WHERE name = ?'
    ).get('001-initial');

    if (!applied) {
      const schemaPath = path.join(__dirname, 'schema.sql');
      if (fs.existsSync(schemaPath)) {
        const schema = fs.readFileSync(schemaPath, 'utf8');
        this.db.exec(schema);
        this.db.prepare(
          'INSERT INTO _migrations (name, applied_at) VALUES (?, ?)'
        ).run('001-initial', new Date().toISOString());
        logger.info('Applied migration: 001-initial');
      } else {
        logger.error('Schema file not found', { path: schemaPath });
      }
    }
  }

  public getDb(): Database.Database {
    return this.db;
  }

  public close(): void {
    this.db.close();
  }

  public transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }
}
