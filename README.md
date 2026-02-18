# 🧠 UniMem

### The Universal AI CLI Memory Service

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/yourusername/unimem)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Protocol](https://img.shields.io/badge/MCP-Supported-orange.svg)](https://modelcontextprotocol.io)

**UniMem** is a persistent, cross-CLI memory engine for AI-assisted development. It breaks down the silos between AI coding tools (Claude Code, Gemini CLI, Cursor, etc.), allowing your project context, decisions, and progress to follow you seamlessly.

---

## 🖼️ Dashboard Gallery

### The Intelligence Feed
*A high-fidelity, dark-themed timeline of every AI action taken across your project.*
![Timeline Screenshot](https://raw.githubusercontent.com/yourusername/unimem/main/docs/screenshots/timeline.png)

### Multi-CLI Synchronization
*Real-time project switching and cross-tool activity tracking.*
![Projects Screenshot](https://raw.githubusercontent.com/yourusername/unimem/main/docs/screenshots/dashboard.png)

---

## 🌟 Key Features

- **🔄 Cross-CLI Continuity**: Start a task in Gemini and resume in Claude without re-explaining context.
- **🛡️ Handoff Protocol**: Explicitly save a state snapshot when switching CLIs.
- **🚀 MCP-Native**: Native integration with the Model Context Protocol.
- **📊 Pro Dashboard**: React-based timeline at `localhost:37888`.
- **⚡ High Performance**: Powered by SQLite (WAL mode) and FTS5 search.

---

## 🚀 Installation & Setup

### 1. Requirements
- Node.js v20+
- `better-sqlite3` build essentials

### 2. Core Setup
```bash
git clone https://github.com/yourusername/unimem.git
cd unimem

# Install backend dependencies
npm install

# Build the professional Dashboard
cd ui
npm install
npm run build
cd ..
```

### 3. Automated CLI Integration
UniMem can automatically "wire" itself into your local AI tools:

```bash
# Install hooks into both Gemini CLI and Claude Code
npm run unimem -- install --all
```

---

## 🔌 Connecting Any CLI

UniMem is built on the **Model Context Protocol (MCP)**, meaning any CLI that supports MCP can use it as a persistent brain.

### Gemini CLI (`entire`)
UniMem installs itself into `~/.gemini/settings.json` using high-performance lifecycle hooks:
```json
"hooks": {
  "SessionStart": [{ "matcher": "*", "hooks": [{ "name": "unimem-start", "type": "command", "command": "/path/to/node /path/to/unimem/node_modules/.bin/tsx /path/to/unimem/src/hooks/gemini-hook.ts session-start" }] }]
}
```

### Claude Code
UniMem registers as a global MCP server in `~/.mcp.json`:
```json
"mcpServers": {
  "unimem": {
    "command": "/path/to/node",
    "args": ["/path/to/tsx", "/path/to/unimem/src/index.ts"]
  }
}
```

### Other CLIs (Manual)
Point any MCP-capable tool to `src/index.ts`. Use these tools to interact with memory:
- `memory_search`: Query your historical project knowledge.
- `memory_handoff`: Save your current progress before switching tools.
- `memory_resume`: Get a "cheat sheet" of where you left off.

---

## 📖 The "Handoff" Workflow

1.  **Work in Gemini**: Research a complex bug. Gemini saves observations to UniMem automatically.
2.  **Rate Limit / Switch**: You hit a rate limit. Tell Gemini: *"Use `memory_handoff` to save my progress."*
3.  **Resume in Claude**: Open Claude Code. Claude automatically reads `CLAUDE.md` (updated by UniMem) or calls `memory_resume`.
4.  **Result**: Claude says: *"I see you were researching the auth bug in Gemini. I'll continue fixing the JWT expiry now."*

---

## 📄 License

MIT © Akanksha Gupta

---
*Developed with ❤️ for the AI Developer Community.*
