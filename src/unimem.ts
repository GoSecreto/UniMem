#!/usr/bin/env npx tsx
import { Command } from 'commander';
import { InstallService } from './services/InstallService.js';
import { WorkerService } from './services/WorkerService.js';
import { spawn } from 'child_process';
import path from 'path';

const program = new Command();
const installService = new InstallService();

program
  .name('unimem')
  .description('Universal AI CLI Memory Service')
  .version('1.0.0');

program.command('start')
  .description('Start the UniMem server (MCP + Worker)')
  .action(() => {
    console.log('🚀 Starting UniMem Server...');
    const worker = new WorkerService();
    worker.start();
    
    // Spawn MCP server as a child if needed, or just let it run from the same process
    // For this prototype, the worker and MCP share the same entry point index.ts
    // but the 'start' command specifically focuses on the HTTP/UI worker.
  });

program.command('install')
  .description('Install UniMem hooks into CLIs')
  .option('--gemini', 'Install into Gemini CLI')
  .option('--claude', 'Install into Claude Code')
  .option('--all', 'Install into all supported CLIs')
  .action((options) => {
    if (options.all || options.gemini) installService.installGemini();
    if (options.all || options.claude) installService.installClaude();
  });

program.command('ui')
  .description('Start the UniMem Dashboard (Development Mode)')
  .action(() => {
    console.log('✨ Starting UniMem Dashboard...');
    const uiPath = path.join(process.cwd(), 'unimem/ui');
    const child = spawn('npm', ['run', 'dev'], { cwd: uiPath, stdio: 'inherit' });
    child.on('exit', (code) => process.exit(code || 0));
  });

program.parse();
