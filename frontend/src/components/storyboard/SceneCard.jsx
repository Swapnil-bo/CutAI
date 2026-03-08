import { forwardRef } from 'react'
import { motion } from 'framer-motion'
import { GripVertical, MapPin, Clock, Image } from 'lucide-react'
import { API_URL } from '../../utils/constants'
import { formatDuration } from '../../utils/helpers'

const MOOD_COLORS = {
  melancholic: { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' },
  thrilling: { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30' },
  romantic: { bg: 'bg-pink-500/15', text: 'text-pink-400', border: 'border-pink-500/30' },
  eerie: { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30' },
  triumphant: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  tense: { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30' },
  ominous: { bg: 'bg-violet-500/15', text: 'text-violet-400', border: 'border-violet-500/30' },
  bittersweet: { bg: 'bg-cyan-500/15', text: 'text-cyan-400', border: 'border-cyan-500/30' },
  neutral: { bg: 'bg-zinc-500/15', text: 'text-zinc-400', border: 'border-zinc-500/30' },
}

function getMoodStyle(mood) {
  const key = (mood || 'neutral').toLowerCase()
  return MOOD_COLORS[key] || MOOD_COLORS.neutral
}

const SceneCard = forwardRef(function SceneCard(
  { scene, isSelected, isDragging, onClick, dragHandleProps, style, ...props },
  ref,
) {
  const mood = scene.mood?.overall_mood || 'neutral'
  const moodStyle = getMoodStyle(mood)
  const totalDuration = (scene.shots || []).reduce((sum, s) => sum + (s.duration_seconds || 0), 0)
  const frameUrl = scene.frame_image_path
    ? `${API_URL}/${scene.frame_image_path.replace(/\\/g, '/')}`
    : null

  return (
    <motion.div
      ref={ref}
      style={style}
      {...props}
      layout
      whileHover={isDragging ? {} : { y: -4, boxShadow: '0 8px 30px rgba(245, 158, 11, 0.12)' }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      className={`
        bg-surface-800 border rounded-xl overflow-hidden cursor-pointer
        transition-colors group relative
        ${isDragging
          ? 'border-accent-500/50 shadow-xl shadow-accent-500/10 z-50 opacity-90'
          : isSelected
            ? 'border-accent-500/40 ring-1 ring-accent-500/20'
            : 'border-surface-700 hover:border-surface-600'
        }
      `}
    >
      {/* Thumbnail area */}
      <div className="aspect-video bg-surface-850 relative overflow-hidden">
        {frameUrl ? (
          <img
            src={frameUrl}
            alt={scene.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center">
            <Image className="w-8 h-8 text-surface-600 mb-1" />
            <span className="text-[10px] text-surface-600 font-mono">No frame</span>
          </div>
        )}

        {/* Scene number badge */}
        <div className="absolute top-2 left-2 w-6 h-6 rounded bg-black/60 backdrop-blur-sm flex items-center justify-center">
          <span className="text-[11px] font-mono font-bold text-zinc-200">
            {scene.scene_number}
          </span>
        </div>

        {/* Drag handle */}
        <div
          {...dragHandleProps}
          className="absolute top-2 right-2 w-6 h-6 rounded bg-black/40 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="w-3.5 h-3.5 text-zinc-300" />
        </div>

        {/* Duration pill */}
        {totalDuration > 0 && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm">
            <Clock className="w-2.5 h-2.5 text-zinc-400" />
            <span className="text-[10px] font-mono text-zinc-300">
              {formatDuration(totalDuration)}
            </span>
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="p-3">
        {/* Title */}
        <h3 className="text-sm font-semibold text-zinc-200 truncate mb-1">
          {scene.title}
        </h3>

        {/* Location slug */}
        {scene.location && (
          <div className="flex items-center gap-1 mb-2">
            <MapPin className="w-3 h-3 text-surface-500 shrink-0" />
            <span className="text-[11px] font-mono text-surface-400 truncate">
              {scene.location}
            </span>
          </div>
        )}

        {/* Bottom row — mood badge + shot count */}
        <div className="flex items-center justify-between">
          <span className={`text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded border ${moodStyle.bg} ${moodStyle.text} ${moodStyle.border}`}>
            {mood}
          </span>
          <span className="text-[10px] font-mono text-surface-500">
            {(scene.shots || []).length} shots
          </span>
        </div>
      </div>
    </motion.div>
  )
})

export default SceneCard
