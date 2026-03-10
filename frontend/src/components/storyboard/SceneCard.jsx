import { forwardRef, useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  GripVertical,
  MapPin,
  Clock,
  Image,
  Pencil,
  Check,
  X,
  Trash2,
  RefreshCw,
  Loader2,
} from 'lucide-react'
import { API_URL } from '../../utils/constants'
import { formatDuration } from '../../utils/helpers'
import useStoryboardStore from '../../stores/useStoryboardStore'

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
  { scene, isSelected, isDragging, onClick, dragHandleProps, style, onDelete, ...props },
  ref,
) {
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(scene.title)
  const titleRef = useRef(null)
  const updateScene = useStoryboardStore((s) => s.updateScene)
  const regenerateScene = useStoryboardStore((s) => s.regenerateScene)
  const regenerating = useStoryboardStore((s) => s.regenerating)
  const isRegenerating = regenerating === scene.id

  const mood = scene.mood?.overall_mood || 'neutral'
  const moodStyle = getMoodStyle(mood)
  const totalDuration = (scene.shots || []).reduce((sum, s) => sum + (s.duration_seconds || 0), 0)
  const frameUrl = scene.frame_image_path
    ? `${API_URL}/${scene.frame_image_path.replace(/\\/g, '/')}`
    : null

  useEffect(() => {
    if (editing && titleRef.current) {
      titleRef.current.focus()
      titleRef.current.select()
    }
  }, [editing])

  function handleEditStart(e) {
    e.stopPropagation()
    setEditTitle(scene.title)
    setEditing(true)
  }

  async function handleEditSave(e) {
    e.stopPropagation()
    const trimmed = editTitle.trim()
    if (trimmed && trimmed !== scene.title) {
      await updateScene(scene.id, { title: trimmed })
    }
    setEditing(false)
  }

  function handleEditCancel(e) {
    e.stopPropagation()
    setEditing(false)
    setEditTitle(scene.title)
  }

  function handleEditKeyDown(e) {
    if (e.key === 'Enter') handleEditSave(e)
    if (e.key === 'Escape') handleEditCancel(e)
  }

  async function handleRegenerate(e) {
    e.stopPropagation()
    await regenerateScene(scene.id)
  }

  function handleDeleteClick(e) {
    e.stopPropagation()
    if (onDelete) onDelete(scene.id)
  }

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
      {/* Regenerating overlay */}
      {isRegenerating && (
        <div className="absolute inset-0 bg-surface-900/70 backdrop-blur-sm z-30 flex flex-col items-center justify-center">
          <Loader2 className="w-6 h-6 text-accent-500 animate-spin mb-2" />
          <span className="text-[10px] font-mono text-accent-400">Regenerating...</span>
        </div>
      )}

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

        {/* Action buttons on hover */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleRegenerate}
            disabled={isRegenerating}
            className="w-6 h-6 rounded bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-accent-500/30 transition-colors"
            title="Regenerate scene"
          >
            <RefreshCw className="w-3 h-3 text-zinc-300" />
          </button>
          <button
            onClick={handleDeleteClick}
            className="w-6 h-6 rounded bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-red-500/30 transition-colors"
            title="Delete scene"
          >
            <Trash2 className="w-3 h-3 text-zinc-300" />
          </button>
        </div>
      </div>

      {/* Card body */}
      <div className="p-3">
        {/* Title — inline editable */}
        {editing ? (
          <div className="flex items-center gap-1 mb-1" onClick={(e) => e.stopPropagation()}>
            <input
              ref={titleRef}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={handleEditKeyDown}
              className="flex-1 bg-surface-750 border border-accent-500/40 rounded px-1.5 py-0.5 text-sm text-zinc-200 focus:outline-none focus:border-accent-500"
            />
            <button
              onClick={handleEditSave}
              className="w-5 h-5 flex items-center justify-center text-film-green hover:text-green-400"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleEditCancel}
              className="w-5 h-5 flex items-center justify-center text-surface-400 hover:text-zinc-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1 mb-1 group/title">
            <h3 className="text-sm font-semibold text-zinc-200 truncate flex-1">
              {scene.title}
            </h3>
            <button
              onClick={handleEditStart}
              className="w-5 h-5 shrink-0 flex items-center justify-center text-surface-500 hover:text-accent-400 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Edit title"
            >
              <Pencil className="w-3 h-3" />
            </button>
          </div>
        )}

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
