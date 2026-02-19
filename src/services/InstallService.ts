import fs from 'fs';
import path from 'path';
import { PROJECT_ROOT } from '../shared/paths.js';

export class InstallService {
  private geminiConfigPath = path.join(process.env.HOME || '', '.gemini', 'settings.json');
  private claudeConfigPath = path.join(process.env.HOME || '', '.mcp.json');

  public installGemini() {
    console.log('Installing UniMem into Gemini CLI...');

    // Ensure config directory exists
    const configDir = path.dirname(this.geminiConfigPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    const config: any = fs.existsSync(this.geminiConfigPath)
      ? JSON.parse(fs.readFileSync(this.geminiConfigPath, 'utf8'))
      : {};

    const nodePath = process.execPath;
    const tsxPath = path.join(PROJECT_ROOT, 'node_modules/.bin/tsx');
    const hookPath = path.join(PROJECT_ROOT, 'src/hooks/gemini-hook.ts');

    // 1. Register MCP Server
    config.mcpServers = config.mcpServers || {};
    config.mcpServers.unimem = {
      command: nodePath,
      args: [tsxPath, path.join(PROJECT_ROOT, 'src/index.ts')],
    };

    // 2. Register Hooks
    config.hooks = config.hooks || {};

    const createHook = (name: string, arg: string) => ([{
      matcher: '*',
      hooks: [{
        name: `unimem-${name}`,
        type: 'command',
        command: `${nodePath} ${tsxPath} ${hookPath} ${arg}`,
      }],
    }]);

    // Preserve existing hooks, add ours
    config.hooks.SessionStart = mergeHooks(config.hooks.SessionStart, createHook('session-start', 'session-start'));
    config.hooks.BeforeAgent = mergeHooks(config.hooks.BeforeAgent, createHook('before-agent', 'before-agent'));
    config.hooks.AfterTool = mergeHooks(config.hooks.AfterTool, createHook('after-tool', 'after-tool'));

    fs.writeFileSync(this.geminiConfigPath, JSON.stringify(config, null, 2));
    console.log('  MCP server registered in ~/.gemini/settings.json');
    console.log('  Hooks registered: SessionStart, BeforeAgent, AfterTool');
    console.log('Done.');
  }

  public installClaude() {
    console.log('Installing UniMem into Claude Code...');

    const config: any = fs.existsSync(this.claudeConfigPath)
      ? JSON.parse(fs.readFileSync(this.claudeConfigPath, 'utf8'))
      : {};

    const nodePath = process.execPath;
    const tsxPath = path.join(PROJECT_ROOT, 'node_modules/.bin/tsx');

    config.mcpServers = config.mcpServers || {};
    config.mcpServers.unimem = {
      command: nodePath,
      args: [tsxPath, path.join(PROJECT_ROOT, 'src/index.ts')],
    };

    fs.writeFileSync(this.claudeConfigPath, JSON.stringify(config, null, 2));
    console.log('  MCP server registered in ~/.mcp.json');
    console.log('  Claude Code will have access to memory_search, memory_save, memory_resume, memory_status, memory_timeline, and memory_handoff tools.');
    console.log('Done.');
  }
}

/**
 * Merge UniMem hooks with existing hooks, avoiding duplicates.
 */
function mergeHooks(existing: any[] | undefined, newHooks: any[]): any[] {
  if (!existing || !Array.isArray(existing)) return newHooks;

  // Remove any existing unimem hooks
  const filtered = existing.filter((h: any) => {
    if (h.hooks && Array.isArray(h.hooks)) {
      h.hooks = h.hooks.filter((inner: any) => !inner.name?.startsWith('unimem-'));
      return h.hooks.length > 0;
    }
    return true;
  });

  return [...filtered, ...newHooks];
}
