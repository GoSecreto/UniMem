import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PROJECT_ROOT } from '../shared/paths.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class InstallService {
  private geminiConfigPath = path.join(process.env.HOME || '', '.gemini', 'settings.json');
  private claudeMcpPath = path.join(process.env.HOME || '', '.mcp.json');
  private claudeSettingsDir = path.join(process.env.HOME || '', '.claude');

  /**
   * Detect whether we're running from source (tsx) or from dist (npm install).
   */
  private getHookPaths(): {
    runner: string;
    geminiHookPath: string;
    claudeHookPath: string;
    mcpEntry: string;
  } {
    const nodePath = process.execPath;

    // Check if we're in dist/ (npm-installed mode)
    const distGeminiHook = path.join(PROJECT_ROOT, 'dist/hooks/gemini-hook.js');
    const distClaudeHook = path.join(PROJECT_ROOT, 'dist/adapters/claude-code/hooks.js');
    const distMcp = path.join(PROJECT_ROOT, 'dist/index.js');

    if (fs.existsSync(distGeminiHook)) {
      return {
        runner: nodePath,
        geminiHookPath: distGeminiHook,
        claudeHookPath: distClaudeHook,
        mcpEntry: distMcp,
      };
    }

    // Source mode — use tsx
    const tsxPath = path.join(PROJECT_ROOT, 'node_modules/.bin/tsx');
    return {
      runner: `${nodePath} ${tsxPath}`,
      geminiHookPath: path.join(PROJECT_ROOT, 'src/hooks/gemini-hook.ts'),
      claudeHookPath: path.join(PROJECT_ROOT, 'src/adapters/claude-code/hooks.ts'),
      mcpEntry: path.join(PROJECT_ROOT, 'src/index.ts'),
    };
  }

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

    const { runner, geminiHookPath, mcpEntry } = this.getHookPaths();
    const nodePath = process.execPath;

    // 1. Register MCP Server
    config.mcpServers = config.mcpServers || {};

    if (runner.includes('tsx')) {
      const tsxPath = path.join(PROJECT_ROOT, 'node_modules/.bin/tsx');
      config.mcpServers.unimem = {
        command: nodePath,
        args: [tsxPath, mcpEntry],
      };
    } else {
      config.mcpServers.unimem = {
        command: nodePath,
        args: [mcpEntry],
      };
    }

    // 2. Register Hooks (including SessionEnd)
    config.hooks = config.hooks || {};

    const createHook = (name: string, arg: string) => ([{
      matcher: '*',
      hooks: [{
        name: `unimem-${name}`,
        type: 'command',
        command: `${runner} ${geminiHookPath} ${arg}`,
      }],
    }]);

    config.hooks.SessionStart = mergeHooks(config.hooks.SessionStart, createHook('session-start', 'session-start'));
    config.hooks.SessionEnd = mergeHooks(config.hooks.SessionEnd, createHook('session-end', 'session-end'));
    config.hooks.BeforeAgent = mergeHooks(config.hooks.BeforeAgent, createHook('before-agent', 'before-agent'));
    config.hooks.AfterTool = mergeHooks(config.hooks.AfterTool, createHook('after-tool', 'after-tool'));

    fs.writeFileSync(this.geminiConfigPath, JSON.stringify(config, null, 2));
    console.log('  MCP server registered in ~/.gemini/settings.json');
    console.log('  Hooks registered: SessionStart, SessionEnd, BeforeAgent, AfterTool');
    console.log('Done.');
  }

  public installClaude() {
    console.log('Installing UniMem into Claude Code...');

    const { runner, claudeHookPath, mcpEntry } = this.getHookPaths();
    const nodePath = process.execPath;

    // 1. Register MCP Server in ~/.mcp.json
    const mcpConfig: any = fs.existsSync(this.claudeMcpPath)
      ? JSON.parse(fs.readFileSync(this.claudeMcpPath, 'utf8'))
      : {};

    mcpConfig.mcpServers = mcpConfig.mcpServers || {};

    if (mcpEntry.endsWith('.ts')) {
      const tsxPath = path.join(PROJECT_ROOT, 'node_modules/.bin/tsx');
      mcpConfig.mcpServers.unimem = {
        command: nodePath,
        args: [tsxPath, mcpEntry],
      };
    } else {
      mcpConfig.mcpServers.unimem = {
        command: nodePath,
        args: [mcpEntry],
      };
    }

    fs.writeFileSync(this.claudeMcpPath, JSON.stringify(mcpConfig, null, 2));
    console.log('  MCP server registered in ~/.mcp.json');

    // 2. Register hooks in ~/.claude/settings.json
    if (!fs.existsSync(this.claudeSettingsDir)) {
      fs.mkdirSync(this.claudeSettingsDir, { recursive: true });
    }

    const claudeSettingsPath = path.join(this.claudeSettingsDir, 'settings.json');
    const claudeSettings: any = fs.existsSync(claudeSettingsPath)
      ? JSON.parse(fs.readFileSync(claudeSettingsPath, 'utf8'))
      : {};

    claudeSettings.hooks = claudeSettings.hooks || {};

    const createClaudeHook = (hookType: string) => ({
      matcher: '*',
      hooks: [{
        type: 'command' as const,
        command: `${runner} ${claudeHookPath} ${hookType}`,
      }],
    });

    // Claude Code hook event names
    const hookEvents = ['SessionStart', 'SessionEnd', 'PostToolUse', 'UserPromptSubmit'];
    for (const event of hookEvents) {
      if (!claudeSettings.hooks[event]) {
        claudeSettings.hooks[event] = [];
      }
      // Remove existing unimem hooks
      claudeSettings.hooks[event] = claudeSettings.hooks[event].filter((h: any) => {
        if (h.hooks && Array.isArray(h.hooks)) {
          h.hooks = h.hooks.filter((inner: any) => !inner.command?.includes('unimem'));
          return h.hooks.length > 0;
        }
        // Single hook object — check command directly
        if (h.command && h.command.includes('unimem')) return false;
        return true;
      });
      claudeSettings.hooks[event].push(createClaudeHook(event));
    }

    fs.writeFileSync(claudeSettingsPath, JSON.stringify(claudeSettings, null, 2));
    console.log('  Hooks registered in ~/.claude/settings.json: SessionStart, SessionEnd, PostToolUse, UserPromptSubmit');
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
