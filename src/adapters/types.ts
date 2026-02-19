import type { CliTool } from '../shared/constants.js';

/**
 * Normalized hook input - all CLI adapters convert their native
 * hook format to this common interface.
 */
export interface NormalizedHookInput {
  hookType: 'session-start' | 'prompt-submit' | 'tool-use' | 'session-end';
  sessionId: string;
  cwd: string;
  cliTool: CliTool;
  cliVersion?: string;
  prompt?: string;
  toolName?: string;
  toolInput?: unknown;
  toolResponse?: unknown;
  filePath?: string;
  filesRead?: string[];
  filesModified?: string[];
}

export interface HookResult {
  success: boolean;
  message?: string;
  contextToInject?: string;
}

export interface PlatformAdapter {
  normalizeInput(hookType: string, raw: unknown): NormalizedHookInput;
  formatOutput(result: HookResult): unknown;
}
