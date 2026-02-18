import React, { useEffect, useState } from 'react';
import { 
  Clock, 
  CheckCircle2, 
  Terminal, 
  AlertCircle, 
  Sparkles, 
  ExternalLink,
  Cpu,
  ArrowRightLeft,
  Database
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Observation {
  id: number;
  type: string;
  title: string;
  subtitle: string;
  narrative: string;
  cli_tool: string;
  created_at_epoch: number;
}

export const Timeline: React.FC<{ project: string; searchQuery: string }> = ({ project, searchQuery }) => {
  const [observations, setObservations] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchObservations = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/search?project=${encodeURIComponent(project)}&query=${encodeURIComponent(searchQuery)}`);
        if (!response.ok) throw new Error('Failed to fetch data');
        const data = await response.json();
        
        if (Array.isArray(data)) {
          setObservations(data);
          setError(null);
        } else {
          setObservations([]);
        }
      } catch (error) {
        console.error('Failed to fetch observations:', error);
        setError('Database connection offline');
      } finally {
        setLoading(false);
      }
    };

    fetchObservations();
  }, [project]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-32 space-y-6">
      <div className="relative">
        <div className="w-16 h-16 border-2 border-blue-500/20 rounded-full"></div>
        <div className="absolute inset-0 w-16 h-16 border-t-2 border-blue-500 rounded-full animate-spin"></div>
      </div>
      <div className="flex flex-col items-center">
        <p className="text-white font-black tracking-widest uppercase text-xs mb-1">Indexing Neural Mesh</p>
        <p className="text-gray-600 text-[10px] font-bold uppercase tracking-tighter italic">Please stand by...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="max-w-md mx-auto mt-20 p-10 bg-red-500/5 border border-red-500/20 rounded-[2rem] text-center backdrop-blur-sm">
      <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
        <AlertCircle className="w-8 h-8 text-red-500" />
      </div>
      <h3 className="text-xl font-black text-white mb-2 tracking-tight uppercase">System Offline</h3>
      <p className="text-red-400/80 text-sm font-medium leading-relaxed mb-6 px-4">{error}</p>
      <button 
        onClick={() => window.location.reload()}
        className="px-6 py-3 bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-600 transition-all active:scale-95"
      >
        Reinitialize Engine
      </button>
    </div>
  );

  if (observations.length === 0) return (
    <div className="max-w-xl mx-auto mt-20 p-16 text-center border border-white/5 bg-white/[0.01] rounded-[3rem] backdrop-blur-sm relative overflow-hidden group">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/20 to-transparent"></div>
      <div className="w-20 h-20 bg-white/5 rounded-[2rem] flex items-center justify-center mx-auto mb-8 group-hover:scale-110 transition-transform duration-500">
        <Cpu className="w-10 h-10 text-gray-700" />
      </div>
      <h3 className="text-2xl font-black text-white mb-3 tracking-tight">NO PROJECT TRACES</h3>
      <p className="text-gray-500 text-sm font-medium leading-relaxed mb-8 max-w-sm mx-auto">
        UniMem is standing by. Once you begin a task in Claude or Gemini, project intelligence will populate here automatically.
      </p>
      <div className="flex items-center justify-center gap-2 text-[10px] font-bold text-blue-500 uppercase tracking-widest">
        <Sparkles className="w-4 h-4" />
        Awaiting CLI Interaction
      </div>
    </div>
  );

  return (
    <div className="space-y-12">
      {/* Header Info */}
      <div className="flex items-end justify-between px-2">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter mb-2 italic">Intelligence Stream</h1>
          <div className="flex items-center gap-4 text-gray-500">
             <div className="flex items-center gap-2">
               <Clock className="w-4 h-4" />
               <span className="text-[10px] font-bold uppercase tracking-widest">Real-time Feed</span>
             </div>
             <div className="w-1 h-1 bg-gray-800 rounded-full"></div>
             <span className="text-[10px] font-bold uppercase tracking-widest text-blue-500">Project: {project}</span>
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-2">
          <div className="flex -space-x-3">
             <div className="w-10 h-10 rounded-full border-[3px] border-[#0a0a0b] bg-blue-600 flex items-center justify-center text-[11px] text-white font-black shadow-xl">G</div>
             <div className="w-10 h-10 rounded-full border-[3px] border-[#0a0a0b] bg-orange-600 flex items-center justify-center text-[11px] text-white font-black shadow-xl">C</div>
             <div className="w-10 h-10 rounded-full border-[3px] border-[#0a0a0b] bg-[#222] flex items-center justify-center text-[11px] text-gray-400 font-black shadow-xl">
               +{observations.length}
             </div>
          </div>
          <span className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">Aggregated CLI Sources</span>
        </div>
      </div>

      {/* Feed */}
      <div className="grid grid-cols-1 gap-10 relative">
        {/* Modern Progress Line */}
        <div className="absolute left-12 top-0 bottom-0 w-px bg-gradient-to-b from-blue-500/20 via-white/5 to-transparent"></div>
        
        {observations.map((obs) => (
          <div key={obs.id} className="relative flex items-start gap-12 group">
            {/* Action Icon */}
            <div className="relative mt-2 shrink-0">
               <div className={`absolute inset-0 rounded-2xl blur-lg opacity-20 group-hover:opacity-40 transition-opacity ${
                  obs.type === 'bugfix' ? 'bg-red-500' :
                  obs.type === 'implementation' ? 'bg-green-500' :
                  'bg-blue-500'
                }`}></div>
                <div className={`relative w-24 h-24 rounded-[2rem] border border-white/5 flex flex-col items-center justify-center z-10 bg-[#111113] group-hover:bg-[#1a1a1c] transition-colors overflow-hidden ${
                  obs.type === 'bugfix' ? 'text-red-500' :
                  obs.type === 'implementation' ? 'text-green-500' :
                  'text-blue-500'
                }`}>
                  {obs.type === 'bugfix' ? <AlertCircle className="w-8 h-8 mb-2" /> :
                   obs.type === 'implementation' ? <CheckCircle2 className="w-8 h-8 mb-2" /> :
                   <ArrowRightLeft className="w-8 h-8 mb-2 text-indigo-500" />}
                  <span className="text-[9px] font-black uppercase tracking-widest">{obs.type}</span>
                </div>
            </div>
            
            {/* Card Content */}
            <div className="flex-1 min-w-0 pt-2">
              <div className="flex items-center justify-between mb-4 px-2">
                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] shadow-sm ${
                    obs.cli_tool === 'gemini' ? 'bg-blue-600/10 text-blue-500 border border-blue-500/20' : 
                    'bg-orange-600/10 text-orange-500 border border-orange-500/20'
                  }`}>
                    {obs.cli_tool}
                  </span>
                  <div className="w-1.5 h-1.5 bg-gray-800 rounded-full"></div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider italic">
                    {formatDistanceToNow(obs.created_at_epoch * 1000)} ago
                  </span>
                </div>
                <button className="text-gray-700 hover:text-white transition-colors"><ExternalLink className="w-4 h-4" /></button>
              </div>
              
              <div className="bg-[#111113] border border-white/5 rounded-[2.5rem] p-8 hover:bg-[#141416] hover:border-blue-500/20 transition-all duration-500 shadow-2xl group/card">
                <h3 className="text-2xl font-black text-white mb-3 tracking-tight group-hover/card:text-blue-500 transition-colors leading-tight">{obs.title}</h3>
                {obs.subtitle && <p className="text-gray-400 text-sm font-bold mb-6 tracking-tight leading-relaxed">{obs.subtitle}</p>}
                
                {obs.narrative && (
                  <div className="relative mt-4">
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-600/30 rounded-full"></div>
                    <div className="pl-6 font-mono text-sm leading-relaxed text-gray-400 whitespace-pre-wrap selection:bg-blue-500 selection:text-white">
                      {obs.narrative}
                    </div>
                  </div>
                )}
                
                <div className="mt-8 flex items-center gap-4 pt-6 border-t border-white/[0.03]">
                  <div className="px-3 py-1.5 bg-white/[0.03] rounded-xl border border-white/[0.05] flex items-center gap-2">
                    <Database className="w-3 h-3 text-gray-600" />
                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">OBJ-TRACE-{obs.id}</span>
                  </div>
                  <div className="px-3 py-1.5 bg-white/[0.03] rounded-xl border border-white/[0.05] flex items-center gap-2">
                    <Terminal className="w-3 h-3 text-gray-600" />
                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">{obs.cli_tool} V1.4.2</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="h-20 flex items-center justify-center opacity-20 hover:opacity-100 transition-opacity">
        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce mx-1"></div>
        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:0.2s] mx-1"></div>
        <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:0.4s] mx-1"></div>
      </div>
    </div>
  );
};