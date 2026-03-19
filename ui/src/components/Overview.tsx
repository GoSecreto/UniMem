import { useEffect, useState } from 'react';
import { Database, ArrowRightLeft, Terminal, Zap } from 'lucide-react';
import { api } from '../lib/api';
import { StatCard } from './StatCard';
import { CliBadge } from './CliBadge';
import { TypeBadge } from './TypeBadge';
import { CLI_COLORS } from '../lib/constants';
import { formatDistanceToNow } from 'date-fns';
import type { Observation, Session, Handoff } from '../lib/types';

interface OverviewProps {
  project: string;
}

export function Overview({ project }: OverviewProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [handoffs, setHandoffs] = useState<Handoff[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getSessions(project),
      api.getObservations(project, 20),
      api.getHandoffs(project),
    ]).then(([s, o, h]) => {
      setSessions(s);
      setObservations(o);
      setHandoffs(h);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [project]);

  if (loading) return <LoadingSkeleton />;

  const activeClis = [...new Set(sessions.map(s => s.cli_tool))];
  const recentObs = observations.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          icon={<Terminal className="w-4 h-4" />}
          label="Sessions"
          value={sessions.length}
          sub={`${activeClis.length} CLI tool${activeClis.length !== 1 ? 's' : ''}`}
        />
        <StatCard
          icon={<Database className="w-4 h-4" />}
          label="Observations"
          value={observations.length}
        />
        <StatCard
          icon={<ArrowRightLeft className="w-4 h-4" />}
          label="Handoffs"
          value={handoffs.length}
          sub={handoffs.filter(h => !h.picked_up_at_epoch).length > 0
            ? `${handoffs.filter(h => !h.picked_up_at_epoch).length} pending`
            : undefined}
        />
        <StatCard
          icon={<Zap className="w-4 h-4" />}
          label="Active CLIs"
          value={activeClis.length}
        />
      </div>

      {/* CLI Breakdown */}
      {activeClis.length > 0 && (
        <div className="bg-[#1a1a1d] border border-white/5 rounded-xl p-5">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">CLI Breakdown</h3>
          <div className="space-y-3">
            {activeClis.map(cli => {
              const count = sessions.filter(s => s.cli_tool === cli).length;
              const pct = Math.round((count / sessions.length) * 100);
              const color = CLI_COLORS[cli] || '#6b7280';
              return (
                <div key={cli} className="flex items-center gap-3">
                  <CliBadge cli={cli} />
                  <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </div>
                  <span className="text-xs font-bold text-gray-400 w-16 text-right">{count} sess.</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="bg-[#1a1a1d] border border-white/5 rounded-xl p-5">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Recent Activity</h3>
        {recentObs.length === 0 ? (
          <p className="text-gray-600 text-sm">No observations yet. Start working in a CLI to see activity.</p>
        ) : (
          <div className="space-y-3">
            {recentObs.map(obs => (
              <div key={obs.id} className="flex items-start gap-3 py-2 border-b border-white/[0.03] last:border-0">
                <TypeBadge type={obs.type} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{obs.title}</div>
                  {obs.narrative && (
                    <div className="text-xs text-gray-500 truncate mt-0.5">{obs.narrative}</div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <CliBadge cli={obs.cli_tool} />
                  <span className="text-[10px] text-gray-600">
                    {formatDistanceToNow(obs.created_at_epoch * 1000, { addSuffix: true })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-4 gap-4">
        {[1,2,3,4].map(i => (
          <div key={i} className="bg-[#1a1a1d] border border-white/5 rounded-xl p-4 h-24" />
        ))}
      </div>
      <div className="bg-[#1a1a1d] border border-white/5 rounded-xl p-5 h-40" />
    </div>
  );
}
