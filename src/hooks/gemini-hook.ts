import fs from 'fs';
import path from 'path';
import { MemoryService } from '../services/MemoryService.js';
import { Observation, Session } from '../types/index.js';

const memoryService = MemoryService.getInstance();

async function handleGeminiHook() {
  const hookType = process.argv[2]; // 'session-start', 'before-agent', 'after-tool'
  const payload = JSON.parse(fs.readFileSync(0, 'utf-8')); // Read from stdin

  const { session_id, cwd, prompt } = payload;
  const project = path.basename(cwd || process.cwd());

  if (hookType === 'session-start') {
    // 1. Create session if not exists
    const existingSession = await memoryService.getSession(session_id);
    if (!existingSession) {
      const session: Session = {
        session_id,
        project,
        cli_tool: 'gemini',
        status: 'active',
        created_at: new Date().toISOString(),
        created_at_epoch: Math.floor(Date.now() / 1000)
      };
      await memoryService.createSession(session);
    }

    // 2. Inject context into GEMINI.md
    const pendingHandoff = await memoryService.getPendingHandoff(project);
    const observations = await memoryService.getObservationsByProject(project);
    const recentObs = observations.slice(0, 10);
    
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
    if (recentObs.length > 0) {
      recentObs.forEach(obs => {
        context += `- [${obs.type}] ${obs.title}: ${obs.subtitle}
`;
      });
    } else {
      context += `No recent observations for this project.
`;
    }
    context += `
<!-- UNIMEM:END -->
`;

    const geminiMdPath = path.join(cwd || process.cwd(), 'GEMINI.md');
    let content = '';
    if (fs.existsSync(geminiMdPath)) {
      content = fs.readFileSync(geminiMdPath, 'utf8');
      content = content.replace(/<!-- UNIMEM:START -->[\s\S]*<!-- UNIMEM:END -->/, '');
    }
    fs.writeFileSync(geminiMdPath, context + content);

  } else if (hookType === 'before-agent') {
    // Capture user prompt
    if (prompt) {
      console.error(`Capturing prompt for session ${session_id}: ${prompt.slice(0, 50)}...`);
    }
  } else if (hookType === 'after-tool') {
    const { tool_name, tool_input, tool_response } = payload;
    
    const obs: Observation = {
      session_id,
      project,
      cli_tool: 'gemini',
      type: tool_name === 'Edit' || tool_name === 'replace' ? 'implementation' : 'discovery',
      title: `${tool_name} usage`,
      subtitle: `Input: ${JSON.stringify(tool_input).slice(0, 50)}...`,
      narrative: `Tool Response Summary: ${String(JSON.stringify(tool_response)).slice(0, 200)}...`,
      facts: [],
      concepts: [tool_name],
      files_read: [],
      files_modified: [],
      created_at: new Date().toISOString(),
      created_at_epoch: Math.floor(Date.now() / 1000)
    };
    
    await memoryService.saveObservation(obs);
  }
}

handleGeminiHook().catch(err => {
  console.error('Gemini hook failed:', err);
  process.exit(1);
});
