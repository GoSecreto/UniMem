-- Sessions: tracks which CLI tool was used and session continuity
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT UNIQUE NOT NULL,
  project TEXT NOT NULL,
  cli_tool TEXT NOT NULL,           -- 'claude-code', 'gemini', 'codex', 'copilot', 'aider', 'cursor'
  cli_version TEXT,
  status TEXT DEFAULT 'active',      -- 'active', 'paused', 'completed', 'rate_limited'
  pause_reason TEXT,                 -- 'rate_limit', 'token_exhausted', 'user_switch', 'session_end'
  parent_session_id TEXT,            -- links continuation chain across CLIs
  user_prompt TEXT,                  -- initial prompt for this session
  created_at TEXT NOT NULL,
  created_at_epoch INTEGER NOT NULL,
  updated_at_epoch INTEGER,
  completed_at_epoch INTEGER,
  FOREIGN KEY(parent_session_id) REFERENCES sessions(session_id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project);
CREATE INDEX IF NOT EXISTS idx_sessions_cli_tool ON sessions(cli_tool);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_project_created ON sessions(project, created_at_epoch DESC);

-- Observations: structured knowledge extracted from tool usage
CREATE TABLE IF NOT EXISTS observations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  project TEXT NOT NULL,
  cli_tool TEXT NOT NULL,
  type TEXT NOT NULL,                -- 'discovery', 'bugfix', 'implementation', 'architecture', etc.
  title TEXT,
  subtitle TEXT,
  facts TEXT,                        -- JSON array of factual statements
  narrative TEXT,                    -- Prose description
  concepts TEXT,                     -- JSON array of semantic tags
  files_read TEXT,                   -- JSON array of file paths
  files_modified TEXT,               -- JSON array of file paths
  prompt_number INTEGER,
  discovery_tokens INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  created_at_epoch INTEGER NOT NULL,
  FOREIGN KEY(session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_obs_session ON observations(session_id);
CREATE INDEX IF NOT EXISTS idx_obs_project ON observations(project);
CREATE INDEX IF NOT EXISTS idx_obs_cli_tool ON observations(cli_tool);
CREATE INDEX IF NOT EXISTS idx_obs_type ON observations(type);
CREATE INDEX IF NOT EXISTS idx_obs_created ON observations(created_at_epoch DESC);
CREATE INDEX IF NOT EXISTS idx_obs_project_type_created ON observations(project, type, created_at_epoch DESC);

-- Session summaries: structured session wrap-up
CREATE TABLE IF NOT EXISTS session_summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT UNIQUE NOT NULL,
  project TEXT NOT NULL,
  cli_tool TEXT NOT NULL,
  request TEXT,                      -- What was the user's request
  investigated TEXT,                 -- What was explored/researched
  learned TEXT,                      -- Key learnings
  completed TEXT,                    -- What was finished
  next_steps TEXT,                   -- What remains to be done
  notes TEXT,                        -- Additional notes
  files_read TEXT,                   -- JSON array
  files_edited TEXT,                 -- JSON array
  discovery_tokens INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  created_at_epoch INTEGER NOT NULL,
  FOREIGN KEY(session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_summaries_project ON session_summaries(project);
CREATE INDEX IF NOT EXISTS idx_summaries_cli ON session_summaries(cli_tool);
CREATE INDEX IF NOT EXISTS idx_summaries_created ON session_summaries(created_at_epoch DESC);

-- Handoffs: explicit CLI-to-CLI context transfer records
CREATE TABLE IF NOT EXISTS handoffs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project TEXT NOT NULL,
  from_session_id TEXT NOT NULL,
  from_cli TEXT NOT NULL,
  to_cli TEXT,                       -- NULL until next CLI picks up
  to_session_id TEXT,                -- NULL until next CLI picks up
  state_snapshot TEXT NOT NULL,      -- JSON: comprehensive state at handoff time
  reason TEXT,                       -- 'rate_limit', 'token_exhausted', 'preference', 'manual'
  created_at_epoch INTEGER NOT NULL,
  picked_up_at_epoch INTEGER,
  FOREIGN KEY(from_session_id) REFERENCES sessions(session_id),
  FOREIGN KEY(to_session_id) REFERENCES sessions(session_id)
);

CREATE INDEX IF NOT EXISTS idx_handoffs_project ON handoffs(project);
CREATE INDEX IF NOT EXISTS idx_handoffs_pending ON handoffs(project, picked_up_at_epoch);

-- User prompts: track what users asked across all CLIs
CREATE TABLE IF NOT EXISTS user_prompts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  project TEXT NOT NULL,
  cli_tool TEXT NOT NULL,
  prompt_number INTEGER NOT NULL,
  prompt_text TEXT NOT NULL,
  created_at_epoch INTEGER NOT NULL,
  FOREIGN KEY(session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_prompts_session ON user_prompts(session_id);
CREATE INDEX IF NOT EXISTS idx_prompts_project ON user_prompts(project, created_at_epoch DESC);

-- FTS5 for full-text search on observations
CREATE VIRTUAL TABLE IF NOT EXISTS observations_fts USING fts5(
  title, subtitle, narrative, facts, concepts,
  content='observations', content_rowid='id'
);

-- FTS5 triggers (same pattern as claude-mem)
CREATE TRIGGER IF NOT EXISTS observations_ai AFTER INSERT ON observations BEGIN
  INSERT INTO observations_fts(rowid, title, subtitle, narrative, facts, concepts)
  VALUES (new.id, new.title, new.subtitle, new.narrative, new.facts, new.concepts);
END;

CREATE TRIGGER IF NOT EXISTS observations_ad AFTER DELETE ON observations BEGIN
  INSERT INTO observations_fts(observations_fts, rowid, title, subtitle, narrative, facts, concepts)
  VALUES('delete', old.id, old.title, old.subtitle, old.narrative, old.facts, old.concepts);
END;

CREATE TRIGGER IF NOT EXISTS observations_au AFTER UPDATE ON observations BEGIN
  INSERT INTO observations_fts(observations_fts, rowid, title, subtitle, narrative, facts, concepts)
  VALUES('delete', old.id, old.title, old.subtitle, old.narrative, old.facts, old.concepts);
  INSERT INTO observations_fts(rowid, title, subtitle, narrative, facts, concepts)
  VALUES (new.id, new.title, new.subtitle, new.narrative, new.facts, new.concepts);
END;

-- FTS5 for session summaries
CREATE VIRTUAL TABLE IF NOT EXISTS session_summaries_fts USING fts5(
  request, investigated, learned, completed, next_steps, notes,
  content='session_summaries', content_rowid='id'
);

-- FTS5 triggers for session summaries (previously missing!)
CREATE TRIGGER IF NOT EXISTS summaries_ai AFTER INSERT ON session_summaries BEGIN
  INSERT INTO session_summaries_fts(rowid, request, investigated, learned, completed, next_steps, notes)
  VALUES (new.id, new.request, new.investigated, new.learned, new.completed, new.next_steps, new.notes);
END;

CREATE TRIGGER IF NOT EXISTS summaries_ad AFTER DELETE ON session_summaries BEGIN
  INSERT INTO session_summaries_fts(session_summaries_fts, rowid, request, investigated, learned, completed, next_steps, notes)
  VALUES('delete', old.id, old.request, old.investigated, old.learned, old.completed, old.next_steps, old.notes);
END;

CREATE TRIGGER IF NOT EXISTS summaries_au AFTER UPDATE ON session_summaries BEGIN
  INSERT INTO session_summaries_fts(session_summaries_fts, rowid, request, investigated, learned, completed, next_steps, notes)
  VALUES('delete', old.id, old.request, old.investigated, old.learned, old.completed, old.next_steps, old.notes);
  INSERT INTO session_summaries_fts(rowid, request, investigated, learned, completed, next_steps, notes)
  VALUES (new.id, new.request, new.investigated, new.learned, new.completed, new.next_steps, new.notes);
END;
