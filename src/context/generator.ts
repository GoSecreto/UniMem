import { ResumeContext, Observation, SessionSummary } from '../types/index.js';
import { CONTEXT_MARKERS, MAX_CONTEXT_CHARS, MAX_RECENT_OBSERVATIONS } from '../shared/constants.js';

/**
 * Generate a markdown context block from resume data.
 * This is CLI-agnostic - the file-writer handles per-CLI specifics.
 */
export function generateContextMarkdown(context: ResumeContext): string {
  const lines: string[] = [];
  const timestamp = new Date().toISOString();

  lines.push(CONTEXT_MARKERS.START);
  lines.push(`<!-- UniMem Context | Project: ${context.project} | Generated: ${timestamp} -->`);
  lines.push('');

  // Session Continuity
  if (context.last_session) {
    lines.push('## Session Continuity');
    lines.push(`**Previous CLI**: ${context.last_session.cli} (${context.last_session.ended_ago}${context.last_session.reason ? `, paused: ${context.last_session.reason}` : ''})`);

    if (context.task_summary) {
      lines.push(`**Task**: ${context.task_summary}`);
    }
    lines.push('');
  }

  // Pending Handoff Alert
  if (context.pending_handoff) {
    lines.push('## Pending Handoff');
    lines.push(`A **${context.pending_handoff.from_cli}** session was paused (reason: ${context.pending_handoff.reason}).`);
    lines.push('Use `memory_resume` MCP tool for full context, or continue from the information below.');
    lines.push('');
  }

  // Completed items
  if (context.completed && context.completed.length > 0) {
    lines.push('### Completed');
    for (const item of context.completed) {
      lines.push(`- ${item}`);
    }
    lines.push('');
  }

  // In progress items
  if (context.in_progress && context.in_progress.length > 0) {
    lines.push('### In Progress');
    for (const item of context.in_progress) {
      lines.push(`- ${item}`);
    }
    lines.push('');
  }

  // Next steps
  if (context.next_steps && context.next_steps.length > 0) {
    lines.push('### Next Steps');
    context.next_steps.forEach((step, i) => {
      lines.push(`${i + 1}. ${step}`);
    });
    lines.push('');
  }

  // Files touched
  if (context.files_touched && context.files_touched.length > 0) {
    lines.push('### Files Involved');
    for (const file of context.files_touched.slice(0, 15)) {
      lines.push(`- \`${file}\``);
    }
    if (context.files_touched.length > 15) {
      lines.push(`- ... and ${context.files_touched.length - 15} more`);
    }
    lines.push('');
  }

  // Recent observations table
  if (context.recent_observations.length > 0) {
    const shown = context.recent_observations.slice(0, MAX_RECENT_OBSERVATIONS);
    lines.push(`## Recent Activity (${shown.length} of ${context.recent_observations.length} observations)`);
    lines.push('');
    lines.push('| Time | CLI | Type | Title | ID |');
    lines.push('|------|-----|------|-------|----|');
    for (const obs of shown) {
      const time = formatRelativeTime(obs.created_at);
      lines.push(`| ${time} | ${obs.cli_tool} | ${obs.type} | ${obs.title} | #${obs.id} |`);
    }
    lines.push('');
  }

  // Recent summaries
  if (context.recent_summaries.length > 0) {
    const summary = context.recent_summaries[0];
    lines.push('## Last Session Summary');
    if (summary.request) lines.push(`**Request**: ${summary.request}`);
    if (summary.learned) lines.push(`**Learned**: ${summary.learned}`);
    if (summary.completed) lines.push(`**Completed**: ${summary.completed}`);
    if (summary.next_steps) lines.push(`**Next Steps**: ${summary.next_steps}`);
    lines.push('');
  }

  lines.push('<!-- Use `memory_search` MCP tool to query full history -->');
  lines.push('<!-- Use `memory_resume` MCP tool for detailed continuation context -->');
  lines.push(CONTEXT_MARKERS.END);

  // Token budget check
  let result = lines.join('\n');
  if (result.length > MAX_CONTEXT_CHARS) {
    // Truncate to fit budget, keeping header and footer
    const header = lines.slice(0, 8).join('\n');
    const footer = lines.slice(-3).join('\n');
    const budget = MAX_CONTEXT_CHARS - header.length - footer.length - 100;
    const middle = result.substring(header.length, header.length + budget);
    result = header + middle + '\n\n... (truncated for context budget)\n\n' + footer;
  }

  return result;
}

function formatRelativeTime(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}
