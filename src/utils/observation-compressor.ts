/**
 * Observation Compressor
 *
 * Instead of saving every single tool call as a separate observation,
 * this batches rapid tool calls and compresses them into meaningful groups.
 *
 * Example: 10 "Read file" calls → 1 observation "Explored 10 files in src/services/"
 */

interface PendingObs {
  session_id: string;
  project: string;
  cli_tool: string;
  tool_name: string;
  summary: string;
  files_read: string[];
  files_modified: string[];
  timestamp: number;
}

const sessionBuffers = new Map<string, PendingObs[]>();
const flushTimers = new Map<string, ReturnType<typeof setTimeout>>();

const BATCH_WINDOW_MS = 5000; // 5 seconds — group tools used in rapid succession
const SKIP_TOOLS = new Set(['UserPrompt']); // Always save these individually

type FlushCallback = (obs: {
  session_id: string;
  project: string;
  cli_tool: string;
  type: string;
  title: string;
  narrative: string;
  facts: string[];
  concepts: string[];
  files_read: string[];
  files_modified: string[];
  created_at: string;
  created_at_epoch: number;
}) => Promise<void>;

let _flushCallback: FlushCallback | null = null;

export function setFlushCallback(cb: FlushCallback): void {
  _flushCallback = cb;
}

/**
 * Add a tool-use observation to the buffer.
 * Returns true if it was buffered (caller should NOT save it directly).
 * Returns false if it should be saved immediately (e.g., UserPrompt).
 */
export function bufferObservation(obs: PendingObs): boolean {
  // Always save prompts immediately — they're high signal
  if (SKIP_TOOLS.has(obs.tool_name)) return false;

  const key = obs.session_id;
  if (!sessionBuffers.has(key)) {
    sessionBuffers.set(key, []);
  }
  sessionBuffers.get(key)!.push(obs);

  // Reset the flush timer
  if (flushTimers.has(key)) {
    clearTimeout(flushTimers.get(key)!);
  }

  flushTimers.set(key, setTimeout(() => {
    flushBuffer(key);
  }, BATCH_WINDOW_MS));

  return true;
}

/**
 * Force flush all pending observations for a session.
 * Called on session-end to ensure nothing is lost.
 */
export function flushSessionBuffer(sessionId: string): void {
  if (flushTimers.has(sessionId)) {
    clearTimeout(flushTimers.get(sessionId)!);
    flushTimers.delete(sessionId);
  }
  flushBuffer(sessionId);
}

/**
 * Flush all sessions (e.g., on shutdown).
 */
export function flushAllBuffers(): void {
  for (const key of sessionBuffers.keys()) {
    flushSessionBuffer(key);
  }
}

function flushBuffer(sessionId: string): void {
  const buffer = sessionBuffers.get(sessionId);
  if (!buffer || buffer.length === 0) return;

  sessionBuffers.delete(sessionId);
  flushTimers.delete(sessionId);

  if (!_flushCallback) return;

  // Group by tool category
  const reads = buffer.filter(o => isReadTool(o.tool_name));
  const writes = buffer.filter(o => isWriteTool(o.tool_name));
  const shells = buffer.filter(o => isShellTool(o.tool_name));
  const others = buffer.filter(o => !isReadTool(o.tool_name) && !isWriteTool(o.tool_name) && !isShellTool(o.tool_name));

  const first = buffer[0];
  const now = Math.floor(Date.now() / 1000);

  // Compress reads into one observation
  if (reads.length > 0) {
    const allFiles = [...new Set(reads.flatMap(r => r.files_read))];
    const dirs = summarizePaths(allFiles);
    _flushCallback({
      session_id: first.session_id,
      project: first.project,
      cli_tool: first.cli_tool,
      type: 'discovery',
      title: reads.length === 1
        ? `Read ${allFiles[0] || 'file'}`
        : `Explored ${reads.length} files${dirs ? ` in ${dirs}` : ''}`,
      narrative: allFiles.length <= 5
        ? allFiles.join(', ')
        : `${allFiles.slice(0, 5).join(', ')} and ${allFiles.length - 5} more`,
      facts: [],
      concepts: [...new Set(reads.map(r => r.tool_name))],
      files_read: allFiles,
      files_modified: [],
      created_at: new Date().toISOString(),
      created_at_epoch: now,
    }).catch(() => {});
  }

  // Compress writes into one observation
  if (writes.length > 0) {
    const allFiles = [...new Set(writes.flatMap(w => w.files_modified))];
    _flushCallback({
      session_id: first.session_id,
      project: first.project,
      cli_tool: first.cli_tool,
      type: 'implementation',
      title: writes.length === 1
        ? `Edited ${allFiles[0] || 'file'}`
        : `Modified ${writes.length} files`,
      narrative: allFiles.join(', '),
      facts: [],
      concepts: [...new Set(writes.map(w => w.tool_name))],
      files_read: [],
      files_modified: allFiles,
      created_at: new Date().toISOString(),
      created_at_epoch: now,
    }).catch(() => {});
  }

  // Compress shell commands
  if (shells.length > 0) {
    const summaries = shells.map(s => s.summary).filter(Boolean);
    _flushCallback({
      session_id: first.session_id,
      project: first.project,
      cli_tool: first.cli_tool,
      type: 'discovery',
      title: shells.length === 1
        ? summaries[0] || 'Ran command'
        : `Ran ${shells.length} commands`,
      narrative: summaries.join('; '),
      facts: [],
      concepts: ['Bash'],
      files_read: [],
      files_modified: [],
      created_at: new Date().toISOString(),
      created_at_epoch: now,
    }).catch(() => {});
  }

  // Others go through individually (they're already rare)
  for (const obs of others) {
    _flushCallback({
      session_id: obs.session_id,
      project: obs.project,
      cli_tool: obs.cli_tool,
      type: categorize(obs.tool_name),
      title: obs.tool_name,
      narrative: obs.summary,
      facts: [],
      concepts: [obs.tool_name],
      files_read: obs.files_read,
      files_modified: obs.files_modified,
      created_at: new Date().toISOString(),
      created_at_epoch: now,
    }).catch(() => {});
  }
}

function isReadTool(name: string): boolean {
  return ['Read', 'read_file', 'Glob', 'Grep', 'search', 'list_directory', 'ReadFile', 'ReadFolder'].includes(name);
}

function isWriteTool(name: string): boolean {
  return ['Edit', 'Write', 'replace', 'write_file', 'insert', 'NotebookEdit', 'EditFile', 'WriteFile'].includes(name);
}

function isShellTool(name: string): boolean {
  return ['Bash', 'shell', 'terminal', 'RunCommand'].includes(name);
}

function categorize(name: string): string {
  if (isWriteTool(name)) return 'implementation';
  if (isReadTool(name)) return 'discovery';
  return 'discovery';
}

function summarizePaths(files: string[]): string {
  if (files.length === 0) return '';
  // Find common directory prefix
  const parts = files.map(f => f.split('/'));
  if (parts.length === 1) return '';

  let commonDepth = 0;
  outer:
  for (let i = 0; i < parts[0].length; i++) {
    const segment = parts[0][i];
    for (const p of parts) {
      if (p[i] !== segment) break outer;
    }
    commonDepth = i + 1;
  }

  if (commonDepth > 0) {
    return parts[0].slice(0, commonDepth).join('/');
  }
  return '';
}
