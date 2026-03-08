import { useEffect, useCallback } from 'react'
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
import { LayoutGrid } from 'lucide-react'
import useStoryboardStore from '../../stores/useStoryboardStore'
import SceneCard from './SceneCard'

// Wrapper that connects each SceneCard to dnd-kit's sortable system
function SortableSceneCard({ scene, isSelected, onSelect }) {
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
    />
  )
}

export default function StoryboardCanvas() {
  const { id: projectId } = useParams()
  const { scenes, loading, selectedSceneId, loadFromProject, selectScene, setScenes } =
    useStoryboardStore()

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

      // Find the script_id from the first scene (all scenes share the same script)
      const scriptId = scenes[0]?.script_id
      if (scriptId) {
        useStoryboardStore.getState().reorderScenes(scriptId, reordered)
      } else {
        setScenes(reordered)
      }
    },
    [scenes, setScenes],
  )

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
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
