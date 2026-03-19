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

    // Apply initial schema if not yet applied
    const initialApplied = this.db.prepare(
      'SELECT name FROM _migrations WHERE name = ?'
    ).get('001-initial');

    if (!initialApplied) {
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

    // Scan migrations directory for numbered migrations (002-*.sql, 003-*.sql, etc.)
    this.runNumberedMigrations();
  }

  private runNumberedMigrations(): void {
    const migrationsDir = path.join(__dirname, 'migrations');
    if (!fs.existsSync(migrationsDir)) return;

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql') && /^\d{3}-/.test(f))
      .sort();

    for (const file of files) {
      const name = file.replace('.sql', '');
      const applied = this.db.prepare(
        'SELECT name FROM _migrations WHERE name = ?'
      ).get(name);

      if (!applied) {
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        this.db.exec(sql);
        this.db.prepare(
          'INSERT INTO _migrations (name, applied_at) VALUES (?, ?)'
        ).run(name, new Date().toISOString());
        logger.info(`Applied migration: ${name}`);
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
