import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { MemoryService } from './services/MemoryService.js';
import { Observation, Handoff, HandoffSnapshot } from './types/index.js';
import { buildResumeContext } from './context/resume-builder.js';
import { generateContextMarkdown } from './context/generator.js';
import { logger } from './shared/logger.js';
import { SERVER_NAME, SERVER_VERSION } from './shared/constants.js';
import { generateSessionId, detectCliTool } from './utils/cli-detector.js';
import { deriveProjectName } from './utils/project-name.js';

const memoryService = MemoryService.getInstance();

const server = new Server(
  { name: SERVER_NAME, version: SERVER_VERSION },
  { capabilities: { tools: {} } }
);

// ── Tool Definitions ──

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'memory_search',
      description: 'Search across all observations and summaries from any CLI. Returns matching observations with titles, types, and IDs.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query (uses full-text search)' },
          project: { type: 'string', description: 'Project name to scope search (optional)' },
          cli_tool: { type: 'string', description: 'Filter by source CLI tool (optional)' },
          limit: { type: 'number', description: 'Max results (default 20)' },
        },
        required: ['query'],
      },
    },
    {
      name: 'memory_save',
      description: 'Store an observation about what you discovered, fixed, or implemented. Use this to record meaningful findings, not routine tool calls.',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short descriptive title (e.g., "Fixed JWT expiry off-by-one bug")' },
          text: { type: 'string', description: 'Detailed description of the observation' },
          type: {
            type: 'string',
            description: 'Type of observation',
            enum: ['discovery', 'bugfix', 'implementation', 'architecture', 'refactor', 'configuration', 'documentation', 'testing'],
          },
          project: { type: 'string', description: 'Project name (auto-detected from cwd if not provided)' },
          files_read: { type: 'array', items: { type: 'string' }, description: 'Files that were read' },
          files_modified: { type: 'array', items: { type: 'string' }, description: 'Files that were changed' },
          facts: { type: 'array', items: { type: 'string' }, description: 'Key factual statements' },
          concepts: { type: 'array', items: { type: 'string' }, description: 'Semantic tags/concepts' },
        },
        required: ['title', 'text'],
      },
    },
    {
      name: 'memory_resume',
      description: 'Get comprehensive "where we left off" context for a project. Shows last session info, pending handoffs, recent observations, and next steps. Call this when starting work on a project.',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'string', description: 'Project name (auto-detected if not provided)' },
        },
      },
    },
    {
      name: 'memory_status',
      description: 'Overview of memory state for the current project. Shows session count, observation count, active CLIs, and last activity.',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'string', description: 'Project name (optional, shows all projects if omitted)' },
        },
      },
    },
    {
      name: 'memory_timeline',
      description: 'Chronological view of observations around a specific point or for a project. Useful for understanding the sequence of events.',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'string', description: 'Project name' },
          anchor_id: { type: 'number', description: 'Observation ID to center the timeline on (optional)' },
          before: { type: 'number', description: 'Number of observations before anchor (default 5)' },
          after: { type: 'number', description: 'Number of observations after anchor (default 5)' },
        },
        required: ['project'],
      },
    },
    {
      name: 'memory_handoff',
      description: 'Create a handoff snapshot before switching to another CLI. Saves your current progress so the next CLI can pick up seamlessly. Call this when you hit a rate limit or want to switch tools.',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'string', description: 'Project name' },
          reason: {
            type: 'string',
            enum: ['rate_limit', 'token_exhausted', 'preference', 'manual'],
            description: 'Why you are switching CLIs',
          },
          completed: { type: 'array', items: { type: 'string' }, description: 'What has been completed so far' },
          in_progress: { type: 'array', items: { type: 'string' }, description: 'What is currently in progress' },
          next_steps: { type: 'array', items: { type: 'string' }, description: 'Recommended next steps' },
          decisions_made: { type: 'array', items: { type: 'string' }, description: 'Key decisions that were made and why' },
          files_read: { type: 'array', items: { type: 'string' }, description: 'Files that were read' },
          files_modified: { type: 'array', items: { type: 'string' }, description: 'Files that were modified' },
          notes: { type: 'string', description: 'Additional notes for the next CLI' },
        },
        required: ['project', 'reason'],
      },
    },
  ],
}));

// ── Tool Handlers ──

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'memory_search':
        return handleSearch(args as any);
      case 'memory_save':
        return handleSave(args as any);
      case 'memory_resume':
        return handleResume(args as any);
      case 'memory_status':
        return handleStatus(args as any);
      case 'memory_timeline':
        return handleTimeline(args as any);
      case 'memory_handoff':
        return handleHandoff(args as any);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`Tool ${name} failed`, { error: msg });
    return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
  }
});

// ── Handler Implementations ──

async function handleSearch(args: { query: string; project?: string; cli_tool?: string; limit?: number }) {
  const results = await memoryService.searchObservations(
    args.query, args.project, args.cli_tool, args.limit
  );

  if (results.length === 0) {
    return { content: [{ type: 'text', text: `No results found for "${args.query}".` }] };
  }

  const formatted = results.map(o => ({
    id: o.id,
    type: o.type,
    title: o.title,
    subtitle: o.subtitle,
    cli_tool: o.cli_tool,
    created_at: o.created_at,
    narrative: o.narrative?.substring(0, 200),
  }));

  return { content: [{ type: 'text', text: JSON.stringify(formatted, null, 2) }] };
}

async function handleSave(args: {
  title: string; text: string; type?: string; project?: string;
  files_read?: string[]; files_modified?: string[]; facts?: string[]; concepts?: string[];
}) {
  const project = args.project || deriveProjectName(process.cwd());
  const cliTool = detectCliTool();
  const sessionId = generateSessionId(cliTool);

  // Ensure session exists
  const existing = await memoryService.getLastActiveSession(project);
  const activeSessionId = existing?.session_id || sessionId;

  if (!existing) {
    await memoryService.createSession({
      session_id: activeSessionId,
      project,
      cli_tool: cliTool,
      status: 'active',
      created_at: new Date().toISOString(),
      created_at_epoch: Math.floor(Date.now() / 1000),
    });
  }

  const obs: Observation = {
    session_id: activeSessionId,
    project,
    cli_tool: cliTool,
    type: args.type || 'discovery',
    title: args.title,
    narrative: args.text,
    facts: args.facts || [],
    concepts: args.concepts || [],
    files_read: args.files_read || [],
    files_modified: args.files_modified || [],
    created_at: new Date().toISOString(),
    created_at_epoch: Math.floor(Date.now() / 1000),
  };

  const id = await memoryService.saveObservation(obs);
  return { content: [{ type: 'text', text: `Observation saved (ID: ${id}). Title: "${args.title}"` }] };
}

async function handleResume(args: { project?: string }) {
  const project = args.project || deriveProjectName(process.cwd());
  const cliTool = detectCliTool();

  const context = await buildResumeContext(memoryService, project, cliTool);

  if (!context.last_session && context.recent_observations.length === 0) {
    return {
      content: [{
        type: 'text',
        text: `No previous memory found for project "${project}". This appears to be a fresh start. Use \`memory_save\` to record observations as you work.`,
      }],
    };
  }

  const markdown = generateContextMarkdown(context);
  return { content: [{ type: 'text', text: markdown }] };
}

async function handleStatus(args: { project?: string }) {
  if (args.project) {
    const [sessions, obsCount, handoffs, summaries] = await Promise.all([
      memoryService.getRecentSessions(args.project, 10),
      memoryService.getObservationCount(args.project),
      memoryService.getHandoffHistory(args.project, 5),
      memoryService.getRecentSummaries(args.project, 3),
    ]);

    const cliBreakdown: Record<string, number> = {};
    for (const s of sessions) {
      cliBreakdown[s.cli_tool] = (cliBreakdown[s.cli_tool] || 0) + 1;
    }

    const status = {
      project: args.project,
      total_sessions: sessions.length,
      total_observations: obsCount,
      total_handoffs: handoffs.length,
      cli_usage: cliBreakdown,
      last_active: sessions[0] ? {
        cli: sessions[0].cli_tool,
        status: sessions[0].status,
        started: sessions[0].created_at,
      } : null,
      pending_handoff: handoffs.find(h => !h.picked_up_at_epoch) || null,
    };

    return { content: [{ type: 'text', text: JSON.stringify(status, null, 2) }] };
  }

  // All projects overview
  const projects = await memoryService.getAllProjects();
  const totalObs = await memoryService.getObservationCount();

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        total_projects: projects.length,
        projects,
        total_observations: totalObs,
      }, null, 2),
    }],
  };
}

async function handleTimeline(args: { project: string; anchor_id?: number; before?: number; after?: number }) {
  const observations = await memoryService.getTimeline(
    args.project, args.anchor_id, args.before || 5, args.after || 5
  );

  if (observations.length === 0) {
    return { content: [{ type: 'text', text: `No observations found for project "${args.project}".` }] };
  }

  const formatted = observations.map(o => ({
    id: o.id,
    type: o.type,
    title: o.title,
    cli_tool: o.cli_tool,
    created_at: o.created_at,
    files_modified: o.files_modified,
  }));

  return { content: [{ type: 'text', text: JSON.stringify(formatted, null, 2) }] };
}

async function handleHandoff(args: {
  project: string; reason: string;
  completed?: string[]; in_progress?: string[]; next_steps?: string[];
  decisions_made?: string[]; files_read?: string[]; files_modified?: string[];
  notes?: string;
}) {
  const cliTool = detectCliTool();
  const lastSession = await memoryService.getLastActiveSession(args.project);
  const sessionId = lastSession?.session_id || generateSessionId(cliTool);
  const recentObs = await memoryService.getObservationsByProject(args.project, 5);

  const snapshot: HandoffSnapshot = {
    project: args.project,
    from_cli: cliTool,
    timestamp: Math.floor(Date.now() / 1000),
    task: {
      request: args.in_progress?.[0] || 'Unknown task',
      status: 'in_progress',
    },
    completed: args.completed || [],
    in_progress: args.in_progress || [],
    decisions_made: args.decisions_made || [],
    files_touched: {
      read: args.files_read || [],
      modified: args.files_modified || [],
    },
    recent_observations: recentObs.map(o => ({
      id: o.id!,
      title: o.title || 'Untitled',
      type: o.type,
    })),
    next_steps: args.next_steps || [],
    notes: args.notes,
  };

  const handoff: Handoff = {
    project: args.project,
    from_session_id: sessionId,
    from_cli: cliTool,
    state_snapshot: snapshot,
    reason: args.reason as any,
    created_at_epoch: Math.floor(Date.now() / 1000),
  };

  const id = await memoryService.createHandoff(handoff);

  // Also create a session summary for this session
  if (lastSession) {
    await memoryService.saveSummary({
      session_id: sessionId,
      project: args.project,
      cli_tool: cliTool,
      request: args.in_progress?.[0],
      completed: args.completed?.join('; '),
      next_steps: args.next_steps?.join('; '),
      notes: `Handoff reason: ${args.reason}. ${args.notes || ''}`,
      files_read: args.files_read || [],
      files_edited: args.files_modified || [],
      created_at: new Date().toISOString(),
      created_at_epoch: Math.floor(Date.now() / 1000),
    });
  }

  return {
    content: [{
      type: 'text',
      text: `Handoff created (ID: ${id}). Session paused for ${cliTool}.\n\nThe next CLI to call \`memory_resume\` on project "${args.project}" will receive this context automatically.\n\nSaved: ${(args.completed || []).length} completed items, ${(args.next_steps || []).length} next steps, ${(args.files_modified || []).length} modified files.`,
    }],
  };
}

// ── Server Start ──
// IMPORTANT: MCP server uses stdio - do NOT start Express/HTTP here
// The HTTP worker runs separately via `unimem start` CLI command

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('UniMem MCP Server running via stdio');
}

runServer().catch((error) => {
  logger.error('MCP Server fatal error', error);
  process.exit(1);
});
