import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, Film, Folder, Trash2, Clock } from 'lucide-react'
import api from '../services/api'

export default function HomePage() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newGenre, setNewGenre] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    loadProjects()
  }, [])

  async function loadProjects() {
    try {
      const { data } = await api.get('/api/projects')
      setProjects(data)
    } catch {
      // Backend not running — empty list
    } finally {
      setLoading(false)
    }
  }

  async function createProject(e) {
    e.preventDefault()
    if (!newTitle.trim()) return
    try {
      const { data } = await api.post('/api/projects', {
        title: newTitle.trim(),
        genre: newGenre.trim() || null,
      })
      setShowNew(false)
      setNewTitle('')
      setNewGenre('')
      navigate(`/project/${data.id}`)
    } catch {
      // handle error
    }
  }

  async function deleteProject(id, e) {
    e.stopPropagation()
    if (!confirm('Delete this project and all its data?')) return
    await api.delete(`/api/projects/${id}`)
    setProjects((p) => p.filter((proj) => proj.id !== id))
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

      {/* New project form */}
      {showNew && (
        <motion.form
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={createProject}
          className="bg-surface-800 border border-surface-700 rounded-xl p-5 w-full max-w-md mb-10"
        >
          <h3 className="text-sm font-semibold text-zinc-300 mb-4">New Project</h3>
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Project title..."
            className="w-full bg-surface-750 border border-surface-600 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-surface-500 focus:outline-none focus:border-accent-500/50 mb-3"
          />
          <input
            value={newGenre}
            onChange={(e) => setNewGenre(e.target.value)}
            placeholder="Genre (optional)..."
            className="w-full bg-surface-750 border border-surface-600 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-surface-500 focus:outline-none focus:border-accent-500/50 mb-4"
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowNew(false)}
              className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-accent-500 hover:bg-accent-400 text-surface-900 font-semibold text-sm rounded-lg transition-colors"
            >
              Create
            </button>
          </div>
        </motion.form>
      )}

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-3xl">
          {projects.map((project, idx) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => navigate(`/project/${project.id}`)}
              className="bg-surface-800 border border-surface-700 rounded-xl p-4 cursor-pointer group hover:border-accent-500/30 hover:bg-surface-750 transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-8 h-8 rounded-lg bg-surface-700 flex items-center justify-center group-hover:bg-accent-500/10 transition-colors">
                  <Film className="w-4 h-4 text-surface-400 group-hover:text-accent-400 transition-colors" />
                </div>
                <button
                  onClick={(e) => deleteProject(project.id, e)}
                  className="w-7 h-7 rounded flex items-center justify-center text-surface-600 hover:text-film-red hover:bg-film-red/10 transition-all opacity-0 group-hover:opacity-100"
                  title="Delete project"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <h3 className="text-sm font-semibold text-zinc-200 mb-1 truncate">
                {project.title}
              </h3>
              {project.genre && (
                <span className="inline-block text-[10px] font-mono uppercase tracking-wider text-accent-500/70 bg-accent-500/10 px-1.5 py-0.5 rounded mb-2">
                  {project.genre}
                </span>
              )}
              <div className="flex items-center gap-1 text-[11px] text-surface-500 mt-1">
                <Clock className="w-3 h-3" />
                {new Date(project.updated_at).toLocaleDateString()}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
