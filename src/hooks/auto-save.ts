/**
 * Auto-Save Strategy
 *
 * The PROBLEM: Users don't call memory_handoff before switching CLIs.
 * Rate limits hit mid-response, users close terminal in frustration,
 * and the handoff never happens.
 *
 * The SOLUTION: "Always Be Saving" - 3 layers of automatic state capture:
 *
 * Layer 1: CONTINUOUS (every tool use)
 *   - Every PostToolUse/AfterTool hook saves an observation
 *   - This happens already - it's the baseline
 *
 * Layer 2: PERIODIC (every N prompts)
 *   - Every 3rd user prompt, auto-generate a "rolling summary"
 *   - This captures progress even if session dies mid-work
 *
 * Layer 3: SESSION-END (whenever detectable)
 *   - On SessionEnd/Stop hooks (even with reason="other")
 *   - Parse transcript for rate limit indicators
 *   - Auto-create handoff snapshot from accumulated observations
 *
 * The RECEIVING side auto-detects:
 *   - On any session start, check if another CLI was active in the last 30 min
 *   - If yes, inject context automatically - no user action needed
 *   - This works even without an explicit handoff
 */

import { MemoryService } from '../services/MemoryService.js';
import { deriveProjectName } from '../utils/project-name.js';
import { generateSessionId } from '../utils/cli-detector.js';
import type { CliTool } from '../shared/constants.js';

/**
 * Auto-generate a rolling summary from recent observations.
 * Called periodically (every N prompts) to ensure state is always recoverable.
 */
export async function autoGenerateRollingSummary(
  memoryService: MemoryService,
  sessionId: string,
  project: string,
  cliTool: CliTool
): Promise<void> {
  const recentObs = await memoryService.getObservationsBySession(sessionId);
  if (recentObs.length < 3) return; // Not enough data yet

  // Collect files touched in this session
  const filesRead = new Set<string>();
  const filesModified = new Set<string>();
  for (const obs of recentObs) {
    obs.files_read.forEach(f => filesRead.add(f));
    obs.files_modified.forEach(f => filesModified.add(f));
  }

  // Build summary from observations
  const discoveries = recentObs.filter(o => o.type === 'discovery').map(o => o.title).filter(Boolean);
  const implementations = recentObs.filter(o => o.type === 'implementation').map(o => o.title).filter(Boolean);
  const bugfixes = recentObs.filter(o => o.type === 'bugfix').map(o => o.title).filter(Boolean);

  await memoryService.saveSummary({
    session_id: sessionId,
    project,
    cli_tool: cliTool,
    request: recentObs[recentObs.length - 1]?.title || 'Session work',
    investigated: discoveries.length > 0 ? discoveries.join('; ') : undefined,
    completed: [...implementations, ...bugfixes].join('; ') || undefined,
    learned: discoveries.slice(0, 3).join('; ') || undefined,
    notes: `Auto-generated rolling summary (${recentObs.length} observations)`,
    files_read: [...filesRead],
    files_edited: [...filesModified],
    created_at: new Date().toISOString(),
    created_at_epoch: Math.floor(Date.now() / 1000),
  });
}

/**
 * Auto-create a handoff snapshot from accumulated session data.
 * Called on session end (any reason) to ensure context is always transferable.
 */
export async function autoCreateHandoffOnExit(
  memoryService: MemoryService,
  sessionId: string,
  project: string,
  cliTool: CliTool,
  exitReason?: string
): Promise<void> {
  const recentObs = await memoryService.getObservationsBySession(sessionId);
  if (recentObs.length === 0) return; // Nothing to hand off

  const filesRead = new Set<string>();
  const filesModified = new Set<string>();
  for (const obs of recentObs) {
    obs.files_read.forEach(f => filesRead.add(f));
    obs.files_modified.forEach(f => filesModified.add(f));
  }

  // Determine if this looks like a rate limit
  const reason = detectReason(exitReason);

  await memoryService.createHandoff({
    project,
    from_session_id: sessionId,
    from_cli: cliTool,
    state_snapshot: {
      project,
      from_cli: cliTool,
      timestamp: Math.floor(Date.now() / 1000),
      task: {
        request: recentObs[recentObs.length - 1]?.title || 'Unknown task',
        status: 'interrupted',
      },
      completed: recentObs
        .filter(o => o.type === 'implementation' || o.type === 'bugfix')
        .map(o => o.title || 'Untitled')
        .filter(Boolean),
      in_progress: recentObs
        .filter(o => o.type === 'discovery')
        .slice(0, 3)
        .map(o => o.title || 'Untitled'),
      files_touched: {
        read: [...filesRead],
        modified: [...filesModified],
      },
      recent_observations: recentObs.slice(0, 10).map(o => ({
        id: o.id!,
        title: o.title || 'Untitled',
        type: o.type,
      })),
      notes: `Auto-saved on session exit (${reason}). ${recentObs.length} observations captured.`,
    },
    reason: reason as any,
    created_at_epoch: Math.floor(Date.now() / 1000),
  });

  // Also create the summary
  await autoGenerateRollingSummary(memoryService, sessionId, project, cliTool);
}

/**
 * On session start in ANY CLI, auto-detect if there's recent activity
 * from another CLI and inject context.
 * Returns context markdown if there's something to inject, null otherwise.
 */
export async function autoDetectAndInjectContext(
  memoryService: MemoryService,
  project: string,
  currentCli: CliTool,
  withinMinutes: number = 30
): Promise<string | null> {
  const recentSession = await memoryService.detectRecentActivity(project, withinMinutes);

  if (!recentSession || recentSession.cli_tool === currentCli) {
    return null; // No recent activity from a different CLI
  }

  // There WAS recent activity from a different CLI
  // Check for pending handoff first
  const pendingHandoff = await memoryService.getPendingHandoff(project);
  const recentObs = await memoryService.getObservationsByProject(project, 10);
  const recentSummary = (await memoryService.getRecentSummaries(project, 1))[0];

  const lines: string[] = [];
  lines.push(`## UniMem: Continuing from ${recentSession.cli_tool}`);
  lines.push(`Previous session ended ${formatAgo(recentSession.created_at_epoch)}.`);

  if (pendingHandoff) {
    const snap = pendingHandoff.state_snapshot;
    lines.push(`**Reason**: ${pendingHandoff.reason}`);
    if (snap.completed && snap.completed.length > 0) {
      lines.push('**Completed**: ' + snap.completed.join(', '));
    }
    if (snap.next_steps && snap.next_steps.length > 0) {
      lines.push('**Next steps**: ' + snap.next_steps.join(', '));
    }
  } else if (recentSummary) {
    if (recentSummary.completed) lines.push(`**Completed**: ${recentSummary.completed}`);
    if (recentSummary.next_steps) lines.push(`**Next steps**: ${recentSummary.next_steps}`);
  }

  if (recentObs.length > 0) {
    lines.push('');
    lines.push('**Recent observations**:');
    for (const obs of recentObs.slice(0, 5)) {
      lines.push(`- [${obs.type}] ${obs.title} (${obs.cli_tool})`);
    }
  }

  lines.push('');
  lines.push('Use `memory_resume` for full context.');

  return lines.join('\n');
}

function detectReason(exitReason?: string): string {
  if (!exitReason) return 'manual';
  const lower = exitReason.toLowerCase();
  if (lower.includes('rate') || lower.includes('limit') || lower.includes('429')) return 'rate_limit';
  if (lower.includes('token') || lower.includes('exhaust') || lower.includes('budget')) return 'token_exhausted';
  if (lower.includes('exit') || lower.includes('quit') || lower.includes('close')) return 'manual';
  return 'manual';
}

function formatAgo(epoch: number): string {
  const diff = Math.floor(Date.now() / 1000) - epoch;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
