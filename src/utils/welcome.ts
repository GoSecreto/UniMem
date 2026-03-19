import { SERVER_VERSION, HTTP_PORT } from '../shared/constants.js';

const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';
const BLUE = '\x1b[34m';

export function printWelcome(): void {
  console.log(`
${CYAN}${BOLD}  ╔══════════════════════════════════════════════╗
  ║           UniMem v${SERVER_VERSION}                      ║
  ║   Automatic Cross-CLI Context Switching      ║
  ╚══════════════════════════════════════════════╝${RESET}

${BOLD}  What is UniMem?${RESET}
  When you switch between AI coding CLIs (Claude Code, Gemini CLI),
  UniMem automatically transfers your working context. No manual steps.

${BOLD}  Quick Start:${RESET}

  ${GREEN}1.${RESET} Install hooks into your CLIs:
     ${YELLOW}$ unimem install --all${RESET}

  ${GREEN}2.${RESET} Start the dashboard + worker:
     ${YELLOW}$ unimem start${RESET}

  ${GREEN}3.${RESET} That's it! Now just use your CLIs normally:
     ${DIM}• Work in Claude Code → close it
     • Open Gemini CLI → it already knows what you were doing
     • Switch back to Claude → context follows you${RESET}

${BOLD}  Dashboard:${RESET} ${BLUE}http://localhost:${HTTP_PORT}${RESET}

${BOLD}  Commands:${RESET}
  ${YELLOW}unimem${RESET}              Run MCP server (for npx/stdio)
  ${YELLOW}unimem start${RESET}        Start HTTP worker + dashboard
  ${YELLOW}unimem install${RESET}      Configure CLI integrations
  ${YELLOW}unimem status${RESET}       Show project memory stats
  ${YELLOW}unimem resume${RESET}       Show handoff context
  ${YELLOW}unimem handoff${RESET}      Create manual handoff snapshot

${BOLD}  MCP Tools${RESET} ${DIM}(available inside Claude Code & Gemini CLI):${RESET}
  ${CYAN}memory_search${RESET}     Full-text search across observations
  ${CYAN}memory_save${RESET}       Record discoveries, bugfixes, implementations
  ${CYAN}memory_resume${RESET}     Get "where we left off" context
  ${CYAN}memory_handoff${RESET}    Create explicit handoff snapshot

  ${DIM}Docs: https://github.com/GoSecreto/UniMem${RESET}
`);
}

export function printPostInstall(clis: string[]): void {
  const cliList = clis.join(', ');
  console.log(`
${GREEN}${BOLD}  ✓ UniMem installed into: ${cliList}${RESET}

${BOLD}  What happens now:${RESET}

  ${DIM}┌─────────────────────────────────────────────────────┐
  │  Gemini ends → hook saves context → writes CLAUDE.md │
  │  Claude starts → reads CLAUDE.md → has full context  │
  │                                                       │
  │  Claude ends → hook saves context → writes GEMINI.md │
  │  Gemini starts → hook injects context automatically  │
  └─────────────────────────────────────────────────────┘${RESET}

${BOLD}  Next steps:${RESET}

  ${GREEN}1.${RESET} Start the worker (required for hooks to work):
     ${YELLOW}$ unimem start${RESET}

  ${GREEN}2.${RESET} Open any CLI and start working. That's it!

  ${GREEN}3.${RESET} ${DIM}(Optional)${RESET} Open the dashboard:
     ${BLUE}http://localhost:${HTTP_PORT}${RESET}
     4 tabs: Overview | Tokens | Sessions | Memory
`);
}
