export function StatusIndicator({ online, label }: { online: boolean; label?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-2 h-2 rounded-full ${online ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}
        style={online ? { boxShadow: '0 0 8px #22c55e' } : undefined}
      />
      {label && (
        <span className={`text-xs font-bold uppercase tracking-wider ${online ? 'text-green-500' : 'text-red-500'}`}>
          {label}
        </span>
      )}
    </div>
  );
}
