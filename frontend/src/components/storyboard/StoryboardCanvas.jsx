import { useEffect, useCallback, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { AnimatePresence, motion } from 'framer-motion'
import { LayoutGrid, Plus, AlertTriangle } from 'lucide-react'
import useStoryboardStore from '../../stores/useStoryboardStore'
import SceneCard from './SceneCard'
import ShotPanel from './ShotPanel'

// Wrapper that connects each SceneCard to dnd-kit's sortable system
function SortableSceneCard({ scene, isSelected, onSelect, onDelete }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: scene.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <SceneCard
      ref={setNodeRef}
      scene={scene}
      isSelected={isSelected}
      isDragging={isDragging}
      onClick={() => onSelect(scene.id)}
      dragHandleProps={{ ...attributes, ...listeners }}
      style={style}
      onDelete={onDelete}
    />
  )
}

export default function StoryboardCanvas() {
  const { id: projectId } = useParams()
  const { scenes, loading, selectedSceneId, loadFromProject, selectScene, setScenes, addScene, deleteScene } =
    useStoryboardStore()

  const [deleteTarget, setDeleteTarget] = useState(null)

  useEffect(() => {
    if (projectId) loadFromProject(projectId)
  }, [projectId])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  )

  const handleDragEnd = useCallback(
    (event) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = scenes.findIndex((s) => s.id === active.id)
      const newIndex = scenes.findIndex((s) => s.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return

      const reordered = arrayMove(scenes, oldIndex, newIndex).map((s, i) => ({
        ...s,
        scene_number: i + 1,
      }))

      const scriptId = scenes[0]?.script_id
      if (scriptId) {
        useStoryboardStore.getState().reorderScenes(scriptId, reordered)
      } else {
        setScenes(reordered)
      }
    },
    [scenes, setScenes],
  )

  const selectedScene = scenes.find((s) => s.id === selectedSceneId) || null

  // Get script ID for adding scenes
  const scriptId = scenes[0]?.script_id

  async function handleAddScene() {
    if (!scriptId) return
    await addScene(scriptId)
  }

  function handleDeleteRequest(sceneId) {
    setDeleteTarget(sceneId)
  }

  async function handleDeleteConfirm() {
    if (deleteTarget) {
      await deleteScene(deleteTarget)
      setDeleteTarget(null)
    }
  }

  // Empty state
  if (!loading && scenes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20">
        <div className="w-16 h-16 rounded-2xl bg-surface-800 border border-surface-700 flex items-center justify-center mb-4">
          <LayoutGrid className="w-8 h-8 text-surface-600" />
        </div>
        <h3 className="text-sm font-semibold text-zinc-300 mb-1">
          No scenes yet
        </h3>
        <p className="text-xs text-surface-500 text-center max-w-xs">
          Go to the Script tab to write or generate a script. Scenes will appear here once the storyboard is generated.
        </p>
      </div>
    )
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <div className="text-sm text-surface-500 font-mono animate-pulse">
          Loading storyboard...
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Top bar with add scene */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-surface-400 font-mono">
          {scenes.length} scene{scenes.length !== 1 ? 's' : ''}
        </span>
        {scriptId && (
          <button
            onClick={handleAddScene}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-300 bg-surface-800 hover:bg-surface-750 border border-surface-700 hover:border-accent-500/30 rounded-lg transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Scene
          </button>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={scenes.map((s) => s.id)}
          strategy={rectSortingStrategy}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {scenes.map((scene) => (
              <SortableSceneCard
                key={scene.id}
                scene={scene}
                isSelected={selectedSceneId === scene.id}
                onSelect={selectScene}
                onDelete={handleDeleteRequest}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Shot detail panel — slides in from right */}
      <AnimatePresence>
        {selectedScene && (
          <ShotPanel
            scene={selectedScene}
            onClose={() => selectScene(null)}
          />
        )}
      </AnimatePresence>

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {deleteTarget && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
              onClick={() => setDeleteTarget(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface-800 border border-surface-600 rounded-xl p-6 w-full max-w-sm z-[61] shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-zinc-200">Delete Scene</h3>
                  <p className="text-xs text-surface-400">This cannot be undone.</p>
                </div>
              </div>
              <p className="text-xs text-zinc-400 mb-5">
                This will permanently remove the scene and all its shots from the storyboard.
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  className="px-4 py-1.5 bg-red-500/80 hover:bg-red-500 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
