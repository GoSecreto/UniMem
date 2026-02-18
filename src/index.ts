import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { SessionStore } from "./storage/SessionStore.js";
import { ObservationStore } from "./storage/ObservationStore.js";
import { HandoffStore } from "./storage/HandoffStore.js";
import { Observation, Session, Handoff } from "./types/index.js";
import { WorkerService } from "./services/WorkerService.js";

// Initialize Stores
const sessionStore = new SessionStore();
const observationStore = new ObservationStore();
const handoffStore = new HandoffStore();

// Initialize MCP Server
const server = new Server(
  {
    name: "unimem",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define tool schemas
const SEARCH_TOOL = "memory_search";
const SAVE_TOOL = "memory_save";
const RESUME_TOOL = "memory_resume";
const HANDOFF_TOOL = "memory_handoff";

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: SEARCH_TOOL,
        description: "Search across all observations and summaries from any CLI.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query" },
            project: { type: "string", description: "Project name to scope search" },
            cli_tool: { type: "string", description: "Filter by source CLI tool (e.g., 'claude-code', 'gemini')" },
          },
          required: ["query"],
        },
      },
      {
        name: SAVE_TOOL,
        description: "Manually store an observation (useful for CLIs without automatic hooks).",
        inputSchema: {
          type: "object",
          properties: {
            text: { type: "string", description: "The observation content" },
            title: { type: "string", description: "Short title for the observation" },
            type: { type: "string", description: "Type of observation (e.g., 'discovery', 'bugfix')" },
            project: { type: "string", description: "Project name" },
            session_id: { type: "string", description: "Active session ID" },
            cli_tool: { type: "string", description: "CLI tool name" },
          },
          required: ["text", "project", "session_id", "cli_tool"],
        },
      },
      {
        name: RESUME_TOOL,
        description: "Get 'where we left off' context for a project, including handoffs from other CLIs.",
        inputSchema: {
          type: "object",
          properties: {
            project: { type: "string", description: "Project name" },
          },
          required: ["project"],
        },
      },
      {
        name: HANDOFF_TOOL,
        description: "Explicitly mark a CLI switch with a state snapshot.",
        inputSchema: {
          type: "object",
          properties: {
            project: { type: "string", description: "Project name" },
            session_id: { type: "string", description: "Current session ID" },
            cli_tool: { type: "string", description: "Current CLI tool" },
            snapshot: { type: "object", description: "State snapshot (JSON)" },
            reason: { type: "string", enum: ["rate_limit", "token_exhausted", "preference", "manual"], description: "Reason for switching" },
            notes: { type: "string", description: "Additional notes for the next CLI" },
          },
          required: ["project", "session_id", "cli_tool", "snapshot", "reason"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === SEARCH_TOOL) {
      const { query, project } = args as any;
      const results = observationStore.searchObservations(query);
      return { 
        content: [{ 
          type: "text", 
          text: JSON.stringify(results, null, 2) 
        }] 
      };
    }
    if (name === SAVE_TOOL) {
      const { text, title, type, project, session_id, cli_tool } = args as any;
      const obs: Observation = {
        session_id,
        project,
        cli_tool,
        type: type || "discovery",
        title: title || "Manual Observation",
        narrative: text,
        facts: [],
        concepts: [],
        files_read: [],
        files_modified: [],
        created_at: new Date().toISOString(),
        created_at_epoch: Math.floor(Date.now() / 1000),
      };
      const id = observationStore.saveObservation(obs);
      return { content: [{ type: "text", text: `Saved observation with ID: ${id}` }] };
    }
    if (name === RESUME_TOOL) {
      const { project } = args as any;
      const pendingHandoff = handoffStore.getPendingHandoff(project);
      const recentObservations = observationStore.getObservationsByProject(project).slice(0, 5);
      
      const resumeData = {
        handoff: pendingHandoff || null,
        recent_activity: recentObservations,
        instructions: "Please use this context to resume the work seamlessly."
      };

      return { 
        content: [{ 
          type: "text", 
          text: `RESUME CONTEXT for ${project}:\n\n${JSON.stringify(resumeData, null, 2)}` 
        }] 
      };
    }
    if (name === HANDOFF_TOOL) {
      const { project, session_id, cli_tool, snapshot, reason } = args as any;
      const handoff: Handoff = {
        project,
        from_session_id: session_id,
        from_cli: cli_tool,
        state_snapshot: snapshot,
        reason,
        created_at_epoch: Math.floor(Date.now() / 1000),
      };
      const id = handoffStore.createHandoff(handoff);
      return { content: [{ type: "text", text: `Created handoff snapshot with ID: ${id}. You can now switch to another CLI.` }] };
    }
    throw new Error(`Tool not found: ${name}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { content: [{ type: "text", text: `Error: ${errorMessage}` }], isError: true };
  }
});

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  // Start HTTP Worker Service in background for UI and Hooks
  const worker = new WorkerService();
  worker.start();
  
  console.error("UniMem MCP Server and Worker running");
}

runServer().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
