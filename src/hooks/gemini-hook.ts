import fs from 'fs';
import path from 'path';
import { ObservationStore } from '../storage/ObservationStore.js';
import { SessionStore } from '../storage/SessionStore.js';
import { HandoffStore } from '../storage/HandoffStore.js';
import { Observation, Session } from '../types/index.js';

const observationStore = new ObservationStore();
const sessionStore = new SessionStore();
const handoffStore = new HandoffStore();

async function handleGeminiHook() {
  const hookType = process.argv[2]; // 'session-start', 'before-tool', 'after-tool'
  const payload = JSON.parse(fs.readFileSync(0, 'utf-8')); // Read from stdin

  if (hookType === 'session-start') {
    const { session_id, project, user_prompt } = payload;
    
    // 1. Create session if not exists
    if (!sessionStore.getSession(session_id)) {
      const session: Session = {
        session_id,
        project,
        cli_tool: 'gemini',
        status: 'active',
        user_prompt,
        created_at: new Date().toISOString(),
        created_at_epoch: Math.floor(Date.now() / 1000)
      };
      sessionStore.createSession(session);
    }

    // 2. Inject context into GEMINI.md
    const pendingHandoff = handoffStore.getPendingHandoff(project);
    const recentObs = observationStore.getObservationsByProject(project).slice(0, 10);
    
    let context = `<!-- UNIMEM:START -->
# UniMem Context

`;
    if (pendingHandoff) {
      context += `## ⚠️ Pending Handoff from ${pendingHandoff.from_cli}
`;
      context += `Reason: ${pendingHandoff.reason}
`;
      context += `Snapshot: ${JSON.stringify(pendingHandoff.state_snapshot, null, 2)}

`;
    }
    
    context += `## Recent History
`;
    recentObs.forEach(obs => {
      context += `- [${obs.type}] ${obs.title}: ${obs.subtitle}
`;
    });
    context += `
<!-- UNIMEM:END -->
`;

    const geminiMdPath = path.join(process.cwd(), 'GEMINI.md');
    let content = '';
    if (fs.existsSync(geminiMdPath)) {
      content = fs.readFileSync(geminiMdPath, 'utf8');
      content = content.replace(/<!-- UNIMEM:START -->[\s\S]*<!-- UNIMEM:END -->/, '');
    }
    fs.writeFileSync(geminiMdPath, context + content);

  } else if (hookType === 'after-tool') {
    const { session_id, project, tool_name, tool_input, tool_output } = payload;
    
    const obs: Observation = {
      session_id,
      project,
      cli_tool: 'gemini',
      type: tool_name === 'Edit' ? 'implementation' : 'discovery',
      title: `${tool_name} usage`,
      subtitle: `Input: ${JSON.stringify(tool_input).slice(0, 50)}...`,
      narrative: `Tool Output Summary: ${String(tool_output).slice(0, 200)}...`,
      facts: [],
      concepts: [tool_name],
      files_read: [],
      files_modified: [],
      created_at: new Date().toISOString(),
      created_at_epoch: Math.floor(Date.now() / 1000)
    };
    
    observationStore.saveObservation(obs);
  }
}

handleGeminiHook().catch(err => {
  console.error('Gemini hook failed:', err);
  process.exit(1);
});
