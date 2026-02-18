import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// This service is in src/services, so project root is 2 levels up
const PROJECT_ROOT = path.resolve(__dirname, '../../');

export class InstallService {
  private geminiConfigPath = path.join(process.env.HOME || '', '.gemini', 'settings.json');
  private claudeConfigPath = path.join(process.env.HOME || '', '.mcp.json');

  public installGemini() {
    if (!fs.existsSync(this.geminiConfigPath)) {
      console.log('Gemini configuration not found at', this.geminiConfigPath);
      return;
    }

    const config = JSON.parse(fs.readFileSync(this.geminiConfigPath, 'utf8'));
    
    // Path to the tsx binary
    const tsxPath = path.join(PROJECT_ROOT, "node_modules/.bin/tsx");
    // Use absolute path for node
    const nodePath = process.execPath;

    // 1. Register MCP Server
    config.mcpServers = config.mcpServers || {};
    config.mcpServers.unimem = {
      command: nodePath,
      args: [tsxPath, path.join(PROJECT_ROOT, "src/index.ts")],
    };

    // 2. Register Hooks (Gemini CLI-specific)
    config.hooksConfig = config.hooksConfig || {};
    config.hooksConfig.enabled = true;

    config.hooks = config.hooks || {};
    const hookPath = path.join(PROJECT_ROOT, "src/hooks/gemini-hook.ts");

    // Clear out old string-based hooks that cause validation errors
    if (typeof config.hooks.sessionStart === 'string') delete config.hooks.sessionStart;
    if (typeof config.hooks.afterTool === 'string') delete config.hooks.afterTool;

    const createHook = (name: string, arg: string) => ([
      {
        matcher: "*",
        hooks: [
          {
            name: `unimem-${name}`,
            type: "command",
            command: `${nodePath} ${tsxPath} ${hookPath} ${arg}`
          }
        ]
      }
    ]);

    config.hooks.SessionStart = createHook("session-start", "session-start");
    config.hooks.BeforeAgent = createHook("before-agent", "before-agent");
    config.hooks.AfterTool = createHook("after-tool", "after-tool");

    fs.writeFileSync(this.geminiConfigPath, JSON.stringify(config, null, 2));
    console.log('✅ UniMem successfully installed into Gemini CLI');
  }

  public installClaude() {
    const claudeConfig: any = fs.existsSync(this.claudeConfigPath) 
      ? JSON.parse(fs.readFileSync(this.claudeConfigPath, 'utf8'))
      : { mcpServers: {} };

    const tsxPath = path.join(PROJECT_ROOT, "node_modules/.bin/tsx");
    const nodePath = process.execPath;

    claudeConfig.mcpServers.unimem = {
      command: nodePath,
      args: [tsxPath, path.join(PROJECT_ROOT, "src/index.ts")],
    };

    fs.writeFileSync(this.claudeConfigPath, JSON.stringify(claudeConfig, null, 2));
    console.log('✅ UniMem successfully installed into Claude Code (MCP)');
  }
}
