import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Film,
  Folder,
  Trash2,
  Clock,
  Copy,
  Image,
  LayoutGrid,
  AlertTriangle,
  X,
} from 'lucide-react'
import useProjectStore from '../stores/useProjectStore'
import { API_URL } from '../utils/constants'

export default function HomePage() {
  const { projects, loading, fetchProjects, createProject, deleteProject, duplicateProject } =
    useProjectStore()
  const [showNew, setShowNew] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newGenre, setNewGenre] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    fetchProjects()
  }, [])

  async function handleCreate(e) {
    e.preventDefault()
    if (!newTitle.trim()) return
    try {
      const project = await createProject(newTitle.trim(), newGenre.trim())
      setShowNew(false)
      setNewTitle('')
      setNewGenre('')
      navigate(`/project/${project.id}`)
    } catch {
      // handle error
    }
  }

  function handleDeleteClick(id, e) {
    e.stopPropagation()
    setDeleteTarget(id)
  }

  async function handleDeleteConfirm() {
    if (deleteTarget) {
      await deleteProject(deleteTarget)
      setDeleteTarget(null)
    }
  }

  async function handleDuplicate(id, e) {
    e.stopPropagation()
    try {
      await duplicateProject(id)
    } catch {
      // handle error
    }
  }

  function getProjectThumb(project) {
    if (!project.thumbnail) return null
    return `${API_URL}/${project.thumbnail.replace(/\\/g, '/')}`
  }

  return (
    <div className="min-h-full flex flex-col items-center px-6 py-16">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-12"
      >
        <div className="inline-flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent-500 to-accent-600 flex items-center justify-center shadow-lg shadow-accent-500/25">
            <Film className="w-6 h-6 text-surface-900" strokeWidth={2.5} />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-zinc-100">
            CutAI
          </h1>
        </div>
        <p className="text-zinc-500 text-sm max-w-md">
          AI-powered storyboard engine. Write a script or describe a premise,
          and watch your film come to life shot by shot.
        </p>
      </motion.div>

      {/* New project button */}
      {!showNew && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-accent-500 hover:bg-accent-400 text-surface-900 font-semibold text-sm rounded-lg transition-colors shadow-lg shadow-accent-500/20 mb-10"
        >
          <Plus className="w-4 h-4" />
          New Project
        </motion.button>
      )}

      {/* New project form (modal-style) */}
      <AnimatePresence>
        {showNew && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
              onClick={() => setShowNew(false)}
            />
            <motion.form
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onSubmit={handleCreate}
              onClick={(e) => e.stopPropagation()}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface-800 border border-surface-600 rounded-xl p-6 w-full max-w-md z-[51] shadow-2xl"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-semibold text-zinc-200">New Project</h3>
                <button
                  type="button"
                  onClick={() => setShowNew(false)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-surface-400 hover:text-zinc-200 hover:bg-surface-700 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <label className="block mb-1 text-[11px] text-surface-400 uppercase tracking-wider font-medium">
                Title
              </label>
              <input
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="My Film Project..."
                className="w-full bg-surface-750 border border-surface-600 rounded-lg px-3 py-2.5 text-sm text-zinc-200 placeholder-surface-500 focus:outline-none focus:border-accent-500/50 mb-4"
              />
              <label className="block mb-1 text-[11px] text-surface-400 uppercase tracking-wider font-medium">
                Genre
              </label>
              <input
                value={newGenre}
                onChange={(e) => setNewGenre(e.target.value)}
                placeholder="Noir, Sci-Fi, Drama... (optional)"
                className="w-full bg-surface-750 border border-surface-600 rounded-lg px-3 py-2.5 text-sm text-zinc-200 placeholder-surface-500 focus:outline-none focus:border-accent-500/50 mb-5"
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowNew(false)}
                  className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-accent-500 hover:bg-accent-400 text-surface-900 font-semibold text-sm rounded-lg transition-colors shadow-lg shadow-accent-500/15"
                >
                  Create Project
                </button>
              </div>
            </motion.form>
          </>
        )}
      </AnimatePresence>

      {/* Projects grid */}
      {loading ? (
        <div className="text-surface-500 text-sm font-mono animate-pulse">
          Loading projects...
        </div>
      ) : projects.length === 0 && !showNew ? (
        <div className="text-center text-surface-500 mt-4">
          <Folder className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No projects yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 w-full max-w-4xl">
          {projects.map((project, idx) => {
            const thumbUrl = getProjectThumb(project)
            return (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => navigate(`/project/${project.id}`)}
                className="bg-surface-800 border border-surface-700 rounded-xl overflow-hidden cursor-pointer group hover:border-accent-500/30 hover:shadow-lg hover:shadow-accent-500/5 transition-all"
              >
                {/* Thumbnail area */}
                <div className="aspect-video bg-surface-850 relative overflow-hidden">
                  {thumbUrl ? (
                    <img
                      src={thumbUrl}
                      alt={project.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center">
                      <Film className="w-8 h-8 text-surface-700 mb-1" />
                      <span className="text-[10px] text-surface-600 font-mono">No frames</span>
                    </div>
                  )}

                  {/* Action buttons overlay */}
                  <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => handleDuplicate(project.id, e)}
                      className="w-7 h-7 rounded-lg bg-black/50 backdrop-blur-sm flex items-center justify-center text-zinc-300 hover:text-accent-400 hover:bg-black/70 transition-all"
                      title="Duplicate project"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteClick(project.id, e)}
                      className="w-7 h-7 rounded-lg bg-black/50 backdrop-blur-sm flex items-center justify-center text-zinc-300 hover:text-red-400 hover:bg-black/70 transition-all"
                      title="Delete project"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Scene count badge */}
                  {(project.scene_count > 0) && (
                    <div className="absolute bottom-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm">
                      <LayoutGrid className="w-2.5 h-2.5 text-zinc-400" />
                      <span className="text-[10px] font-mono text-zinc-300">
                        {project.scene_count} scene{project.scene_count !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </div>

                {/* Card body */}
                <div className="p-4">
                  <h3 className="text-sm font-semibold text-zinc-200 mb-1 truncate">
                    {project.title}
                  </h3>
                  <div className="flex items-center justify-between">
                    {project.genre ? (
                      <span className="inline-block text-[10px] font-mono uppercase tracking-wider text-accent-500/70 bg-accent-500/10 px-1.5 py-0.5 rounded">
                        {project.genre}
                      </span>
                    ) : (
                      <span />
                    )}
                    <div className="flex items-center gap-1 text-[11px] text-surface-500">
                      <Clock className="w-3 h-3" />
                      {new Date(project.updated_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

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
                  <h3 className="text-sm font-semibold text-zinc-200">Delete Project</h3>
                  <p className="text-xs text-surface-400">This cannot be undone.</p>
                </div>
              </div>
              <p className="text-xs text-zinc-400 mb-5">
                This will permanently delete the project and all its scripts, scenes, and shots.
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
    </div>
  )
}
