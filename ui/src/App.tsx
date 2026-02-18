import { useState, useEffect } from 'react'
import { Timeline } from './components/Timeline'
import { 
  Activity, 
  Settings, 
  Database, 
  Terminal, 
  Zap, 
  Command as CommandIcon,
  Search,
  Github,
  ChevronDown
} from 'lucide-react'

function App() {
  const [selectedProject, setSelectedProject] = useState('Memory_Storage')
  const [projects, setProjects] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false)

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await fetch('/api/projects')
        const data = await response.json()
        if (Array.isArray(data)) {
          setProjects(data)
          if (data.length > 0 && selectedProject === 'Memory_Storage' && !data.includes('Memory_Storage')) {
            setSelectedProject(data[0])
          }
        }
      } catch (error) {
        console.error('Failed to fetch projects:', error)
      }
    }
    fetchProjects()
  }, [])

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-gray-300 selection:bg-blue-500/30 font-sans selection:text-white">
      {/* Navigation Sidebar */}
      <div className="fixed inset-y-0 left-0 w-72 bg-[#111113] border-r border-white/5 flex flex-col z-30">
        <div className="p-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.4)]">
              <Zap className="w-6 h-6 text-white fill-current" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black tracking-tighter text-white uppercase italic">UniMem</span>
              <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest leading-none">Intelligence Engine</span>
            </div>
          </div>
        </div>
        
        <div className="px-4 py-2">
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-4 mb-4">Core Interface</div>
          <nav className="space-y-1">
            <button className="w-full flex items-center gap-3 px-4 py-3 bg-white/5 text-white rounded-xl font-semibold transition-all group text-left">
              <Activity className="w-5 h-5 text-blue-500 group-hover:scale-110 transition-transform" />
              Memory Feed
            </button>
            <div className="relative">
              <button 
                onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
                className="w-full flex items-center justify-between px-4 py-3 text-gray-500 hover:text-gray-300 hover:bg-white/[0.02] rounded-xl font-semibold transition-all group"
              >
                <div className="flex items-center gap-3">
                  <Database className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  Projects
                </div>
                <ChevronDown className={`w-4 h-4 transition-transform ${isProjectDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {isProjectDropdownOpen && (
                <div className="mt-2 ml-4 space-y-1 border-l border-white/5 pl-4">
                  {projects.map(p => (
                    <button 
                      key={p}
                      onClick={() => {
                        setSelectedProject(p)
                        setIsProjectDropdownOpen(false)
                      }}
                      className={`w-full text-left px-3 py-2 text-xs font-bold rounded-lg transition-colors ${
                        selectedProject === p ? 'text-blue-500 bg-blue-500/10' : 'text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="w-full flex items-center gap-3 px-4 py-3 text-gray-500 hover:text-gray-300 hover:bg-white/[0.02] rounded-xl font-semibold transition-all group text-left">
              <Terminal className="w-5 h-5 group-hover:scale-110 transition-transform" />
              CLI Terminal
            </button>
          </nav>
        </div>

        <div className="mt-auto p-6 space-y-4">
          <div className="bg-gradient-to-br from-blue-600/10 to-transparent border border-blue-500/20 p-5 rounded-2xl">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_#22c55e]"></div>
              <span className="text-xs font-bold text-green-500 uppercase tracking-wider">Engine Active</span>
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed font-medium">
              Node listener operational on port <span className="text-blue-400">37888</span>. Intercepting lifecycle hooks.
            </p>
          </div>
          
          <div className="flex items-center justify-between px-2">
            <a href="https://github.com" className="text-gray-600 hover:text-white transition-colors"><Github className="w-5 h-5" /></a>
            <button className="text-gray-600 hover:text-white transition-colors"><Settings className="w-5 h-5" /></button>
          </div>
        </div>
      </div>

      {/* Main Experience */}
      <main className="pl-72 flex-1 min-h-screen">
        <header className="h-20 bg-[#0a0a0b]/80 backdrop-blur-xl border-b border-white/5 px-12 sticky top-0 z-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Active Workspace</span>
                <div className="w-1 h-1 bg-gray-700 rounded-full"></div>
                <span className="text-xs font-bold text-blue-500">Localhost</span>
              </div>
              <h2 className="text-lg font-black text-white tracking-tight">{selectedProject}</h2>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
             <div className="relative group">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-blue-500 transition-colors" />
               <input 
                 type="text" 
                 placeholder="Search project knowledge..." 
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 className="bg-white/5 border border-white/5 focus:bg-white/[0.08] focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 rounded-xl pl-10 pr-4 py-2.5 text-sm w-80 transition-all outline-none text-white placeholder:text-gray-600 font-medium"
               />
               <kbd className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-[10px] font-bold text-gray-500">⌘K</kbd>
             </div>
             
             <div className="flex items-center gap-3 pl-6 border-l border-white/5">
                <div className="flex flex-col items-end">
                  <span className="text-xs font-bold text-white tracking-tight">Akanksha G.</span>
                  <span className="text-[10px] font-bold text-gray-600 uppercase">Core Developer</span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-sm font-black shadow-lg shadow-blue-500/20">
                  AG
                </div>
             </div>
          </div>
        </header>

        <div className="max-w-6xl mx-auto py-12 px-12">
          <Timeline project={selectedProject} searchQuery={searchQuery} />
        </div>
      </main>

      {/* Global Shortcut Listener Overlay (UI Only) */}
      <div className="fixed bottom-8 right-8 flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-full shadow-2xl shadow-blue-500/40 text-white text-xs font-bold cursor-pointer hover:scale-105 transition-transform">
        <CommandIcon className="w-4 h-4" />
        <span>Quick Handoff</span>
      </div>
    </div>
  )
}

export default App
