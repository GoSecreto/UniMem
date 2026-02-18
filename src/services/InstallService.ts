import fs from 'fs';
import path from 'path';

export class InstallService {
  private geminiConfigPath = path.join(process.env.HOME || '', '.gemini', 'settings.json');
  private claudeConfigPath = path.join(process.env.HOME || '', '.mcp.json');

  public installGemini() {
    if (!fs.existsSync(this.geminiConfigPath)) {
      console.log('Gemini configuration not found at', this.geminiConfigPath);
      return;
    }

    const config = JSON.parse(fs.readFileSync(this.geminiConfigPath, 'utf8'));
    
    // 1. Register MCP Server
    config.mcpServers = config.mcpServers || {};
    config.mcpServers.unimem = {
      command: "npx",
      args: ["tsx", path.join(process.cwd(), "unimem/src/index.ts")],
    };

    // 2. Register Hooks (Gemini CLI-specific)
    config.hooks = config.hooks || {};
    config.hooks.sessionStart = `npx tsx ${path.join(process.cwd(), "unimem/src/hooks/gemini-hook.ts")} session-start`;
    config.hooks.afterTool = `npx tsx ${path.join(process.cwd(), "unimem/src/hooks/gemini-hook.ts")} after-tool`;

    fs.writeFileSync(this.geminiConfigPath, JSON.stringify(config, null, 2));
    console.log('✅ UniMem successfully installed into Gemini CLI');
  }

  public installClaude() {
    const claudeConfig: any = fs.existsSync(this.claudeConfigPath) 
      ? JSON.parse(fs.readFileSync(this.claudeConfigPath, 'utf8'))
      : { mcpServers: {} };

    claudeConfig.mcpServers.unimem = {
      command: "npx",
      args: ["tsx", path.join(process.cwd(), "unimem/src/index.ts")],
    };

    fs.writeFileSync(this.claudeConfigPath, JSON.stringify(claudeConfig, null, 2));
    console.log('✅ UniMem successfully installed into Claude Code (MCP)');
  }
}
