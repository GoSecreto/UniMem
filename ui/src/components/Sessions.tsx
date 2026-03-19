import { useEffect, useState } from 'react';
import { ArrowRightLeft, Clock } from 'lucide-react';
import { api } from '../lib/api';
import { CliBadge } from './CliBadge';
import { CLI_COLORS } from '../lib/constants';
import { formatDistanceToNow } from 'date-fns';
import type { Session, Handoff } from '../lib/types';

interface SessionsProps {
  project: string;
}

export function Sessions({ project }: SessionsProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [handoffs, setHandoffs] = useState<Handoff[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getSessions(project),
      api.getHandoffs(project),
    ]).then(([s, h]) => {
      setSessions(s);
      setHandoffs(h);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [project]);

  if (loading) return <div className="animate-pulse space-y-4"><div className="h-64 bg-[#1a1a1d] rounded-xl" /></div>;

  return (
    <div className="space-y-6">
      {/* Session Chain */}
      <div className="bg-[#1a1a1d] border border-white/5 rounded-xl p-5">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Session Timeline</h3>
        {sessions.length === 0 ? (
          <p className="text-gray-600 text-sm">No sessions recorded yet.</p>
        ) : (
          <div className="relative pl-6">
            {/* Vertical line */}
            <div className="absolute left-2.5 top-2 bottom-2 w-px bg-white/10" />

            <div className="space-y-4">
              {sessions.slice(0, 20).map((session) => {
                const color = CLI_COLORS[session.cli_tool] || '#6b7280';
                const isActive = session.status === 'active';
                return (
                  <div key={session.session_id} className="relative flex items-start gap-4">
                    {/* Node */}
                    <div
                      className="absolute left-[-14px] w-5 h-5 rounded-full border-2 bg-[#0f0f10] shrink-0"
                      style={{ borderColor: color }}
                    >
                      {isActive && (
                        <div
                          className="absolute inset-1 rounded-full animate-pulse"
                          style={{ backgroundColor: color }}
                        />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 ml-4">
                      <div className="flex items-center gap-2 mb-1">
                        <CliBadge cli={session.cli_tool} />
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${
                          isActive ? 'text-green-500' :
                          session.status === 'paused' ? 'text-yellow-500' :
                          'text-gray-500'
                        }`}>
                          {session.status}
                        </span>
                        <span className="text-[10px] text-gray-600">
                          {formatDistanceToNow(session.created_at_epoch * 1000, { addSuffix: true })}
                        </span>
                      </div>
                      <div className="text-xs font-mono text-gray-500 truncate">{session.session_id}</div>
                      {session.pause_reason && (
                        <div className="text-xs text-gray-500 mt-0.5">Reason: {session.pause_reason}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Handoff History */}
      <div className="bg-[#1a1a1d] border border-white/5 rounded-xl p-5">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">
          <ArrowRightLeft className="w-3.5 h-3.5 inline mr-2" />
          Handoff History
        </h3>
        {handoffs.length === 0 ? (
          <p className="text-gray-600 text-sm">No handoffs recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 font-bold uppercase tracking-wider border-b border-white/5">
                  <th className="text-left py-2 pr-4">From</th>
                  <th className="text-left py-2 pr-4">To</th>
                  <th className="text-left py-2 pr-4">Reason</th>
                  <th className="text-left py-2 pr-4">When</th>
                  <th className="text-left py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {handoffs.map(h => (
                  <tr key={h.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                    <td className="py-2 pr-4"><CliBadge cli={h.from_cli} /></td>
                    <td className="py-2 pr-4">
                      {h.to_cli ? <CliBadge cli={h.to_cli} /> : <span className="text-gray-600">—</span>}
                    </td>
                    <td className="py-2 pr-4 text-gray-400">{h.reason}</td>
                    <td className="py-2 pr-4 text-gray-500">
                      <Clock className="w-3 h-3 inline mr-1" />
                      {formatDistanceToNow(h.created_at_epoch * 1000, { addSuffix: true })}
                    </td>
                    <td className="py-2">
                      {h.picked_up_at_epoch ? (
                        <span className="text-green-500 font-bold">Picked up</span>
                      ) : (
                        <span className="text-yellow-500 font-bold">Pending</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
