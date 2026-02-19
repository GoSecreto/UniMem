import fs from 'fs';
import path from 'path';
import { CONTEXT_MARKERS } from '../shared/constants.js';
import { logger } from '../shared/logger.js';
import type { CliTool } from '../shared/constants.js';

/**
 * Maps CLI tools to their context file names.
 */
const CLI_CONTEXT_FILES: Record<CliTool, string> = {
  'claude-code': 'CLAUDE.md',
  'gemini': 'GEMINI.md',
  'codex': 'AGENTS.md',
  'copilot': 'AGENTS.md',
  'cursor': '.cursorrules',
  'aider': '.unimem/context.md',
};

/**
 * Write UniMem context to the appropriate CLI context file.
 * Uses UNIMEM:START/END markers to only modify our section.
 */
export function writeContextFile(cwd: string, cliTool: CliTool, contextMarkdown: string): void {
  const fileName = CLI_CONTEXT_FILES[cliTool];
  if (!fileName) return;

  const filePath = path.join(cwd, fileName);

  // Ensure directory exists for nested paths like .unimem/context.md
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  try {
    let existingContent = '';
    if (fs.existsSync(filePath)) {
      existingContent = fs.readFileSync(filePath, 'utf8');
    }

    // Remove any existing UniMem section
    const markerRegex = new RegExp(
      escapeRegex(CONTEXT_MARKERS.START) + '[\\s\\S]*?' + escapeRegex(CONTEXT_MARKERS.END),
      'g'
    );
    const cleanedContent = existingContent.replace(markerRegex, '').trim();

    // Prepend our context (so it appears at the top for maximum visibility)
    const newContent = contextMarkdown + '\n\n' + cleanedContent;
    fs.writeFileSync(filePath, newContent.trim() + '\n');

    logger.info(`Context written to ${filePath}`);
  } catch (err) {
    logger.error(`Failed to write context file: ${filePath}`, err);
  }
}

/**
 * Remove UniMem context from a CLI context file.
 */
export function cleanContextFile(cwd: string, cliTool: CliTool): void {
  const fileName = CLI_CONTEXT_FILES[cliTool];
  if (!fileName) return;

  const filePath = path.join(cwd, fileName);
  if (!fs.existsSync(filePath)) return;

  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const markerRegex = new RegExp(
      escapeRegex(CONTEXT_MARKERS.START) + '[\\s\\S]*?' + escapeRegex(CONTEXT_MARKERS.END),
      'g'
    );
    content = content.replace(markerRegex, '').trim();

    if (content) {
      fs.writeFileSync(filePath, content + '\n');
    }
    // Don't delete the file - it might have user content
  } catch (err) {
    logger.error(`Failed to clean context file: ${filePath}`, err);
  }
}

/**
 * Write context to ALL supported CLI files at once.
 * Useful for ensuring any CLI that starts next will see the context.
 */
export function writeContextToAllClis(cwd: string, contextMarkdown: string): void {
  const clis: CliTool[] = ['claude-code', 'gemini', 'codex'];
  for (const cli of clis) {
    writeContextFile(cwd, cli, contextMarkdown);
  }
  // Also write to the universal .unimem/context.md
  writeContextFile(cwd, 'aider', contextMarkdown);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
