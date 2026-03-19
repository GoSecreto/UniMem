import { useEffect, useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Database } from 'lucide-react';
import { api } from '../lib/api';
import { CliBadge } from './CliBadge';
import { TypeBadge } from './TypeBadge';
import { formatDistanceToNow } from 'date-fns';
import type { Observation } from '../lib/types';

interface MemoryProps {
  project: string;
  searchQuery: string;
}

export function Memory({ project, searchQuery }: MemoryProps) {
  const [observations, setObservations] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [cliFilter, setCliFilter] = useState<string>('all');
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    setLoading(true);
    const fetch = searchQuery
      ? api.search(searchQuery, project)
      : api.getObservations(project, 100);
    fetch.then(setObservations).catch(() => setObservations([])).finally(() => setLoading(false));
  }, [project, searchQuery]);

  const types = useMemo(() => [...new Set(observations.map(o => o.type))].sort(), [observations]);
  const clis = useMemo(() => [...new Set(observations.map(o => o.cli_tool))].sort(), [observations]);

  const filtered = useMemo(() => {
    return observations.filter(o =>
      (typeFilter === 'all' || o.type === typeFilter) &&
      (cliFilter === 'all' || o.cli_tool === cliFilter)
    );
  }, [observations, typeFilter, cliFilter]);

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (loading) return (
    <div className="animate-pulse space-y-2">
      {[1,2,3,4,5].map(i => <div key={i} className="h-12 bg-[#1a1a1d] rounded-lg" />)}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex items-center gap-3">
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="bg-[#1a1a1d] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-gray-300 outline-none focus:border-blue-500/50"
        >
          <option value="all">All Types</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <select
          value={cliFilter}
          onChange={e => setCliFilter(e.target.value)}
          className="bg-[#1a1a1d] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-gray-300 outline-none focus:border-blue-500/50"
        >
          <option value="all">All CLIs</option>
          {clis.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <div className="ml-auto text-[10px] text-gray-500 font-bold uppercase tracking-wider">
          {filtered.length} observation{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Observation List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <Database className="w-10 h-10 mx-auto mb-3 text-gray-700" />
          <p className="text-gray-500 text-sm">
            {searchQuery ? `No results for "${searchQuery}"` : 'No observations yet'}
          </p>
        </div>
      ) : (
        <div className="border border-white/5 rounded-xl overflow-hidden">
          {filtered.map(obs => {
            const expanded = expandedIds.has(obs.id);
            return (
              <div key={obs.id} className="border-b border-white/[0.03] last:border-0">
                <button
                  onClick={() => toggleExpand(obs.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#1a1a1d] transition-colors text-left"
                >
                  {expanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                  )}
                  <TypeBadge type={obs.type} />
                  <span className="text-sm font-medium text-white truncate flex-1">{obs.title}</span>
                  <CliBadge cli={obs.cli_tool} />
                  <span className="text-[10px] text-gray-600 shrink-0">
                    {formatDistanceToNow(obs.created_at_epoch * 1000, { addSuffix: true })}
                  </span>
                </button>

                {expanded && (
                  <div className="px-4 pb-4 ml-8 space-y-2">
                    {obs.subtitle && (
                      <p className="text-xs text-gray-400">{obs.subtitle}</p>
                    )}
                    {obs.narrative && (
                      <div className="bg-[#0f0f10] rounded-lg p-3 text-xs text-gray-400 font-mono whitespace-pre-wrap leading-relaxed">
                        {obs.narrative}
                      </div>
                    )}
                    {obs.files_modified?.length > 0 && (
                      <div className="text-xs text-gray-500">
                        <span className="font-bold">Modified:</span> {obs.files_modified.join(', ')}
                      </div>
                    )}
                    {obs.files_read?.length > 0 && (
                      <div className="text-xs text-gray-500">
                        <span className="font-bold">Read:</span> {obs.files_read.join(', ')}
                      </div>
                    )}
                    <div className="text-[10px] text-gray-600 font-mono">ID: {obs.id} | Session: {obs.session_id}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
