import { useState, useEffect } from 'react'
import {
  Zap,
  Search,
  ChevronDown,
  LayoutDashboard,
  Coins,
  Terminal,
  Database,
} from 'lucide-react'
import { Overview } from './components/Overview'
import { TokenUsage } from './components/TokenUsage'
import { Sessions } from './components/Sessions'
import { Memory } from './components/Memory'
import { StatusIndicator } from './components/StatusIndicator'
import { api } from './lib/api'

type Tab = 'overview' | 'tokens' | 'sessions' | 'memory'

const TABS: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'tokens', label: 'Tokens', icon: Coins },
  { id: 'sessions', label: 'Sessions', icon: Terminal },
  { id: 'memory', label: 'Memory', icon: Database },
]

function App() {
  const [selectedProject, setSelectedProject] = useState('')
  const [projects, setProjects] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false)
  const [online, setOnline] = useState(true)

  useEffect(() => {
    api.getProjects()
      .then(data => {
        if (Array.isArray(data)) {
          setProjects(data)
          if (data.length > 0 && !selectedProject) {
            setSelectedProject(data[0])
          }
        }
        setOnline(true)
      })
      .catch(() => setOnline(false))
  }, [])

  return (
    <div className="min-h-screen bg-[#0f0f10] text-gray-300 font-sans">
      {/* Top Bar */}
      <header className="h-14 bg-[#0f0f10] border-b border-white/5 px-6 sticky top-0 z-30 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-white fill-current" />
            </div>
            <span className="text-sm font-black tracking-tight text-white uppercase">UniMem</span>
            <span className="text-[9px] font-bold text-blue-500 uppercase tracking-wider">v2</span>
          </div>

          {/* Divider */}
          <div className="w-px h-5 bg-white/10" />

          {/* Project Selector */}
          <div className="relative">
            <button
              onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-bold text-gray-300 hover:bg-white/[0.08] transition-colors"
            >
              {selectedProject || 'Select Project'}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isProjectDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isProjectDropdownOpen && (
              <div className="absolute top-full mt-1 left-0 bg-[#1a1a1d] border border-white/10 rounded-lg shadow-xl z-40 min-w-[180px] py-1">
                {projects.map(p => (
                  <button
                    key={p}
                    onClick={() => { setSelectedProject(p); setIsProjectDropdownOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-xs font-bold hover:bg-white/5 transition-colors ${
                      selectedProject === p ? 'text-blue-500' : 'text-gray-400'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                {projects.length === 0 && (
                  <div className="px-3 py-2 text-xs text-gray-600">No projects</div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && searchQuery) setActiveTab('memory'); }}
              className="bg-white/5 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs w-56 outline-none focus:border-blue-500/50 text-white placeholder:text-gray-600"
            />
          </div>

          {/* Status */}
          <StatusIndicator online={online} label={online ? 'Online' : 'Offline'} />
        </div>
      </header>

      {/* Tab Bar */}
      <div className="border-b border-white/5 px-6 bg-[#0f0f10] sticky top-14 z-20">
        <div className="flex gap-1">
          {TABS.map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${
                  isActive
                    ? 'border-blue-500 text-blue-500'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto py-6 px-6">
        {activeTab === 'overview' && selectedProject && <Overview project={selectedProject} />}
        {activeTab === 'tokens' && <TokenUsage />}
        {activeTab === 'sessions' && selectedProject && <Sessions project={selectedProject} />}
        {activeTab === 'memory' && selectedProject && <Memory project={selectedProject} searchQuery={searchQuery} />}

        {!selectedProject && activeTab !== 'tokens' && (
          <div className="text-center py-20">
            <Database className="w-12 h-12 mx-auto mb-4 text-gray-700" />
            <p className="text-gray-500 text-sm font-medium">Select a project to get started</p>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
