import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MemoryService } from './MemoryService.js';
import { logger } from '../shared/logger.js';
import { HTTP_PORT } from '../shared/constants.js';
import { autoCreateHandoffOnExit, autoDetectAndInjectContext } from '../hooks/auto-save.js';
import { writeContextFile, writeContextToAllClis } from '../context/file-writer.js';
import { generateContextMarkdown } from '../context/generator.js';
import { buildResumeContext } from '../context/resume-builder.js';
import { TokenSyncService } from '../tracking/token-sync.js';
import { bufferObservation, setFlushCallback, flushSessionBuffer } from '../utils/observation-compressor.js';
import type { CliTool } from '../shared/constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class WorkerService {
  private app = express();
  private port: number;
  private memoryService = MemoryService.getInstance();
  private tokenSync: TokenSyncService;

  constructor(port: number = HTTP_PORT) {
    this.port = port;
    this.tokenSync = new TokenSyncService(this.memoryService);
    this.app.use(cors());
    this.app.use(express.json());

    // Wire up the observation compressor flush callback
    setFlushCallback(async (obs) => {
      await this.memoryService.saveObservation(obs);
    });

    this.setupRoutes();
    this.setupTokenRoutes();
    this.setupStaticUI();
  }

  private setupRoutes() {
    // ── Session endpoints ──
    this.app.post('/api/sessions', async (req, res) => {
      try {
        await this.memoryService.createSession(req.body);
        res.status(201).json({ success: true });
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    this.app.get('/api/sessions', async (req, res) => {
      try {
        const project = req.query.project as string;
        if (project) {
          const sessions = await this.memoryService.getProjectSessions(project);
          res.json(sessions);
        } else {
          res.status(400).json({ error: 'project query parameter required' });
        }
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    // ── Observation endpoints ──
    this.app.post('/api/observations', async (req, res) => {
      try {
        const id = await this.memoryService.saveObservation(req.body);
        res.status(201).json({ success: true, id });
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    this.app.get('/api/observations', async (req, res) => {
      try {
        const project = req.query.project as string;
        const limit = parseInt(req.query.limit as string) || 50;
        if (project) {
          const obs = await this.memoryService.getObservationsByProject(project, limit);
          res.json(obs);
        } else {
          res.status(400).json({ error: 'project query parameter required' });
        }
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    // ── Search endpoint ──
    this.app.get('/api/search', async (req, res) => {
      try {
        const { query, project, cli_tool } = req.query;
        const results = await this.memoryService.searchObservations(
          (query as string) || '',
          (project as string) || undefined,
          (cli_tool as string) || undefined
        );
        res.json(results);
      } catch (error) {
        logger.error('Search API error', error);
        res.status(500).json({ error: String(error) });
      }
    });

    // ── Projects endpoint ──
    this.app.get('/api/projects', async (_req, res) => {
      try {
        const projects = await this.memoryService.getAllProjects();
        res.json(projects);
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    // ── Handoff endpoints ──
    this.app.get('/api/handoffs', async (req, res) => {
      try {
        const project = req.query.project as string;
        if (!project) return res.status(400).json({ error: 'project required' });
        const handoffs = await this.memoryService.getHandoffHistory(project);
        res.json(handoffs);
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    this.app.get('/api/handoffs/pending', async (req, res) => {
      try {
        const project = req.query.project as string;
        if (!project) return res.status(400).json({ error: 'project required' });
        const handoff = await this.memoryService.getPendingHandoff(project);
        res.json(handoff || null);
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    // ── Summaries endpoint ──
    this.app.get('/api/summaries', async (req, res) => {
      try {
        const project = req.query.project as string;
        if (!project) return res.status(400).json({ error: 'project required' });
        const summaries = await this.memoryService.getRecentSummaries(project);
        res.json(summaries);
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    // ── Status endpoint ──
    this.app.get('/api/status', async (req, res) => {
      try {
        const project = req.query.project as string;
        const projects = await this.memoryService.getAllProjects();
        const totalObs = await this.memoryService.getObservationCount(project || undefined);
        res.json({ projects, total_observations: totalObs, port: this.port });
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    // ── Hook receiver endpoint (for hook scripts to POST to) ──
    this.app.post('/api/hooks/:hookType', async (req, res) => {
      try {
        const { hookType } = req.params;
        const payload = req.body;
        logger.info(`Hook received: ${hookType}`, { cli: payload.cli_tool, session: payload.session_id });

        // Process hook events
        if (hookType === 'session-start') {
          await this.memoryService.createSession({
            session_id: payload.session_id,
            project: payload.project,
            cli_tool: payload.cli_tool,
            status: 'active',
            user_prompt: payload.prompt,
            created_at: new Date().toISOString(),
            created_at_epoch: Math.floor(Date.now() / 1000),
          });
        } else if (hookType === 'tool-use') {
          // Buffer tool-use observations for compression
          const buffered = bufferObservation({
            session_id: payload.session_id,
            project: payload.project,
            cli_tool: payload.cli_tool,
            tool_name: payload.tool_name,
            summary: payload.summary || `Used ${payload.tool_name}`,
            files_read: payload.files_read || [],
            files_modified: payload.files_modified || [],
            timestamp: Date.now(),
          });

          // If not buffered (e.g., UserPrompt), save immediately
          if (!buffered) {
            await this.memoryService.saveObservation({
              session_id: payload.session_id,
              project: payload.project,
              cli_tool: payload.cli_tool,
              type: categorizeToolUse(payload.tool_name),
              title: `${payload.tool_name}`,
              narrative: payload.summary || `Used ${payload.tool_name}`,
              facts: [],
              concepts: [payload.tool_name],
              files_read: payload.files_read || [],
              files_modified: payload.files_modified || [],
              created_at: new Date().toISOString(),
              created_at_epoch: Math.floor(Date.now() / 1000),
            });
          }
        } else if (hookType === 'session-end') {
          // Flush any buffered observations before completing
          flushSessionBuffer(payload.session_id);
          await this.memoryService.updateSessionStatus(
            payload.session_id, 'completed', 'session_end'
          );
        } else if (hookType === 'session-end-autosave') {
          // Flush any buffered observations before creating handoff
          flushSessionBuffer(payload.session_id);
          // AUTO-SAVE: Create handoff snapshot + write context to all CLIs
          await autoCreateHandoffOnExit(
            this.memoryService,
            payload.session_id,
            payload.project,
            payload.cli_tool as CliTool,
            payload.exit_reason
          );

          // Write context to ALL CLI files so the next CLI has it immediately
          if (payload.cwd) {
            try {
              const resumeCtx = await buildResumeContext(this.memoryService, payload.project, payload.cli_tool);
              const markdown = generateContextMarkdown(resumeCtx);
              writeContextToAllClis(payload.cwd, markdown);
              logger.info(`Context written to all CLI files for ${payload.project}`);
            } catch (err) {
              logger.warn('Failed to write context on session end', { error: String(err) });
            }
          }

          logger.info(`Auto-saved handoff for ${payload.cli_tool} session ${payload.session_id}`);
        } else if (hookType === 'auto-detect') {
          // AUTO-DETECT: Check for context from other CLIs and return it
          const context = await autoDetectAndInjectContext(
            this.memoryService,
            payload.project,
            payload.cli_tool as CliTool
          );
          if (context) {
            // Also write to CLI-specific file if we have cwd
            if (payload.cwd) {
              try {
                const resumeCtx = await buildResumeContext(this.memoryService, payload.project, payload.cli_tool);
                const markdown = generateContextMarkdown(resumeCtx);
                writeContextFile(payload.cwd, payload.cli_tool as CliTool, markdown);
              } catch (err) {
                logger.warn('Failed to write context file during auto-detect', { error: String(err) });
              }
            }
            logger.info(`Auto-injected context from previous CLI into ${payload.cli_tool}`);
            return res.json({ success: true, context });
          }
        }

        res.json({ success: true });
      } catch (error) {
        logger.error(`Hook ${req.params.hookType} failed`, error);
        res.status(500).json({ error: String(error) });
      }
    });
  }

  private setupTokenRoutes() {
    // ── Token Usage endpoints ──
    this.app.get('/api/tokens/summary', async (req, res) => {
      try {
        const days = parseInt(req.query.days as string) || 30;
        const summary = await this.memoryService.getTokenSummary(days);
        res.json(summary);
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    this.app.get('/api/tokens/daily', async (req, res) => {
      try {
        const days = parseInt(req.query.days as string) || 30;
        const usage = await this.memoryService.getDailyTokenUsage(days);
        res.json(usage);
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    this.app.get('/api/tokens/by-cli', async (req, res) => {
      try {
        const cli = req.query.cli as string;
        const days = parseInt(req.query.days as string) || 30;
        if (!cli) return res.status(400).json({ error: 'cli query parameter required' });
        const usage = await this.memoryService.getTokenUsageByCli(cli, days);
        res.json(usage);
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    this.app.post('/api/tokens/sync', async (_req, res) => {
      try {
        const count = await this.tokenSync.syncAll();
        res.json({ success: true, records_synced: count });
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });
  }

  private setupStaticUI() {
    // Try npm-installed path first (dist/ui/dist/), then source path (ui/dist/)
    const npmUiPath = path.join(__dirname, '../ui/dist');
    const devUiPath = path.join(__dirname, '../../ui/dist');
    const uiPath = fs.existsSync(npmUiPath) ? npmUiPath : devUiPath;
    this.app.use(express.static(uiPath));

    // SPA fallback - only for non-API routes
    this.app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(uiPath, 'index.html'), (err) => {
        if (err) {
          res.status(200).send('UniMem Dashboard - Build the UI with: cd ui && npm run build');
        }
      });
    });
  }

  public start(): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(this.port, () => {
        logger.info(`UniMem Worker Service running at http://localhost:${this.port}`);
        console.log(`UniMem Dashboard: http://localhost:${this.port}`);

        // Start periodic token sync
        this.tokenSync.startPeriodicSync();

        resolve();
      });
    });
  }
}

function categorizeToolUse(toolName: string): string {
  const editTools = ['Edit', 'Write', 'replace', 'insert', 'NotebookEdit'];
  const readTools = ['Read', 'cat', 'Glob', 'Grep', 'find'];
  const shellTools = ['Bash', 'shell', 'terminal'];

  if (editTools.some(t => toolName.includes(t))) return 'implementation';
  if (readTools.some(t => toolName.includes(t))) return 'discovery';
  if (shellTools.some(t => toolName.includes(t))) return 'discovery';
  return 'discovery';
}
