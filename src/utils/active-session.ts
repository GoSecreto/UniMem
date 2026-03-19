/**
 * Active Session File Manager
 *
 * Manages ~/.unimem/active-session.json to track which CLI is currently active.
 * Uses atomic write (tmp + rename) for safety.
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { ACTIVE_SESSION_PATH } from '../shared/paths.js';

export interface ActiveSessionInfo {
  cli_tool: string;
  session_id: string;
  project: string;
  pid: number;
  started_at_epoch: number;
  cwd?: string;
}

/**
 * Atomically write active session info.
 */
export function writeActiveSession(info: ActiveSessionInfo): void {
  try {
    const dir = path.dirname(ACTIVE_SESSION_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const tmpPath = path.join(os.tmpdir(), `unimem-active-${Date.now()}.tmp`);
    fs.writeFileSync(tmpPath, JSON.stringify(info, null, 2));
    fs.renameSync(tmpPath, ACTIVE_SESSION_PATH);
  } catch {
    // Non-critical — don't block the CLI
  }
}

/**
 * Read active session, validating that the PID is still alive.
 * Returns null if file doesn't exist, is invalid, or PID is dead.
 */
export function readActiveSession(): ActiveSessionInfo | null {
  try {
    if (!fs.existsSync(ACTIVE_SESSION_PATH)) return null;

    const raw = fs.readFileSync(ACTIVE_SESSION_PATH, 'utf8');
    const info: ActiveSessionInfo = JSON.parse(raw);

    // Validate PID is still alive
    try {
      process.kill(info.pid, 0);
    } catch {
      // PID is dead — stale file
      clearActiveSession();
      return null;
    }

    return info;
  } catch {
    return null;
  }
}

/**
 * Remove active session file.
 */
export function clearActiveSession(): void {
  try {
    if (fs.existsSync(ACTIVE_SESSION_PATH)) {
      fs.unlinkSync(ACTIVE_SESSION_PATH);
    }
  } catch {
    // Non-critical
  }
}
