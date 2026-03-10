import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Camera,
  Move,
  Clock,
  MessageSquare,
  MapPin,
  Hash,
  Pencil,
  Check,
  RefreshCw,
  Loader2,
  Wand2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { formatDuration } from '../../utils/helpers'
import FramePreview from './FramePreview'
import { API_URL } from '../../utils/constants'
import useStoryboardStore from '../../stores/useStoryboardStore'

// Film-industry color coding for shot types
const SHOT_TYPE_STYLE = {
  'wide':              { bg: 'bg-blue-500/15',   text: 'text-blue-400',   border: 'border-blue-500/30' },
  'close-up':          { bg: 'bg-red-500/15',    text: 'text-red-400',    border: 'border-red-500/30' },
  'medium':            { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  'over-the-shoulder': { bg: 'bg-amber-500/15',  text: 'text-amber-400',  border: 'border-amber-500/30' },
  'POV':               { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30' },
  'aerial':            { bg: 'bg-cyan-500/15',   text: 'text-cyan-400',   border: 'border-cyan-500/30' },
  'tracking':          { bg: 'bg-pink-500/15',   text: 'text-pink-400',   border: 'border-pink-500/30' },
}

const ANGLE_STYLE = {
  'eye-level':   { bg: 'bg-zinc-500/15',   text: 'text-zinc-400',   border: 'border-zinc-500/30' },
  'low-angle':   { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30' },
  'high-angle':  { bg: 'bg-sky-500/15',    text: 'text-sky-400',    border: 'border-sky-500/30' },
  'dutch-angle': { bg: 'bg-violet-500/15', text: 'text-violet-400', border: 'border-violet-500/30' },
  "bird's-eye":  { bg: 'bg-teal-500/15',   text: 'text-teal-400',   border: 'border-teal-500/30' },
}

const MOVEMENT_LABELS = {
  'static':    'Static',
  'pan-left':  'Pan L',
  'pan-right': 'Pan R',
  'tilt-up':   'Tilt Up',
  'tilt-down': 'Tilt Dn',
  'dolly-in':  'Dolly In',
  'dolly-out': 'Dolly Out',
  'crane':     'Crane',
}

function getBadgeStyle(map, key) {
  const k = (key || '').toLowerCase()
  return map[k] || { bg: 'bg-zinc-500/15', text: 'text-zinc-400', border: 'border-zinc-500/30' }
}

// Backdrop overlay
const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
}

// Panel slide
const panelVariants = {
  hidden: { x: '100%' },
  visible: { x: 0, transition: { type: 'spring', damping: 30, stiffness: 300 } },
  exit: { x: '100%', transition: { duration: 0.2 } },
}

// Stagger children
const listVariants = {
  visible: { transition: { staggerChildren: 0.06 } },
}

const itemVariants = {
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.25 } },
}

export default function ShotPanel({ scene, onClose }) {
  const panelRef = useRef(null)
  const [editingDesc, setEditingDesc] = useState(false)
  const [descText, setDescText] = useState(scene.description || '')
  const descRef = useRef(null)

  const updateScene = useStoryboardStore((s) => s.updateScene)
  const regenerateFrame = useStoryboardStore((s) => s.regenerateFrame)
  const updateShotPrompt = useStoryboardStore((s) => s.updateShotPrompt)
  const regenerating = useStoryboardStore((s) => s.regenerating)
  const isRegenerating = regenerating === scene.id

  // Update local description state when scene changes
  useEffect(() => {
    setDescText(scene.description || '')
    setEditingDesc(false)
  }, [scene.id])

  // Close on click outside
  useEffect(() => {
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  // Close on Escape
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  if (!scene) return null

  const shots = scene.shots || []

  async function handleDescSave() {
    const trimmed = descText.trim()
    if (trimmed !== (scene.description || '')) {
      await updateScene(scene.id, { description: trimmed })
    }
    setEditingDesc(false)
  }

  async function handleRegenerateFrame() {
    await regenerateFrame(scene.id)
  }

  return (
    <AnimatePresence>
      {scene && (
        <>
          {/* Backdrop */}
          <motion.div
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40"
          />

          {/* Panel */}
          <motion.div
            ref={panelRef}
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed top-0 right-0 bottom-0 w-full max-w-lg bg-surface-850/95 backdrop-blur-xl border-l border-surface-700 shadow-2xl z-50 flex flex-col"
          >
            {/* Regenerating overlay */}
            {isRegenerating && (
              <div className="absolute inset-0 bg-surface-900/60 backdrop-blur-sm z-30 flex flex-col items-center justify-center">
                <Loader2 className="w-8 h-8 text-accent-500 animate-spin mb-3" />
                <span className="text-xs font-mono text-accent-400">Regenerating...</span>
              </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-surface-700/60 shrink-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-mono font-bold text-accent-500 bg-accent-500/10 px-1.5 py-0.5 rounded">
                    Scene {scene.scene_number}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-zinc-100 truncate">
                  {scene.title}
                </h3>
                {scene.location && (
                  <div className="flex items-center gap-1 mt-1">
                    <MapPin className="w-3 h-3 text-surface-500" />
                    <span className="text-[11px] font-mono text-surface-400">
                      {scene.location}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-3">
                <button
                  onClick={handleRegenerateFrame}
                  disabled={isRegenerating}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-surface-400 hover:text-accent-400 hover:bg-accent-500/10 transition-all"
                  title="Regenerate frame"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-surface-400 hover:text-zinc-200 hover:bg-surface-700 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Scene description — editable */}
            <div className="px-5 pt-4 shrink-0">
              {editingDesc ? (
                <div className="mb-3">
                  <textarea
                    ref={descRef}
                    value={descText}
                    onChange={(e) => setDescText(e.target.value)}
                    rows={3}
                    className="w-full bg-surface-800 border border-accent-500/40 rounded-lg px-3 py-2 text-xs text-zinc-300 leading-relaxed focus:outline-none focus:border-accent-500 resize-none"
                  />
                  <div className="flex gap-2 justify-end mt-1">
                    <button
                      onClick={() => { setEditingDesc(false); setDescText(scene.description || '') }}
                      className="text-[10px] text-surface-400 hover:text-zinc-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDescSave}
                      className="text-[10px] text-accent-400 hover:text-accent-300 font-semibold"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => setEditingDesc(true)}
                  className="mb-3 p-2.5 bg-surface-800/50 border border-surface-700/40 rounded-lg cursor-pointer hover:border-accent-500/20 transition-colors group/desc"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs text-zinc-400 leading-relaxed flex-1">
                      {scene.description || 'Click to add description...'}
                    </p>
                    <Pencil className="w-3 h-3 text-surface-500 group-hover/desc:text-accent-400 shrink-0 mt-0.5 transition-colors" />
                  </div>
                </div>
              )}
            </div>

            {/* Scene frame preview */}
            <div className="px-5 shrink-0">
              <FramePreview
                framePath={scene.frame_image_path}
                alt={scene.title}
              />
            </div>

            {/* Shot list */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="flex items-center gap-2 mb-3">
                <Camera className="w-3.5 h-3.5 text-surface-400" />
                <span className="text-xs font-medium text-surface-400 uppercase tracking-wider">
                  {shots.length} Shot{shots.length !== 1 ? 's' : ''}
                </span>
              </div>

              <motion.div
                variants={listVariants}
                initial="hidden"
                animate="visible"
                className="space-y-3"
              >
                {shots.map((shot) => (
                  <ShotItem
                    key={shot.id || shot.shot_number}
                    shot={shot}
                    sceneId={scene.id}
                    updateShotPrompt={updateShotPrompt}
                  />
                ))}
              </motion.div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}


function ShotItem({ shot, sceneId, updateShotPrompt }) {
  const [showPrompt, setShowPrompt] = useState(false)
  const [editingPrompt, setEditingPrompt] = useState(false)
  const [promptText, setPromptText] = useState(shot.sd_prompt || '')

  const typeStyle = getBadgeStyle(SHOT_TYPE_STYLE, shot.shot_type)
  const angleStyle = getBadgeStyle(ANGLE_STYLE, shot.camera_angle)
  const movementLabel = MOVEMENT_LABELS[shot.camera_movement] || shot.camera_movement
  const frameUrl = shot.sd_prompt
    ? `${API_URL}/generated/frames/scene_${sceneId}_shot_${shot.shot_number}.png`
    : null

  async function handlePromptSave() {
    const trimmed = promptText.trim()
    if (trimmed && trimmed !== shot.sd_prompt) {
      await updateShotPrompt(shot.id, trimmed)
    }
    setEditingPrompt(false)
  }

  return (
    <motion.div
      variants={itemVariants}
      className="bg-surface-800 border border-surface-700/60 rounded-xl p-4"
    >
      {/* Shot header — number + badges */}
      <div className="flex items-center flex-wrap gap-2 mb-3">
        <div className="flex items-center gap-1">
          <Hash className="w-3 h-3 text-surface-500" />
          <span className="text-xs font-mono font-bold text-zinc-300">
            {shot.shot_number}
          </span>
        </div>

        {/* Shot type badge */}
        <span className={`text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded border ${typeStyle.bg} ${typeStyle.text} ${typeStyle.border}`}>
          {shot.shot_type}
        </span>

        {/* Camera angle badge */}
        <span className={`text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded border ${angleStyle.bg} ${angleStyle.text} ${angleStyle.border}`}>
          {shot.camera_angle}
        </span>

        {/* Camera movement */}
        <span className="flex items-center gap-1 text-[10px] font-mono text-surface-400 bg-surface-750 px-1.5 py-0.5 rounded">
          <Move className="w-2.5 h-2.5" />
          {movementLabel}
        </span>

        {/* Duration */}
        <span className="flex items-center gap-1 text-[10px] font-mono text-surface-400 ml-auto">
          <Clock className="w-2.5 h-2.5" />
          {formatDuration(shot.duration_seconds || 0)}
        </span>
      </div>

      {/* Shot frame thumbnail */}
      <div className="aspect-video bg-surface-850 rounded-lg border border-surface-700/40 overflow-hidden mb-3">
        <img
          src={frameUrl}
          alt={`Shot ${shot.shot_number}`}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={(e) => {
            e.target.style.display = 'none'
            e.target.parentElement.innerHTML = '<div class="w-full h-full flex items-center justify-center text-surface-600 text-[10px] font-mono">No frame</div>'
          }}
        />
      </div>

      {/* Description */}
      <p className="text-xs text-zinc-300 leading-relaxed mb-2">
        {shot.description}
      </p>

      {/* Dialogue */}
      {shot.dialogue && (
        <div className="flex gap-2 mt-2 p-2.5 bg-surface-750 rounded-lg border border-surface-700/40">
          <MessageSquare className="w-3 h-3 text-accent-500 shrink-0 mt-0.5" />
          <p className="text-xs font-mono text-accent-300/80 italic leading-relaxed">
            "{shot.dialogue}"
          </p>
        </div>
      )}

      {/* SD Prompt section */}
      <div className="mt-3 pt-3 border-t border-surface-700/40">
        <button
          onClick={() => setShowPrompt(!showPrompt)}
          className="flex items-center gap-1.5 text-[10px] font-mono text-surface-500 hover:text-accent-400 transition-colors w-full"
        >
          <Wand2 className="w-3 h-3" />
          <span>SD Prompt</span>
          {showPrompt ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
        </button>

        {showPrompt && (
          <div className="mt-2">
            {editingPrompt ? (
              <div>
                <textarea
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  rows={3}
                  className="w-full bg-surface-850 border border-accent-500/40 rounded-lg px-3 py-2 text-[11px] font-mono text-zinc-400 leading-relaxed focus:outline-none focus:border-accent-500 resize-none"
                />
                <div className="flex gap-2 justify-end mt-1">
                  <button
                    onClick={() => { setEditingPrompt(false); setPromptText(shot.sd_prompt || '') }}
                    className="text-[10px] text-surface-400 hover:text-zinc-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePromptSave}
                    className="text-[10px] text-accent-400 hover:text-accent-300 font-semibold"
                  >
                    Save Prompt
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => { setEditingPrompt(true); setPromptText(shot.sd_prompt || '') }}
                className="p-2 bg-surface-850 border border-surface-700/40 rounded-lg cursor-pointer hover:border-accent-500/20 transition-colors"
              >
                <p className="text-[11px] font-mono text-surface-500 leading-relaxed">
                  {shot.sd_prompt || 'No prompt — click to add'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}
