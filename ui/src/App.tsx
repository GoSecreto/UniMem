import { useState } from 'react'
import { Timeline } from './components/Timeline'
import { Layers, Activity, Settings, Database } from 'lucide-react'

function App() {
  const [selectedProject] = useState('Memory_Storage')

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-2 text-blue-600 mb-2">
            <Layers className="w-8 h-8" />
            <span className="text-xl font-bold tracking-tight text-gray-900">UniMem</span>
          </div>
          <p className="text-xs text-gray-500 font-medium">Cross-CLI AI Memory Service</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          <a href="#" className="flex items-center gap-3 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg font-medium">
            <Activity className="w-5 h-5" />
            Timeline
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-lg font-medium">
            <Database className="w-5 h-5" />
            Projects
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-lg font-medium">
            <Settings className="w-5 h-5" />
            Settings
          </a>
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="bg-blue-600 text-white p-4 rounded-xl shadow-lg shadow-blue-200">
            <h4 className="font-bold text-sm mb-1">Status</h4>
            <p className="text-xs text-blue-100 mb-3">Server running at port 37888</p>
            <div className="h-1.5 w-full bg-blue-500 rounded-full overflow-hidden">
              <div className="h-full w-3/4 bg-white"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <header className="bg-white border-b border-gray-200 px-8 py-4 sticky top-0 z-20 flex items-center justify-between">
          <div>
            <span className="text-sm font-medium text-gray-500">Active Project</span>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900">{selectedProject}</h2>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             <input 
               type="text" 
               placeholder="Search memories..." 
               className="bg-gray-100 border-transparent focus:bg-white focus:ring-2 focus:ring-blue-500 rounded-lg px-4 py-2 text-sm w-64 transition-all"
             />
             <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shadow-md">
               AG
             </div>
          </div>
        </header>

        <div className="max-w-5xl mx-auto py-8">
          <Timeline project={selectedProject} />
        </div>
      </main>
    </div>
  )
}

export default App
