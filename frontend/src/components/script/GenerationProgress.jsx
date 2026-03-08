import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText,
  Search,
  Brain,
  Image,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react'

const STAGE_CONFIG = {
  script:           { icon: FileText,    label: 'Script',      color: 'text-film-blue' },
  parsing:          { icon: Search,      label: 'Parsing',     color: 'text-film-blue' },
  analyzing:        { icon: Brain,       label: 'Analyzing',   color: 'text-accent-500' },
  transition:       { icon: Loader2,     label: 'Switching',   color: 'text-surface-400' },
  loading_sd:       { icon: Image,       label: 'Loading SD',  color: 'text-purple-400' },
  generating_frames:{ icon: Image,       label: 'Generating',  color: 'text-purple-400' },
  unloading_sd:     { icon: Loader2,     label: 'Cleanup',     color: 'text-surface-400' },
}

export default function GenerationProgress({ events, isRunning, error }) {
  const lastEvent = events[events.length - 1]
  const progress = lastEvent?.progress || 0
  const stage = lastEvent?.stage || ''
  const stageConfig = STAGE_CONFIG[stage] || { icon: Loader2, label: '', color: 'text-surface-400' }
  const StageIcon = stageConfig.icon

  return (
    <div className="bg-surface-800 border border-surface-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-surface-700/60 bg-surface-850">
        {isRunning ? (
          <Loader2 className="w-3.5 h-3.5 text-accent-500 animate-spin" />
        ) : error ? (
          <AlertCircle className="w-3.5 h-3.5 text-film-red" />
        ) : (
          <CheckCircle2 className="w-3.5 h-3.5 text-film-green" />
        )}
        <span className="text-xs font-medium text-surface-400 uppercase tracking-wider">
          {isRunning ? 'Generating Storyboard' : error ? 'Generation Failed' : 'Generation Complete'}
        </span>
        {isRunning && (
          <span className="ml-auto text-xs font-mono text-accent-400">
            {progress}%
          </span>
        )}
      </div>

      <div className="p-4">
        {/* Progress bar */}
        <div className="h-1.5 bg-surface-700 rounded-full overflow-hidden mb-4">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-accent-600 to-accent-400"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>

        {/* Current status message */}
        {lastEvent && (
          <div className="flex items-center gap-2.5 mb-4">
            <StageIcon className={`w-4 h-4 ${stageConfig.color} ${isRunning && stage !== 'transition' ? '' : ''}`} />
            <span className="text-sm text-zinc-300">
              {lastEvent.message}
            </span>
          </div>
        )}

        {/* Pipeline steps log */}
        <div className="space-y-1 max-h-48 overflow-y-auto">
          <AnimatePresence>
            {events.map((event, i) => {
              const config = STAGE_CONFIG[event.stage] || { icon: Loader2, color: 'text-surface-400' }
              const Icon = config.icon
              const isLatest = i === events.length - 1

              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex items-center gap-2 py-1 px-2 rounded ${
                    isLatest ? 'bg-surface-750' : ''
                  }`}
                >
                  <Icon className={`w-3 h-3 shrink-0 ${isLatest ? config.color : 'text-surface-500'}`} />
                  <span className={`text-xs font-mono ${isLatest ? 'text-zinc-300' : 'text-surface-500'}`}>
                    {event.message}
                  </span>
                  <span className="ml-auto text-[10px] font-mono text-surface-600">
                    {event.progress}%
                  </span>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>

        {/* Error display */}
        {error && (
          <div className="mt-3 p-3 bg-film-red/10 border border-film-red/20 rounded-lg">
            <p className="text-xs text-film-red font-mono">{error}</p>
          </div>
        )}
      </div>
    </div>
  )
}
