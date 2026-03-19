/**
 * Token Parser Module
 *
 * Reads token usage data from various CLI tools' local storage.
 * Each parser is wrapped in try/catch — missing files return [].
 */
import fs from 'fs';
import path from 'path';
import type { TokenUsageRecord } from '../types/index.js';

const HOME = process.env.HOME || process.env.USERPROFILE || '';

/**
 * Parse Claude Code token usage from ~/.claude/stats-cache.json
 * Format: { dailyModelTokens: { "YYYY-MM-DD": { "model-name": { input, output, cacheRead, cacheWrite } } }, ... }
 */
export function parseClaudeTokens(): TokenUsageRecord[] {
  try {
    const statsPath = path.join(HOME, '.claude', 'stats-cache.json');
    if (!fs.existsSync(statsPath)) return [];

    const raw = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
    const records: TokenUsageRecord[] = [];

    // Parse dailyModelTokens: { "2025-03-15": { "claude-sonnet-4-...": { input, output, cacheRead, cacheWrite } } }
    const dailyTokens = raw.dailyModelTokens || {};
    for (const [date, models] of Object.entries(dailyTokens)) {
      if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) continue;

      for (const [model, usage] of Object.entries(models as Record<string, any>)) {
        const input = usage.input || usage.inputTokens || 0;
        const output = usage.output || usage.outputTokens || 0;
        const cacheRead = usage.cacheRead || usage.cacheReadTokens || 0;
        const cacheWrite = usage.cacheWrite || usage.cacheWriteTokens || 0;

        // Estimate cost based on model
        const cost = estimateClaudeCost(model, input, output, cacheRead, cacheWrite);

        records.push({
          cli_tool: 'claude-code',
          date,
          model,
          input_tokens: input,
          output_tokens: output,
          cache_read_tokens: cacheRead,
          cache_write_tokens: cacheWrite,
          message_count: 0,
          session_count: 0,
          tool_use_count: 0,
          cost_usd: cost,
          source: 'sync',
        });
      }
    }

    // Also check modelUsage for aggregate stats
    const modelUsage = raw.modelUsage || {};
    for (const [model, usage] of Object.entries(modelUsage as Record<string, any>)) {
      if (usage.cost !== undefined && records.length > 0) {
        // Update the latest record for this model with known cost if available
        const latest = records.find(r => r.model === model);
        if (latest && usage.cost > 0) {
          latest.cost_usd = usage.cost;
        }
      }
    }

    return records;
  } catch {
    return [];
  }
}

/**
 * Parse Gemini CLI token usage from ~/.gemini/history/
 * Scans for parseable data in history files.
 */
export function parseGeminiTokens(): TokenUsageRecord[] {
  try {
    const historyDir = path.join(HOME, '.gemini', 'history');
    if (!fs.existsSync(historyDir)) return [];

    const records: TokenUsageRecord[] = [];
    const files = fs.readdirSync(historyDir).filter(f => f.endsWith('.json'));

    const dailyAgg: Record<string, { input: number; output: number; messages: number; sessions: number }> = {};

    for (const file of files.slice(-50)) { // Last 50 files
      try {
        const content = JSON.parse(fs.readFileSync(path.join(historyDir, file), 'utf8'));
        const usage = content.usageMetadata || content.usage || {};
        const input = usage.promptTokenCount || usage.input_tokens || 0;
        const output = usage.candidatesTokenCount || usage.output_tokens || 0;

        if (input === 0 && output === 0) continue;

        // Derive date from file timestamp or content
        const stat = fs.statSync(path.join(historyDir, file));
        const date = stat.mtime.toISOString().split('T')[0];

        if (!dailyAgg[date]) {
          dailyAgg[date] = { input: 0, output: 0, messages: 0, sessions: 0 };
        }
        dailyAgg[date].input += input;
        dailyAgg[date].output += output;
        dailyAgg[date].messages += 1;
      } catch {
        continue;
      }
    }

    for (const [date, agg] of Object.entries(dailyAgg)) {
      records.push({
        cli_tool: 'gemini',
        date,
        model: 'gemini-2.5-pro',
        input_tokens: agg.input,
        output_tokens: agg.output,
        cache_read_tokens: 0,
        cache_write_tokens: 0,
        message_count: agg.messages,
        session_count: agg.sessions,
        tool_use_count: 0,
        cost_usd: 0, // Gemini CLI is free tier
        source: 'sync',
      });
    }

    return records;
  } catch {
    return [];
  }
}

/**
 * Parse Codex CLI token usage from ~/.codex/sessions/ JSONL files.
 */
export function parseCodexTokens(): TokenUsageRecord[] {
  try {
    const sessionsDir = path.join(HOME, '.codex', 'sessions');
    if (!fs.existsSync(sessionsDir)) return [];

    const records: TokenUsageRecord[] = [];
    const files = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.jsonl') || f.endsWith('.json'));

    const dailyAgg: Record<string, { input: number; output: number; messages: number }> = {};

    for (const file of files.slice(-30)) {
      try {
        const lines = fs.readFileSync(path.join(sessionsDir, file), 'utf8').trim().split('\n');
        for (const line of lines) {
          try {
            const entry = JSON.parse(line);
            const usage = entry.usage || {};
            const input = usage.prompt_tokens || usage.input_tokens || 0;
            const output = usage.completion_tokens || usage.output_tokens || 0;

            if (input === 0 && output === 0) continue;

            const stat = fs.statSync(path.join(sessionsDir, file));
            const date = stat.mtime.toISOString().split('T')[0];

            if (!dailyAgg[date]) {
              dailyAgg[date] = { input: 0, output: 0, messages: 0 };
            }
            dailyAgg[date].input += input;
            dailyAgg[date].output += output;
            dailyAgg[date].messages += 1;
          } catch { continue; }
        }
      } catch { continue; }
    }

    for (const [date, agg] of Object.entries(dailyAgg)) {
      records.push({
        cli_tool: 'codex',
        date,
        model: 'codex',
        input_tokens: agg.input,
        output_tokens: agg.output,
        cache_read_tokens: 0,
        cache_write_tokens: 0,
        message_count: agg.messages,
        session_count: 0,
        tool_use_count: 0,
        cost_usd: 0,
        source: 'sync',
      });
    }

    return records;
  } catch {
    return [];
  }
}

function estimateClaudeCost(
  model: string,
  input: number,
  output: number,
  cacheRead: number,
  _cacheWrite: number
): number {
  // Pricing per million tokens (approximate)
  const m = model.toLowerCase();
  let inputRate = 3.0;   // $/M tokens
  let outputRate = 15.0;
  let cacheReadRate = 0.3;

  if (m.includes('haiku')) {
    inputRate = 0.25; outputRate = 1.25; cacheReadRate = 0.03;
  } else if (m.includes('sonnet')) {
    inputRate = 3.0; outputRate = 15.0; cacheReadRate = 0.3;
  } else if (m.includes('opus')) {
    inputRate = 15.0; outputRate = 75.0; cacheReadRate = 1.5;
  }

  return (input * inputRate + output * outputRate + cacheRead * cacheReadRate) / 1_000_000;
}
