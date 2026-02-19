import type { CliTool } from '../shared/constants.js';

/**
 * Detect which CLI tool is calling UniMem based on environment variables
 * and process context.
 */
export function detectCliTool(): CliTool {
  // Claude Code sets specific env vars
  if (process.env.CLAUDE_CODE || process.env.CLAUDE_SESSION_ID) {
    return 'claude-code';
  }

  // Gemini CLI detection
  if (process.env.GEMINI_CLI || process.env.GEMINI_SESSION_ID) {
    return 'gemini';
  }

  // Codex CLI detection
  if (process.env.CODEX_CLI || process.env.CODEX_SESSION_ID) {
    return 'codex';
  }

  // Cursor detection
  if (process.env.CURSOR_SESSION_ID || process.env.VSCODE_PID) {
    return 'cursor';
  }

  // Copilot detection
  if (process.env.GITHUB_COPILOT_CLI) {
    return 'copilot';
  }

  // Check parent process name as fallback
  const parentCmd = process.env._ || '';
  if (parentCmd.includes('gemini')) return 'gemini';
  if (parentCmd.includes('claude')) return 'claude-code';
  if (parentCmd.includes('codex')) return 'codex';
  if (parentCmd.includes('cursor')) return 'cursor';

  return 'claude-code'; // Default assumption
}

export function generateSessionId(cliTool: CliTool): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${cliTool}-${timestamp}-${random}`;
}
