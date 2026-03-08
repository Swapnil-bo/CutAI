import { useLocation, useNavigate } from 'react-router-dom'
import {
  FileText,
  LayoutGrid,
  Clock,
  BarChart3,
  Home,
} from 'lucide-react'

const NAV_ITEMS = [
  { id: 'script', label: 'Script', icon: FileText },
  { id: 'storyboard', label: 'Storyboard', icon: LayoutGrid },
  { id: 'timeline', label: 'Timeline', icon: Clock },
  { id: 'analysis', label: 'Analysis', icon: BarChart3 },
]

export default function Sidebar({ activeTab, onTabChange }) {
  const location = useLocation()
  const navigate = useNavigate()
  const isProjectView = location.pathname.startsWith('/project/')

  return (
    <aside className="w-14 bg-surface-850 border-r border-surface-700 flex flex-col items-center py-3 shrink-0 z-40 relative">
      {/* Home button */}
      <button
        onClick={() => navigate('/')}
        className="w-9 h-9 rounded-lg flex items-center justify-center text-surface-400 hover:text-zinc-200 hover:bg-surface-700 transition-all mb-4"
        title="Projects"
      >
        <Home className="w-4.5 h-4.5" />
      </button>

      {/* Divider */}
      <div className="w-6 h-px bg-surface-700 mb-4" />

      {/* Nav items — only active when inside a project */}
      <nav className="flex flex-col items-center gap-1">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id
          const disabled = !isProjectView

          return (
            <button
              key={id}
              onClick={() => !disabled && onTabChange(id)}
              disabled={disabled}
              title={label}
              className={`
                w-9 h-9 rounded-lg flex items-center justify-center transition-all relative group
                ${disabled
                  ? 'text-surface-600 cursor-not-allowed'
                  : isActive
                    ? 'bg-accent-500/10 text-accent-400'
                    : 'text-surface-400 hover:text-zinc-200 hover:bg-surface-700'
                }
              `}
            >
              <Icon className="w-4.5 h-4.5" />

              {/* Active indicator — film perforation style */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r bg-accent-500" />
              )}

              {/* Tooltip */}
              <span className="absolute left-full ml-2 px-2 py-1 text-xs font-medium bg-surface-700 text-zinc-200 rounded whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity shadow-lg">
                {label}
              </span>
            </button>
          )
        })}
      </nav>

      {/* Bottom film strip decoration */}
      <div className="mt-auto flex flex-col items-center gap-1.5 opacity-15">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="w-3 h-1.5 rounded-[1px] bg-zinc-500" />
        ))}
      </div>
    </aside>
  )
}
