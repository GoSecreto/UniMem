import type { ReactNode } from 'react';

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  sub?: string;
}

export function StatCard({ icon, label, value, sub }: StatCardProps) {
  return (
    <div className="bg-[#1a1a1d] border border-white/5 rounded-xl p-4 hover:bg-[#252529] transition-colors">
      <div className="flex items-center gap-2 mb-2 text-gray-500">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-black text-white tracking-tight">{value}</div>
      {sub && <div className="text-[11px] text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}
