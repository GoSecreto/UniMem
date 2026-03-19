import { OBS_TYPE_COLORS, OBS_TYPE_BG_COLORS } from '../lib/constants';

export function TypeBadge({ type }: { type: string }) {
  const color = OBS_TYPE_COLORS[type] || '#6b7280';
  const bg = OBS_TYPE_BG_COLORS[type] || 'rgba(107,114,128,0.1)';

  return (
    <span
      className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider"
      style={{ color, backgroundColor: bg }}
    >
      {type}
    </span>
  );
}
