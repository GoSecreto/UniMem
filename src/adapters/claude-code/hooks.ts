#!/usr/bin/env node
/**
 * UniMem Claude Code Hook
 *
 * Receives hook events from Claude Code via stdin (JSON).
 * Communicates with UniMem via the HTTP Worker API.
 *
 * Hook types: SessionStart, UserPromptSubmit, PostToolUse, Stop, SessionEnd
 */
import http from 'http';
import { ClaudeCodeAdapter } from './adapter.js';
import { deriveProjectName } from '../../utils/project-name.js';
import { HTTP_PORT } from '../../shared/constants.js';

const hookType = process.argv[2] || 'PostToolUse';
const adapter = new ClaudeCodeAdapter();

async function postToWorker(endpoint: string, data: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const req = http.request({
      hostname: 'localhost',
      port: HTTP_PORT,
      path: endpoint,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      res.resume();
      res.on('end', resolve);
    });
    req.on('error', reject);
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
    setTimeout(() => resolve({}), 2000);
  });
}

async function main() {
  const raw = await readStdin();
  const normalized = adapter.normalizeInput(hookType, raw);
  const project = deriveProjectName(normalized.cwd);

  if (normalized.hookType === 'session-start') {
    await postToWorker('/api/hooks/session-start', {
      session_id: normalized.sessionId,
      project,
      cli_tool: 'claude-code',
    });
  } else if (normalized.hookType === 'prompt-submit') {
    await postToWorker('/api/hooks/tool-use', {
      session_id: normalized.sessionId,
      project,
      cli_tool: 'claude-code',
      tool_name: 'UserPrompt',
      summary: `User asked: ${(normalized.prompt || '').substring(0, 200)}`,
    });
  } else if (normalized.hookType === 'tool-use') {
    await postToWorker('/api/hooks/tool-use', {
      session_id: normalized.sessionId,
      project,
      cli_tool: 'claude-code',
      tool_name: normalized.toolName,
      summary: `Used ${normalized.toolName}`,
      files_read: normalized.filesRead,
      files_modified: normalized.filesModified,
    });
  } else if (normalized.hookType === 'session-end') {
    await postToWorker('/api/hooks/session-end', {
      session_id: normalized.sessionId,
      project,
      cli_tool: 'claude-code',
    });
  }

  // Output result for Claude Code to read
  const output = adapter.formatOutput({ success: true });
  process.stdout.write(JSON.stringify(output));
}

main().catch(err => {
  console.error('UniMem Claude hook error:', err.message);
  process.exit(0); // Fail silently
});
