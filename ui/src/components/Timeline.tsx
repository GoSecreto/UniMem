import React, { useEffect, useState } from 'react';
import { Clock, CheckCircle, Search, Terminal, AlertCircle } from 'lucide-react';
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

export const Timeline: React.FC<{ project: string }> = ({ project }) => {
  const [observations, setObservations] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchObservations = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/search?project=${encodeURIComponent(project)}&query=`);
        if (!response.ok) throw new Error('Failed to fetch data');
        const data = await response.json();
        
        // Ensure data is an array before setting state
        if (Array.isArray(data)) {
          setObservations(data);
          setError(null);
        } else {
          setObservations([]);
          console.error('API returned non-array data:', data);
        }
      } catch (error) {
        console.error('Failed to fetch observations:', error);
        setError('Connection error: Make sure the UniMem server is running.');
      } finally {
        setLoading(false);
      }
    };

    fetchObservations();
  }, [project]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-20 space-y-4">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-gray-500 font-medium">Synchronizing memory...</p>
    </div>
  );

  if (error) return (
    <div className="max-w-md mx-auto mt-12 p-6 bg-red-50 border border-red-100 rounded-2xl text-center">
      <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
      <h3 className="text-lg font-bold text-red-900 mb-2">Sync Failed</h3>
      <p className="text-red-700 text-sm mb-4">{error}</p>
      <button 
        onClick={() => window.location.reload()}
        className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors"
      >
        Retry Connection
      </button>
    </div>
  );

  if (observations.length === 0) return (
    <div className="max-w-md mx-auto mt-12 p-12 text-center border-2 border-dashed border-gray-200 rounded-3xl">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <Search className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">No Memory Found</h3>
      <p className="text-gray-500 text-sm">
        Start a session with Claude Code or Gemini CLI to begin capturing project history.
      </p>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-6">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
            <Clock className="w-8 h-8 text-blue-600" />
            Project Feed
          </h1>
          <p className="text-gray-500 mt-1 ml-11">Historical trace for <span className="font-semibold text-gray-700">{project}</span></p>
        </div>
        <div className="bg-white border border-gray-200 shadow-sm px-4 py-2 rounded-2xl flex items-center gap-3">
          <div className="flex -space-x-2">
            <div className="w-8 h-8 rounded-full border-2 border-white bg-blue-500 flex items-center justify-center text-[10px] text-white font-bold">G</div>
            <div className="w-8 h-8 rounded-full border-2 border-white bg-orange-500 flex items-center justify-center text-[10px] text-white font-bold">C</div>
          </div>
          <div className="h-4 w-px bg-gray-200"></div>
          <span className="text-sm font-bold text-gray-900">{observations.length} Events</span>
        </div>
      </div>

      <div className="space-y-12 relative pb-20">
        {/* Timeline connector line */}
        <div className="absolute left-5 top-4 bottom-4 w-0.5 bg-gray-100 hidden sm:block"></div>
        
        {observations.map((obs) => (
          <div key={obs.id} className="relative flex items-start gap-8 group">
            {/* Icon Column */}
            <div className={`mt-1 flex items-center justify-center w-11 h-11 rounded-2xl shadow-sm shrink-0 z-10 transition-transform group-hover:scale-110 duration-200 ${
              obs.type === 'bugfix' ? 'bg-rose-500 text-white shadow-rose-200' :
              obs.type === 'implementation' ? 'bg-emerald-500 text-white shadow-emerald-200' :
              'bg-indigo-600 text-white shadow-indigo-200'
            }`}>
              {obs.type === 'bugfix' ? <AlertCircle className="w-6 h-6" /> :
               obs.type === 'implementation' ? <CheckCircle className="w-6 h-6" /> :
               <Terminal className="w-6 h-6" />}
            </div>
            
            {/* Content Column */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                  obs.cli_tool === 'gemini' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                }`}>
                  {obs.cli_tool}
                </span>
                <div className="h-1 w-1 bg-gray-300 rounded-full"></div>
                <span className="text-xs font-medium text-gray-400">
                  {formatDistanceToNow(obs.created_at_epoch * 1000)} ago
                </span>
              </div>
              
              <div className="bg-white p-6 rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-gray-100 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] hover:border-blue-100 transition-all duration-300">
                <h3 className="text-xl font-bold text-gray-900 mb-2 leading-tight">{obs.title}</h3>
                {obs.subtitle && <p className="text-gray-600 text-sm mb-4 font-medium">{obs.subtitle}</p>}
                
                {obs.narrative && (
                  <div className="text-sm leading-relaxed text-gray-600 bg-gray-50/50 p-4 rounded-2xl border border-gray-100 font-mono">
                    {obs.narrative}
                  </div>
                )}
                
                <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
                  <div className="flex gap-2">
                    <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded">#ID-{obs.id}</span>
                    <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded uppercase">{obs.type}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
