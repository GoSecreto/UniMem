#!/usr/bin/env node
/**
 * UniMem Gemini CLI Hook
 *
 * Receives hook events from Gemini CLI via stdin (JSON).
 * Communicates with UniMem via the HTTP Worker API.
 *
 * Hook types: session-start, before-agent, after-tool
 */
import http from 'http';
import path from 'path';
import { deriveProjectName } from '../utils/project-name.js';
import { HTTP_PORT } from '../shared/constants.js';

const hookType = process.argv[2];

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
    // Timeout after 2 seconds if no stdin
    setTimeout(() => resolve({}), 2000);
  });
}

async function main() {
  const payload = await readStdin();
  const cwd = payload.cwd || process.cwd();
  const project = deriveProjectName(cwd);
  const sessionId = payload.session_id || `gemini-${Date.now().toString(36)}`;

  if (hookType === 'session-start') {
    await postToWorker('/api/hooks/session-start', {
      session_id: sessionId,
      project,
      cli_tool: 'gemini',
      prompt: payload.prompt,
    });
    // Auto-detect: check for context from other CLIs
    await postToWorker('/api/hooks/auto-detect', {
      session_id: sessionId,
      project,
      cli_tool: 'gemini',
      cwd,
    });
  } else if (hookType === 'session-end') {
    // AUTO-SAVE: Create handoff snapshot on every session exit
    await postToWorker('/api/hooks/session-end-autosave', {
      session_id: sessionId,
      project,
      cli_tool: 'gemini',
      exit_reason: payload.reason || 'unknown',
    });
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

main().catch(err => {
  console.error('UniMem Gemini hook error:', err.message);
  // Don't exit with error code - hooks should fail silently to not block the CLI
  process.exit(0);
});
