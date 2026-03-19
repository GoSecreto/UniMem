-- Token usage tracking table
-- Tracks token consumption per CLI tool, per day, per model
CREATE TABLE IF NOT EXISTS token_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cli_tool TEXT NOT NULL,
  date TEXT NOT NULL,           -- YYYY-MM-DD
  model TEXT NOT NULL DEFAULT 'unknown',
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0,
  cache_write_tokens INTEGER NOT NULL DEFAULT 0,
  message_count INTEGER NOT NULL DEFAULT 0,
  session_count INTEGER NOT NULL DEFAULT 0,
  tool_use_count INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0.0,
  source TEXT NOT NULL DEFAULT 'sync',  -- 'sync', 'hook', 'manual'
  created_at_epoch INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at_epoch INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(cli_tool, date, model)
);

CREATE INDEX IF NOT EXISTS idx_token_usage_cli ON token_usage(cli_tool);
CREATE INDEX IF NOT EXISTS idx_token_usage_date ON token_usage(date);
CREATE INDEX IF NOT EXISTS idx_token_usage_cli_date ON token_usage(cli_tool, date);
