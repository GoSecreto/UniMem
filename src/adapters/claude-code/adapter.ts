import { PlatformAdapter, NormalizedHookInput, HookResult } from '../types.js';

/**
 * Claude Code adapter
 *
 * Claude Code hooks provide JSON on stdin with these fields:
 * - session_id: string
 * - cwd: string (working directory)
 * - tool_name: string (for PostToolUse)
 * - tool_input: object (for PostToolUse)
 * - tool_response: string (for PostToolUse)
 * - transcript_path: string (path to session transcript)
 */
export class ClaudeCodeAdapter implements PlatformAdapter {
  normalizeInput(hookType: string, raw: unknown): NormalizedHookInput {
    const data = raw as Record<string, any>;

    const base: Partial<NormalizedHookInput> = {
      sessionId: data.session_id || `claude-${Date.now().toString(36)}`,
      cwd: data.cwd || process.cwd(),
      cliTool: 'claude-code',
      cliVersion: data.cli_version,
    };

    switch (hookType) {
      case 'SessionStart':
        return { ...base, hookType: 'session-start' } as NormalizedHookInput;

      case 'UserPromptSubmit':
        return {
          ...base,
          hookType: 'prompt-submit',
          prompt: data.prompt || data.user_prompt,
        } as NormalizedHookInput;

      case 'PostToolUse': {
        const toolName = data.tool_name || '';
        const toolInput = data.tool_input || {};
        const toolResponse = data.tool_response;

        // Extract file paths from common tool patterns
        const filesRead: string[] = [];
        const filesModified: string[] = [];

        if (['Read', 'Glob', 'Grep'].includes(toolName)) {
          if (toolInput.file_path) filesRead.push(toolInput.file_path);
          if (toolInput.path) filesRead.push(toolInput.path);
        }
        if (['Edit', 'Write', 'NotebookEdit'].includes(toolName)) {
          if (toolInput.file_path) filesModified.push(toolInput.file_path);
        }

        return {
          ...base,
          hookType: 'tool-use',
          toolName,
          toolInput,
          toolResponse,
          filesRead,
          filesModified,
        } as NormalizedHookInput;
      }

      case 'Stop':
      case 'SessionEnd':
        return { ...base, hookType: 'session-end' } as NormalizedHookInput;

      default:
        return { ...base, hookType: 'tool-use' } as NormalizedHookInput;
    }
  }

  formatOutput(result: HookResult): unknown {
    // Claude Code expects JSON output on stdout for hooks
    return {
      success: result.success,
      message: result.message,
    };
  }
}
