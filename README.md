# 🧠 UniMem

### The Universal AI CLI Memory Service

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/yourusername/unimem)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Protocol](https://img.shields.io/badge/MCP-Supported-orange.svg)](https://modelcontextprotocol.io)

**UniMem** is a persistent, cross-CLI memory engine for AI-assisted development. It breaks down the silos between different AI coding tools (Claude Code, Gemini CLI, Cursor, etc.), allowing your project context, decisions, and progress to follow you seamlessly from one tool to another.

---

## 🌟 Key Features

- **🔄 Cross-CLI Continuity**: Start a task in Claude Code and resume it in Gemini CLI without re-explaining context.
- **🛡️ Handoff Protocol**: Explicitly save a state snapshot when switching CLIs (e.g., when rate-limited).
- **🚀 MCP-Native**: Built on the Model Context Protocol for deep integration with modern AI agents.
- **📊 Interactive Timeline**: A professional React dashboard to visualize your development history.
- **🧪 Hook-Based Capture**: Automatic, zero-config memory capture for Gemini CLI and Claude Code.
- **⚡ High Performance**: Powered by SQLite (WAL mode) and FTS5 for lightning-fast search.

---

## 🚀 Quick Start

### 1. Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/unimem.git
cd unimem

# Install backend & UI dependencies
npm install
cd ui && npm install && npm run build
cd ..
```

### 2. Connect Your CLIs

Install UniMem as an MCP server and lifecycle hook provider for your favorite tools:

```bash
npm run unimem -- install --all
```
*Supports: Gemini CLI (`entire`), Claude Code.*

### 3. Start the Engine

```bash
npm start
```
The UniMem server will start on **port 37888** and the Dashboard will be accessible at `http://localhost:37888`.

---

## 📖 How It Works

UniMem acts as a centralized brain for your local development environment.

1.  **Observation Extraction**: Lifecycle hooks capture tool outputs (edits, commands, research) and store them as structured "Observations" in a central SQLite database.
2.  **Context Injection**: On session start, UniMem detects the project and injects the latest memory context into native files like `GEMINI.md` or `CLAUDE.md`.
3.  **Handoffs**: When switching CLIs, a `memory_handoff` tool creates a task snapshot. The next CLI calls `memory_resume` to pick up exactly where you left off.

---

## 🛠 Tech Stack

- **Backend**: Node.js, TypeScript, Better-SQLite3, Express
- **Frontend**: React, Vite, Tailwind CSS, Lucide Icons
- **Protocol**: Model Context Protocol (MCP)
- **Search**: SQLite FTS5 Full-Text Search

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for more details.

## 📄 License

UniMem is open-source software licensed under the [MIT License](LICENSE).

---
*Developed with ❤️ for the AI Developer Community.*
