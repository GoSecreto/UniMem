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
  facts: string[];
  narrative?: string;
  concepts: string[];
  files_read: string[];
  files_modified: string[];
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
  state_snapshot: HandoffSnapshot;
  reason: 'rate_limit' | 'token_exhausted' | 'preference' | 'manual';
  created_at_epoch: number;
  picked_up_at_epoch?: number;
}

export interface HandoffSnapshot {
  project: string;
  from_cli: string;
  timestamp: number;
  task?: {
    request: string;
    status: string;
    progress_percent?: number;
  };
  completed?: string[];
  in_progress?: string[];
  decisions_made?: string[];
  files_touched?: {
    read: string[];
    modified: string[];
  };
  recent_observations?: Array<{ id: number; title: string; type: string }>;
  next_steps?: string[];
  notes?: string;
}

export interface UserPrompt {
  id?: number;
  session_id: string;
  project: string;
  cli_tool: string;
  prompt_number: number;
  prompt_text: string;
  created_at_epoch: number;
}

export interface ResumeContext {
  project: string;
  last_session?: {
    cli: string;
    session_id: string;
    ended_ago: string;
    reason?: string;
  };
  pending_handoff?: Handoff;
  task_summary?: string;
  completed?: string[];
  in_progress?: string[];
  next_steps?: string[];
  files_touched?: string[];
  recent_observations: Array<{
    id: number;
    type: string;
    title: string;
    cli_tool: string;
    created_at: string;
  }>;
  recent_summaries: SessionSummary[];
}
