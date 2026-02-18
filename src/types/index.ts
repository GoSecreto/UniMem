export interface Session {
  id?: number;
  session_id: string;
  project: string;
  cli_tool: string;
  cli_version?: string;
  status: 'active' | 'paused' | 'completed' | 'rate_limited';
  pause_reason?: string;
  parent_session_id?: string;
  user_prompt?: string;
  created_at: string;
  created_at_epoch: number;
  updated_at_epoch?: number;
  completed_at_epoch?: number;
}

export interface Observation {
  id?: number;
  session_id: string;
  project: string;
  cli_tool: string;
  type: string;
  title?: string;
  subtitle?: string;
  facts: string[]; // Stored as JSON string in DB
  narrative?: string;
  concepts: string[]; // Stored as JSON string in DB
  files_read: string[]; // Stored as JSON string in DB
  files_modified: string[]; // Stored as JSON string in DB
  prompt_number?: number;
  discovery_tokens?: number;
  created_at: string;
  created_at_epoch: number;
}

export interface SessionSummary {
  id?: number;
  session_id: string;
  project: string;
  cli_tool: string;
  request?: string;
  investigated?: string;
  learned?: string;
  completed?: string;
  next_steps?: string;
  notes?: string;
  files_read: string[];
  files_edited: string[];
  discovery_tokens?: number;
  created_at: string;
  created_at_epoch: number;
}

export interface Handoff {
  id?: number;
  project: string;
  from_session_id: string;
  from_cli: string;
  to_cli?: string;
  to_session_id?: string;
  state_snapshot: any; // JSON object
  reason: 'rate_limit' | 'token_exhausted' | 'preference' | 'manual';
  created_at_epoch: number;
  picked_up_at_epoch?: number;
}
