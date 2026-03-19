#!/usr/bin/env node
/**
 * UniMem Gemini CLI Hook
 *
 * Receives hook events from Gemini CLI via stdin (JSON).
 * Communicates with UniMem via the HTTP Worker API.
 *
 * Hook types: session-start, session-end, before-agent, after-tool
 *
 * KEY: On session-start, outputs additionalContext to stdout so Gemini CLI
 * injects it directly into the conversation — zero manual handoff.
 */
import http from 'http';
import path from 'path';
import { deriveProjectName } from '../utils/project-name.js';
import { writeActiveSession, clearActiveSession } from '../utils/active-session.js';
import { enqueuePayload, drainQueue } from '../utils/offline-queue.js';
import { HTTP_PORT } from '../shared/constants.js';

const hookType = process.argv[2];
const TIMEOUT_MS = 5000;

interface WorkerResponse {
  success?: boolean;
  context?: string;
}

async function postToWorker(endpoint: string, data: unknown): Promise<WorkerResponse> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const req = http.request({
      hostname: 'localhost',
      port: HTTP_PORT,
      path: endpoint,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: TIMEOUT_MS,
    }, (res) => {
      let responseData = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(responseData));
        } catch {
          resolve({ success: true });
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body);
    req.end();
  });
}

async function readStdin(): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
    process.stdin.on('error', reject);
    // Timeout after 2 seconds if no stdin
    setTimeout(() => resolve({}), 2000);
  });
}

async function main() {
  const payload = await readStdin();
  const cwd = payload.cwd || process.cwd();
  const project = deriveProjectName(cwd);
  const sessionId = payload.session_id || `gemini-${Date.now().toString(36)}`;

  // Replay any queued offline payloads first
  try {
    const queued = drainQueue();
    for (const entry of queued) {
      try { await postToWorker(entry.endpoint, entry.data); } catch {}
    }
  } catch {}

  if (hookType === 'session-start') {
    // Register session
    await postToWorker('/api/hooks/session-start', {
      session_id: sessionId,
      project,
      cli_tool: 'gemini',
      prompt: payload.prompt,
    });

    // Write active session file
    writeActiveSession({
      cli_tool: 'gemini',
      session_id: sessionId,
      project,
      pid: process.ppid || process.pid,
      started_at_epoch: Math.floor(Date.now() / 1000),
      cwd,
    });

    // Auto-detect: check for context from other CLIs
    try {
      const response = await postToWorker('/api/hooks/auto-detect', {
        session_id: sessionId,
        project,
        cli_tool: 'gemini',
        cwd,
      });

      // THE KEY: Output additionalContext for Gemini CLI to inject
      if (response.context) {
        const output = {
          hookSpecificOutput: {
            additionalContext: response.context,
          },
        };
        process.stdout.write(JSON.stringify(output));
        return; // Don't output anything else
      }
    } catch {
      // Worker unreachable — output empty and continue silently
    }

    // No context to inject
    process.stdout.write(JSON.stringify({}));

  } else if (hookType === 'session-end') {
    // AUTO-SAVE: Create handoff snapshot on every session exit
    await postToWorker('/api/hooks/session-end-autosave', {
      session_id: sessionId,
      project,
      cli_tool: 'gemini',
      exit_reason: payload.reason || 'unknown',
      cwd,
    });

    // Clear active session file
    clearActiveSession();

  } else if (hookType === 'before-agent') {
    // Capture user prompt
    if (payload.prompt) {
      await postToWorker('/api/hooks/tool-use', {
        session_id: sessionId,
        project,
        cli_tool: 'gemini',
        tool_name: 'UserPrompt',
        summary: `User asked: ${payload.prompt.substring(0, 200)}`,
      });
    }
  } else if (hookType === 'after-tool') {
    const { tool_name, tool_input, tool_response } = payload;

    // Extract meaningful info based on tool type
    let summary = '';
    let filesRead: string[] = [];
    let filesModified: string[] = [];

    if (tool_name === 'Read' || tool_name === 'read_file') {
      const filePath = tool_input?.file_path || tool_input?.path || '';
      filesRead = filePath ? [filePath] : [];
      summary = `Read file: ${filePath}`;
    } else if (tool_name === 'Edit' || tool_name === 'replace' || tool_name === 'write_file') {
      const filePath = tool_input?.file_path || tool_input?.path || '';
      filesModified = filePath ? [filePath] : [];
      summary = `Edited file: ${filePath}`;
    } else if (tool_name === 'Bash' || tool_name === 'shell') {
      const cmd = tool_input?.command || '';
      summary = `Ran command: ${cmd.substring(0, 100)}`;
    } else if (tool_name === 'Grep' || tool_name === 'search') {
      summary = `Searched for: ${tool_input?.pattern || tool_input?.query || ''}`;
    } else {
      summary = `Used ${tool_name}`;
    }

    await postToWorker('/api/hooks/tool-use', {
      session_id: sessionId,
      project,
      cli_tool: 'gemini',
      tool_name,
      summary,
      files_read: filesRead,
      files_modified: filesModified,
    });
  }
}

main().catch(() => {
  // Worker unreachable — queue the session event for later replay
  try {
    const cwd = process.cwd();
    const project = deriveProjectName(cwd);
    if (hookType === 'session-end') {
      enqueuePayload('/api/hooks/session-end-autosave', {
        session_id: `gemini-${Date.now().toString(36)}`,
        project,
        cli_tool: 'gemini',
        exit_reason: 'offline',
        cwd,
      });
    }
  } catch {}
  // Output empty JSON so Gemini CLI doesn't choke
  process.stdout.write(JSON.stringify({}));
  process.exit(0);
});
