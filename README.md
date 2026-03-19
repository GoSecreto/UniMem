# UniMem v2

### Automatic Cross-CLI Context Switching for AI Development

UniMem automatically transfers your working context when you switch between AI coding CLIs. No manual steps, no copy-paste, no re-explaining what you were doing.

When you close Claude Code and open Gemini CLI (or vice versa), the new tool already knows what you were working on, which files you touched, and where you left off.

## Installation

```bash
npm install -g unimem
```

After install, you'll see a getting-started guide. You can view it anytime with:
```bash
unimem guide
```

## Quick Start

```bash
# 1. Install hooks into your CLIs (one-time)
unimem install --all

# 2. Start the worker (required for hooks + dashboard)
unimem start

# 3. Work normally — context transfers automatically when you switch CLIs
```

## How It Works

```
You work in Claude → close it → open Gemini → Gemini has Claude's context
You work in Gemini → close it → open Claude → Claude has Gemini's context
```

### Under the Hood

**When a CLI session ends:**
1. A `SessionEnd` hook fires automatically
2. All tool usage from the session (file reads, edits, commands) is saved
3. A handoff snapshot is created with completed work, files touched, and state
4. Context is written to `CLAUDE.md`, `GEMINI.md`, and `AGENTS.md` in your project

**When a CLI session starts:**
- **Claude Code** reads `CLAUDE.md` at startup (built-in behavior) — context is already there
- **Gemini CLI** receives context via `additionalContext` in the `SessionStart` hook response

## Supported CLIs

| CLI | MCP Tools | Hooks | Auto-Switch |
|-----|-----------|-------|-------------|
| Claude Code | Yes | Yes (SessionStart, SessionEnd, PostToolUse, UserPromptSubmit) | Yes |
| Gemini CLI | Yes | Yes (SessionStart, SessionEnd, BeforeAgent, AfterTool) | Yes |
| Codex | Via MCP | Manual | Via AGENTS.md |
| Cursor | Via MCP | Manual | Via .cursorrules |

## Dashboard

```bash
unimem start
# Open http://localhost:37888
```

4 tabs:
- **Overview** — sessions, observations, CLI breakdown, recent activity
- **Tokens** — token consumption per CLI, daily charts, cost tracking
- **Sessions** — session chain timeline, handoff history
- **Memory** — searchable, filterable observation browser

## Token Tracking

UniMem tracks token consumption across CLIs by reading their local stats files:
- **Claude Code**: `~/.claude/stats-cache.json`
- **Gemini CLI**: `~/.gemini/history/`
- **Codex**: `~/.codex/sessions/`

Auto-syncs every 60s. Manual sync: `curl -X POST http://localhost:37888/api/tokens/sync`

## CLI Commands

```bash
unimem              # Run stdio MCP server (npx compatible)
unimem serve        # Same as above (explicit)
unimem start        # Start HTTP worker + dashboard
unimem install      # Configure CLI integrations (--gemini, --claude, --all)
unimem status       # Show project memory stats
unimem resume       # Show handoff context
unimem handoff      # Create manual handoff snapshot
unimem guide        # Show getting started guide
```

## MCP Tools

Available inside any connected CLI:

| Tool | Description |
|------|-------------|
| `memory_search` | Full-text search across all observations |
| `memory_save` | Store observations (discoveries, bugfixes, implementations) |
| `memory_resume` | Get "where we left off" context |
| `memory_status` | Overview of memory state |
| `memory_timeline` | Chronological observation view |
| `memory_handoff` | Create explicit handoff snapshot |

## Requirements

- **Node.js** >= 18
- **npm** >= 8
- At least one supported AI CLI installed (Claude Code, Gemini CLI)
- The UniMem worker must be running for hooks to function (`unimem start`)

## Known Limitations

- **Worker must be running**: Hooks communicate with the UniMem worker via HTTP on port 37888. If the worker is not running, hooks queue events to disk (`~/.unimem/offline-queue/`) and replay them when the worker starts. No data is lost, but auto-switch won't work until the worker is running.
- **Observation granularity**: UniMem captures tool usage (file reads, edits, commands) but not the AI's internal reasoning. For richer handoffs, ask the AI to call `memory_save` with important decisions and context.
- **Concurrent CLIs**: Running two CLIs on the same project simultaneously is detected and warned about, but context files may be overwritten. Best practice: close one CLI before opening another.
- **Local only**: All data is stored locally in `~/.unimem/unimem.db` (SQLite). There is no cloud sync, no remote storage, no data leaving your machine.
- **Token tracking accuracy**: Token data is parsed from CLI tools' local cache files. Accuracy depends on the format those tools use, which may change across versions.

## Data & Privacy

- **All data is local**. UniMem stores everything in `~/.unimem/` on your machine.
- **No telemetry**. No data is sent anywhere.
- **No API keys required**. UniMem doesn't call any external APIs.
- **Context files** (`CLAUDE.md`, `GEMINI.md`) are written to your project directory. Add them to `.gitignore` if you don't want them committed:
  ```
  CLAUDE.md
  GEMINI.md
  AGENTS.md
  ```

## Troubleshooting

**"Worker not running" warning:**
```bash
unimem start  # Start it in a separate terminal
```

**Hooks not firing:**
```bash
# Verify installation
cat ~/.gemini/settings.json | grep unimem
cat ~/.claude/settings.json | grep unimem
cat ~/.mcp.json | grep unimem

# Re-install if needed
unimem install --all
```

**No context showing up after switching CLIs:**
1. Make sure both CLIs are started from the **same directory** (project name is derived from cwd)
2. Check that the worker is running: `curl http://localhost:37888/api/status`
3. Check if observations exist: `unimem status`

**Database issues:**
```bash
# Reset the database (WARNING: deletes all stored memories)
rm ~/.unimem/unimem.db
unimem status  # Recreates the database
```

## Architecture

- **SQLite** with WAL mode + FTS5 full-text search
- **MCP protocol** for Claude Code / Gemini CLI tool integration
- **Express** HTTP worker for dashboard + hook receiver
- **React + Tailwind** dashboard (bundled, no separate install)
- **Offline queue** for resilience when worker is down

## License

MIT

## Author

Prashant Gupta
