import { CLI_COLORS, CLI_BG_COLORS } from '../lib/constants';

export function CliBadge({ cli }: { cli: string }) {
  const color = CLI_COLORS[cli] || '#6b7280';
  const bg = CLI_BG_COLORS[cli] || 'rgba(107,114,128,0.1)';

  return (
    <span
      className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border"
      style={{ color, backgroundColor: bg, borderColor: `${color}33` }}
    >
      {cli}
    </span>
  );
}
