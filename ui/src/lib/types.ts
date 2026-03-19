export interface Observation {
  id: number;
  session_id: string;
  project: string;
  cli_tool: string;
  type: string;
  title: string;
  subtitle?: string;
  narrative?: string;
  facts: string[];
  concepts: string[];
  files_read: string[];
  files_modified: string[];
  created_at: string;
  created_at_epoch: number;
}

export interface Session {
  id: number;
  session_id: string;
  project: string;
  cli_tool: string;
  status: string;
  pause_reason?: string;
  parent_session_id?: string;
  created_at: string;
  created_at_epoch: number;
  completed_at_epoch?: number;
}

export interface Handoff {
  id: number;
  project: string;
  from_session_id: string;
  from_cli: string;
  to_cli?: string;
  to_session_id?: string;
  reason: string;
  state_snapshot: any;
  created_at_epoch: number;
  picked_up_at_epoch?: number;
}

export interface TokenSummary {
  cli_tool: string;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cache_read_tokens: number;
  total_cost_usd: number;
  total_messages: number;
  total_sessions: number;
  days_active: number;
}

export interface TokenUsageRecord {
  id: number;
  cli_tool: string;
  date: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  message_count: number;
  session_count: number;
  tool_use_count: number;
  cost_usd: number;
  source: string;
}

export interface StatusInfo {
  projects: string[];
  total_observations: number;
  port: number;
}
