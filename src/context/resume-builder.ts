import { MemoryService } from '../services/MemoryService.js';
import { ResumeContext } from '../types/index.js';
import { HANDOFF_AUTO_DETECT_MINUTES } from '../shared/constants.js';
import { generateSessionId } from '../utils/cli-detector.js';

/**
 * Builds a comprehensive "where we left off" context for a project.
 * This is the core of the handoff protocol.
 */
export async function buildResumeContext(
  memoryService: MemoryService,
  project: string,
  currentCli?: string
): Promise<ResumeContext> {
  const [
    pendingHandoff,
    lastSession,
    recentObs,
    recentSummaries,
  ] = await Promise.all([
    memoryService.getPendingHandoff(project),
    memoryService.getLastActiveSession(project),
    memoryService.getObservationsByProject(project, 10),
    memoryService.getRecentSummaries(project, 3),
  ]);

  const context: ResumeContext = {
    project,
    recent_observations: recentObs.map(o => ({
      id: o.id!,
      type: o.type,
      title: o.title || 'Untitled',
      cli_tool: o.cli_tool,
      created_at: o.created_at,
    })),
    recent_summaries: recentSummaries,
  };

  // Add last session info
  if (lastSession) {
    const agoSeconds = Math.floor(Date.now() / 1000) - lastSession.created_at_epoch;
    const agoMinutes = Math.floor(agoSeconds / 60);
    const agoStr = agoMinutes < 60
      ? `${agoMinutes} min ago`
      : `${Math.floor(agoMinutes / 60)}h ${agoMinutes % 60}m ago`;

    context.last_session = {
      cli: lastSession.cli_tool,
      session_id: lastSession.session_id,
      ended_ago: agoStr,
      reason: lastSession.pause_reason,
    };
  }

  // If there's a pending handoff, enrich context from its snapshot
  if (pendingHandoff) {
    context.pending_handoff = pendingHandoff;
    const snap = pendingHandoff.state_snapshot;
    context.task_summary = snap.task?.request;
    context.completed = snap.completed;
    context.in_progress = snap.in_progress;
    context.next_steps = snap.next_steps;

    if (snap.files_touched) {
      context.files_touched = [
        ...new Set([...(snap.files_touched.read || []), ...(snap.files_touched.modified || [])])
      ];
    }

    // Mark handoff as picked up if we know the current CLI
    if (currentCli && pendingHandoff.id) {
      const newSessionId = generateSessionId(currentCli as any);
      await memoryService.markHandoffPickedUp(pendingHandoff.id, newSessionId, currentCli);

      // Create a new linked session
      await memoryService.createSession({
        session_id: newSessionId,
        project,
        cli_tool: currentCli,
        status: 'active',
        parent_session_id: pendingHandoff.from_session_id,
        user_prompt: `Resumed from ${pendingHandoff.from_cli}: ${snap.task?.request || 'continuation'}`,
        created_at: new Date().toISOString(),
        created_at_epoch: Math.floor(Date.now() / 1000),
      });
    }
  } else {
    // No explicit handoff - check for recent activity (auto-detect)
    const recent = await memoryService.detectRecentActivity(project, HANDOFF_AUTO_DETECT_MINUTES);
    if (recent && recent.cli_tool !== currentCli) {
      // There was recent activity from a different CLI
      const lastSummary = recentSummaries[0];
      if (lastSummary) {
        context.task_summary = lastSummary.request || undefined;
        context.next_steps = lastSummary.next_steps ? [lastSummary.next_steps] : undefined;
      }
    }
  }

  return context;
}
