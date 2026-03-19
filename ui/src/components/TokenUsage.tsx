import { useEffect, useState } from 'react';
import { Coins, RefreshCw, TrendingUp, Cpu } from 'lucide-react';
import { api } from '../lib/api';
import { StatCard } from './StatCard';
import { CliBadge } from './CliBadge';
import { CLI_COLORS } from '../lib/constants';
import type { TokenSummary, TokenUsageRecord } from '../lib/types';

export function TokenUsage() {
  const [summary, setSummary] = useState<TokenSummary[]>([]);
  const [daily, setDaily] = useState<TokenUsageRecord[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      api.getTokenSummary(30),
      api.getDailyTokens(14),
    ]).then(([s, d]) => {
      setSummary(s);
      setDaily(d);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await api.syncTokens();
      fetchData();
    } catch {} finally {
      setSyncing(false);
    }
  };

  if (loading) return <div className="animate-pulse space-y-4"><div className="h-24 bg-[#1a1a1d] rounded-xl" /><div className="h-64 bg-[#1a1a1d] rounded-xl" /></div>;

  const totalCost = summary.reduce((a, s) => a + s.total_cost_usd, 0);
  const totalTokens = summary.reduce((a, s) => a + s.total_input_tokens + s.total_output_tokens, 0);
  const totalMessages = summary.reduce((a, s) => a + s.total_messages, 0);

  // Aggregate daily data by date for bar chart
  const dailyByDate: Record<string, Record<string, number>> = {};
  for (const d of daily) {
    if (!dailyByDate[d.date]) dailyByDate[d.date] = {};
    dailyByDate[d.date][d.cli_tool] = (dailyByDate[d.date][d.cli_tool] || 0) + d.input_tokens + d.output_tokens;
  }
  const dates = Object.keys(dailyByDate).sort();
  const maxDaily = Math.max(1, ...dates.map(d => Object.values(dailyByDate[d]).reduce((a, b) => a + b, 0)));

  return (
    <div className="space-y-6">
      {/* Header with Sync */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Token Usage (30 days)</h2>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-3 py-1.5 bg-[#1a1a1d] border border-white/10 rounded-lg text-xs font-bold text-gray-400 hover:text-white hover:border-white/20 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Sync Now'}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          icon={<Coins className="w-4 h-4" />}
          label="Total Cost"
          value={`$${totalCost.toFixed(2)}`}
          sub={`${summary.length} CLI tool${summary.length !== 1 ? 's' : ''}`}
        />
        <StatCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="Total Tokens"
          value={formatTokens(totalTokens)}
        />
        <StatCard
          icon={<Cpu className="w-4 h-4" />}
          label="Messages"
          value={totalMessages}
        />
      </div>

      {/* Per-CLI Summary */}
      {summary.length > 0 && (
        <div className="bg-[#1a1a1d] border border-white/5 rounded-xl p-5">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Per CLI</h3>
          <div className="space-y-4">
            {summary.map(s => (
              <div key={s.cli_tool} className="flex items-center gap-4">
                <CliBadge cli={s.cli_tool} />
                <div className="flex-1 grid grid-cols-4 gap-4 text-xs">
                  <div>
                    <div className="text-gray-500">Input</div>
                    <div className="text-white font-bold">{formatTokens(s.total_input_tokens)}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Output</div>
                    <div className="text-white font-bold">{formatTokens(s.total_output_tokens)}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Cache Read</div>
                    <div className="text-white font-bold">{formatTokens(s.total_cache_read_tokens)}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Cost</div>
                    <div className="text-white font-bold">${s.total_cost_usd.toFixed(2)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Daily Bar Chart (CSS-only) */}
      {dates.length > 0 && (
        <div className="bg-[#1a1a1d] border border-white/5 rounded-xl p-5">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Daily Tokens (14 days)</h3>
          <div className="flex items-end gap-1 h-40">
            {dates.slice(-14).map(date => {
              const cliTotals = dailyByDate[date];
              const total = Object.values(cliTotals).reduce((a, b) => a + b, 0);
              const heightPct = (total / maxDaily) * 100;

              return (
                <div key={date} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <div
                    className="w-full rounded-t-sm flex flex-col-reverse overflow-hidden transition-all group-hover:opacity-80"
                    style={{ height: `${Math.max(heightPct, 2)}%` }}
                  >
                    {Object.entries(cliTotals).map(([cli, tokens]) => {
                      const segPct = (tokens / total) * 100;
                      return (
                        <div
                          key={cli}
                          style={{
                            height: `${segPct}%`,
                            backgroundColor: CLI_COLORS[cli] || '#6b7280',
                            minHeight: '2px',
                          }}
                        />
                      );
                    })}
                  </div>
                  <span className="text-[8px] text-gray-600 font-bold">{date.slice(5)}</span>

                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#252529] border border-white/10 rounded-lg px-3 py-2 text-[10px] hidden group-hover:block whitespace-nowrap z-10">
                    <div className="font-bold text-white mb-1">{date}</div>
                    {Object.entries(cliTotals).map(([cli, tokens]) => (
                      <div key={cli} className="text-gray-400">{cli}: {formatTokens(tokens)}</div>
                    ))}
                    <div className="text-gray-300 font-bold mt-1">Total: {formatTokens(total)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {summary.length === 0 && (
        <div className="text-center py-12 text-gray-600">
          <Coins className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No token data yet. Click "Sync Now" to pull data from CLI tools.</p>
        </div>
      )}
    </div>
  );
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
