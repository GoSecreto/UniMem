/**
 * Offline Queue
 *
 * When the UniMem worker is unreachable, hook payloads are saved to disk.
 * On the next successful connection, queued payloads are replayed.
 */
import fs from 'fs';
import path from 'path';
import { UNIMEM_HOME } from '../shared/paths.js';

const QUEUE_DIR = path.join(UNIMEM_HOME, 'offline-queue');

export function enqueuePayload(endpoint: string, data: unknown): void {
  try {
    if (!fs.existsSync(QUEUE_DIR)) {
      fs.mkdirSync(QUEUE_DIR, { recursive: true });
    }

    const entry = { endpoint, data, timestamp: Date.now() };
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}.json`;
    fs.writeFileSync(path.join(QUEUE_DIR, filename), JSON.stringify(entry));
  } catch {
    // Non-critical — best effort
  }
}

export function drainQueue(): Array<{ endpoint: string; data: unknown }> {
  try {
    if (!fs.existsSync(QUEUE_DIR)) return [];

    const files = fs.readdirSync(QUEUE_DIR)
      .filter(f => f.endsWith('.json'))
      .sort();

    const entries: Array<{ endpoint: string; data: unknown }> = [];

    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(QUEUE_DIR, file), 'utf8');
        const entry = JSON.parse(raw);
        entries.push({ endpoint: entry.endpoint, data: entry.data });
        // Remove after reading
        fs.unlinkSync(path.join(QUEUE_DIR, file));
      } catch {
        // Skip corrupt files
        try { fs.unlinkSync(path.join(QUEUE_DIR, file)); } catch {}
      }
    }

    return entries;
  } catch {
    return [];
  }
}

export function queueSize(): number {
  try {
    if (!fs.existsSync(QUEUE_DIR)) return 0;
    return fs.readdirSync(QUEUE_DIR).filter(f => f.endsWith('.json')).length;
  } catch {
    return 0;
  }
}
