#!/usr/bin/env node
import { Command } from 'commander';
import { WorkerService } from '../services/WorkerService.js';
import { MemoryService } from '../services/MemoryService.js';
import { InstallService } from '../services/InstallService.js';
import { deriveProjectName } from '../utils/project-name.js';
import { buildResumeContext } from '../context/resume-builder.js';
import { generateContextMarkdown } from '../context/generator.js';
import { writeContextToAllClis } from '../context/file-writer.js';
import { SERVER_VERSION, HTTP_PORT } from '../shared/constants.js';

const program = new Command();
const installService = new InstallService();

program
  .name('unimem')
  .description('Universal AI CLI Memory Service')
  .version(SERVER_VERSION);

program.command('start')
  .description('Start the UniMem HTTP Worker (dashboard + hook receiver)')
  .option('-p, --port <port>', 'Port number', String(HTTP_PORT))
  .action(async (options) => {
    const port = parseInt(options.port);
    const worker = new WorkerService(port);
    await worker.start();
    console.log(`UniMem Worker running. Dashboard: http://localhost:${port}`);
    console.log('Press Ctrl+C to stop.');
  });

program.command('status')
  .description('Show memory status for a project')
  .option('-p, --project <name>', 'Project name (auto-detected from cwd)')
  .action(async (options) => {
    const memoryService = MemoryService.getInstance();
    const project = options.project || deriveProjectName(process.cwd());

    const [sessions, obsCount, handoffs, projects] = await Promise.all([
      memoryService.getRecentSessions(project, 5),
      memoryService.getObservationCount(project),
      memoryService.getHandoffHistory(project, 5),
      memoryService.getAllProjects(),
    ]);

    console.log(`\nUniMem Status for: ${project}`);
    console.log('─'.repeat(40));
    console.log(`Sessions:      ${sessions.length}`);
    console.log(`Observations:  ${obsCount}`);
    console.log(`Handoffs:      ${handoffs.length}`);

    const pending = handoffs.find(h => !h.picked_up_at_epoch);
    if (pending) {
      console.log(`\nPending handoff from ${pending.from_cli} (${pending.reason})`);
    }

    if (sessions.length > 0) {
      console.log('\nRecent sessions:');
      for (const s of sessions.slice(0, 5)) {
        console.log(`  [${s.cli_tool}] ${s.session_id} (${s.status}) - ${s.created_at}`);
      }
    }

    if (projects.length > 1) {
      console.log(`\nAll projects: ${projects.join(', ')}`);
    }
  });

program.command('handoff')
  .description('Create a handoff snapshot for the current project')
  .option('-p, --project <name>', 'Project name')
  .option('-r, --reason <reason>', 'Reason for handoff', 'manual')
  .option('-n, --notes <notes>', 'Notes for the next CLI')
  .action(async (options) => {
    const memoryService = MemoryService.getInstance();
    const project = options.project || deriveProjectName(process.cwd());

    const lastSession = await memoryService.getLastActiveSession(project);
    if (!lastSession) {
      console.log('No active session found for this project.');
      return;
    }

    const recentObs = await memoryService.getObservationsByProject(project, 10);

    const id = await memoryService.createHandoff({
      project,
      from_session_id: lastSession.session_id,
      from_cli: lastSession.cli_tool,
      state_snapshot: {
        project,
        from_cli: lastSession.cli_tool,
        timestamp: Math.floor(Date.now() / 1000),
        recent_observations: recentObs.map(o => ({
          id: o.id!, title: o.title || 'Untitled', type: o.type,
        })),
        notes: options.notes,
      },
      reason: options.reason,
      created_at_epoch: Math.floor(Date.now() / 1000),
    });

    // Write context to all CLI files so any CLI that starts next will see it
    const context = await buildResumeContext(memoryService, project);
    const markdown = generateContextMarkdown(context);
    writeContextToAllClis(process.cwd(), markdown);

    console.log(`Handoff created (ID: ${id})`);
    console.log(`Context written to CLAUDE.md, GEMINI.md, AGENTS.md`);
    console.log(`The next CLI to start on this project will see the handoff context.`);
  });

program.command('install')
  .description('Install UniMem hooks into CLIs')
  .option('--gemini', 'Install into Gemini CLI')
  .option('--claude', 'Install into Claude Code')
  .option('--all', 'Install into all supported CLIs')
  .action((options) => {
    if (options.all || options.gemini) installService.installGemini();
    if (options.all || options.claude) installService.installClaude();
    if (!options.all && !options.gemini && !options.claude) {
      console.log('Specify --gemini, --claude, or --all');
    }
  });

program.command('resume')
  .description('Show resume context for the current project')
  .option('-p, --project <name>', 'Project name')
  .action(async (options) => {
    const memoryService = MemoryService.getInstance();
    const project = options.project || deriveProjectName(process.cwd());
    const context = await buildResumeContext(memoryService, project);
    const markdown = generateContextMarkdown(context);
    console.log(markdown);
  });

program.parse();
