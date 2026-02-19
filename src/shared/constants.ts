export const HTTP_PORT = 37888;
export const SERVER_NAME = 'unimem';
export const SERVER_VERSION = '1.0.0';

export const CLI_TOOLS = ['claude-code', 'gemini', 'codex', 'copilot', 'cursor', 'aider'] as const;
export type CliTool = typeof CLI_TOOLS[number];

export const OBSERVATION_TYPES = [
  'discovery', 'bugfix', 'implementation', 'architecture',
  'refactor', 'configuration', 'documentation', 'testing'
] as const;

export const HANDOFF_REASONS = ['rate_limit', 'token_exhausted', 'preference', 'manual'] as const;

export const SESSION_STATUSES = ['active', 'paused', 'completed', 'rate_limited'] as const;

export const CONTEXT_MARKERS = {
  START: '<!-- UNIMEM:START - Auto-generated, do not edit -->',
  END: '<!-- UNIMEM:END -->',
} as const;

// Max characters for context injection to avoid overflowing CLI context windows
export const MAX_CONTEXT_CHARS = 8000;
export const MAX_RECENT_OBSERVATIONS = 10;
export const HANDOFF_AUTO_DETECT_MINUTES = 30;
