import { PlatformAdapter, NormalizedHookInput, HookResult } from '../types.js';

/**
 * Gemini CLI adapter
 *
 * Gemini CLI hooks:
 * - SessionStart: { session_id, cwd }
 * - BeforeAgent: { session_id, cwd, prompt }
 * - AfterTool: { session_id, cwd, tool_name, tool_input, tool_output }
 */
export class GeminiAdapter implements PlatformAdapter {
  normalizeInput(hookType: string, raw: unknown): NormalizedHookInput {
    const data = raw as Record<string, any>;

    const base: Partial<NormalizedHookInput> = {
      sessionId: data.session_id || `gemini-${Date.now().toString(36)}`,
      cwd: data.cwd || process.cwd(),
      cliTool: 'gemini',
    };

    switch (hookType) {
      case 'SessionStart':
      case 'session-start':
        return { ...base, hookType: 'session-start' } as NormalizedHookInput;

      case 'BeforeAgent':
      case 'before-agent':
        return {
          ...base,
          hookType: 'prompt-submit',
          prompt: data.prompt,
        } as NormalizedHookInput;

      case 'AfterTool':
      case 'after-tool': {
        const toolName = data.tool_name || '';
        const toolInput = data.tool_input || {};

        const filesRead: string[] = [];
        const filesModified: string[] = [];

        if (['read_file', 'Read'].includes(toolName)) {
          if (toolInput.path) filesRead.push(toolInput.path);
          if (toolInput.file_path) filesRead.push(toolInput.file_path);
        }
        if (['write_file', 'Edit', 'replace'].includes(toolName)) {
          if (toolInput.path) filesModified.push(toolInput.path);
          if (toolInput.file_path) filesModified.push(toolInput.file_path);
        }

        return {
          ...base,
          hookType: 'tool-use',
          toolName,
          toolInput,
          toolResponse: data.tool_output || data.tool_response,
          filesRead,
          filesModified,
        } as NormalizedHookInput;
      }

      default:
        return { ...base, hookType: 'tool-use' } as NormalizedHookInput;
    }
  }

  formatOutput(result: HookResult): unknown {
    return { success: result.success };
  }
}
