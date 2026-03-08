import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { FileText, LayoutGrid, Clock, BarChart3 } from 'lucide-react'
import api from '../services/api'

const TABS = {
  script: { label: 'Script', icon: FileText },
  storyboard: { label: 'Storyboard', icon: LayoutGrid },
  timeline: { label: 'Timeline', icon: Clock },
  analysis: { label: 'Analysis', icon: BarChart3 },
}

export default function ProjectPage({ activeTab }) {
  const { id } = useParams()
  const [project, setProject] = useState(null)

  useEffect(() => {
    api.get(`/api/projects/${id}`)
      .then(({ data }) => setProject(data))
      .catch(() => {})
  }, [id])

  const tab = TABS[activeTab] || TABS.script
  const Icon = tab.icon

  return (
    <div className="h-full flex flex-col">
      {/* Tab header bar */}
      <div className="px-6 pt-5 pb-4 border-b border-surface-700/50">
        <div className="flex items-center gap-2.5">
          <Icon className="w-4.5 h-4.5 text-accent-500" />
          <h2 className="text-base font-semibold text-zinc-200">
            {tab.label}
          </h2>
        </div>
      </div>

      {/* Content area — placeholder panels per tab */}
      <div className="flex-1 p-6 overflow-auto">
        {activeTab === 'script' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-surface-800 border border-surface-700 rounded-xl p-6">
              <p className="text-sm text-surface-400 font-mono text-center">
                Script editor will be built in Step 10
              </p>
            </div>
          </div>
        )}
        {activeTab === 'storyboard' && (
          <div className="text-center py-20">
            <LayoutGrid className="w-10 h-10 text-surface-600 mx-auto mb-3" />
            <p className="text-sm text-surface-400 font-mono">
              Storyboard canvas will be built in Step 11
            </p>
          </div>
        )}
        {activeTab === 'timeline' && (
          <div className="text-center py-20">
            <Clock className="w-10 h-10 text-surface-600 mx-auto mb-3" />
            <p className="text-sm text-surface-400 font-mono">
              Visual timeline will be built in Step 14
            </p>
          </div>
        )}
        {activeTab === 'analysis' && (
          <div className="text-center py-20">
            <BarChart3 className="w-10 h-10 text-surface-600 mx-auto mb-3" />
            <p className="text-sm text-surface-400 font-mono">
              Mood graph & analysis will be built in Step 15
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
