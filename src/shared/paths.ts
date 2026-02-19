import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const UNIMEM_HOME = path.join(process.env.HOME || process.env.USERPROFILE || '', '.unimem');
export const DB_PATH = path.join(UNIMEM_HOME, 'unimem.db');
export const SETTINGS_PATH = path.join(UNIMEM_HOME, 'settings.json');
export const LOG_PATH = path.join(UNIMEM_HOME, 'unimem.log');
export const PROJECT_ROOT = path.resolve(__dirname, '../../');
export const SCHEMA_PATH = path.join(__dirname, '../storage/schema.sql');

export function ensureUnimemHome(): void {
  if (!fs.existsSync(UNIMEM_HOME)) {
    fs.mkdirSync(UNIMEM_HOME, { recursive: true });
  }
}
