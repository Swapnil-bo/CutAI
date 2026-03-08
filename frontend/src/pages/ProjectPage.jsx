import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { FileText, LayoutGrid, Clock, BarChart3 } from 'lucide-react'
import api from '../services/api'
import { API_URL } from '../utils/constants'
import ScriptEditor from '../components/script/ScriptEditor'
import ScriptGenerator from '../components/script/ScriptGenerator'
import GenerationProgress from '../components/script/GenerationProgress'
import StoryboardCanvas from '../components/storyboard/StoryboardCanvas'

const TABS = {
  script: { label: 'Script', icon: FileText },
  storyboard: { label: 'Storyboard', icon: LayoutGrid },
  timeline: { label: 'Timeline', icon: Clock },
  analysis: { label: 'Analysis', icon: BarChart3 },
}

export default function ProjectPage({ activeTab, onProjectLoad }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState(null)

  // Script tab state
  const [scriptText, setScriptText] = useState('')
  const [mode, setMode] = useState('write') // 'write' | 'generate'
  const [isGenerating, setIsGenerating] = useState(false)
  const [sseEvents, setSseEvents] = useState([])
  const [genError, setGenError] = useState(null)
  const [genResult, setGenResult] = useState(null)

  useEffect(() => {
    api.get(`/api/projects/${id}`)
      .then(({ data }) => {
        setProject(data)
        if (onProjectLoad) onProjectLoad(data)
      })
      .catch(() => {})
  }, [id])

  // SSE consumer for storyboard generation
  const startGeneration = useCallback(async (payload) => {
    setIsGenerating(true)
    setSseEvents([])
    setGenError(null)
    setGenResult(null)

    try {
      const response = await fetch(`${API_URL}/api/storyboard/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        // Keep the last incomplete line in the buffer
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))
            if (event.type === 'progress') {
              setSseEvents((prev) => [...prev, event])
            } else if (event.type === 'complete') {
              setSseEvents((prev) => [...prev, { stage: 'complete', message: event.message, progress: 100 }])
              setGenResult(event.data)
            } else if (event.type === 'error') {
              setGenError(event.message)
            }
          } catch {
            // skip malformed SSE lines
          }
        }
      }
    } catch (err) {
      setGenError(err.message || 'Connection failed')
    } finally {
      setIsGenerating(false)
    }
  }, [])

  // Handle "Generate Script" from the AI generator panel
  function handleAIGenerate({ genre, premise, numScenes }) {
    startGeneration({
      genre,
      premise,
      num_scenes: numScenes,
      title: project?.title || 'Untitled Project',
    })
  }

  // Handle "Generate from Script" — user has written their own script
  function handleScriptSubmit() {
    if (!scriptText.trim()) return
    startGeneration({
      script_text: scriptText.trim(),
      title: project?.title || 'Untitled Project',
    })
  }

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

      {/* Content area */}
      <div className="flex-1 p-6 overflow-auto">
        {activeTab === 'script' && (
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Mode toggle */}
            <div className="flex items-center gap-1 bg-surface-850 border border-surface-700 rounded-lg p-1 w-fit">
              <button
                onClick={() => setMode('write')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  mode === 'write'
                    ? 'bg-surface-700 text-zinc-200'
                    : 'text-surface-400 hover:text-zinc-300'
                }`}
              >
                Write Script
              </button>
              <button
                onClick={() => setMode('generate')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  mode === 'generate'
                    ? 'bg-surface-700 text-zinc-200'
                    : 'text-surface-400 hover:text-zinc-300'
                }`}
              >
                AI Generate
              </button>
            </div>

            {/* Write mode — script editor + submit button */}
            {mode === 'write' && (
              <>
                <ScriptEditor
                  value={scriptText}
                  onChange={setScriptText}
                  disabled={isGenerating}
                />
                {scriptText.trim() && (
                  <button
                    onClick={handleScriptSubmit}
                    disabled={isGenerating}
                    className="
                      flex items-center justify-center gap-2 w-full
                      px-4 py-2.5 rounded-lg text-sm font-semibold
                      bg-accent-500 hover:bg-accent-400 text-surface-900
                      transition-colors shadow-lg shadow-accent-500/15
                      disabled:opacity-40 disabled:cursor-not-allowed
                    "
                  >
                    <LayoutGrid className="w-4 h-4" />
                    Generate Storyboard from Script
                  </button>
                )}
              </>
            )}

            {/* Generate mode — AI generator panel */}
            {mode === 'generate' && (
              <ScriptGenerator
                onGenerate={handleAIGenerate}
                disabled={isGenerating}
              />
            )}

            {/* Progress indicator — shown during generation */}
            {(isGenerating || sseEvents.length > 0) && (
              <GenerationProgress
                events={sseEvents}
                isRunning={isGenerating}
                error={genError}
              />
            )}

            {/* Result summary */}
            {genResult && !isGenerating && (
              <div className="bg-surface-800 border border-film-green/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-film-green" />
                  <span className="text-sm font-semibold text-zinc-200">
                    Storyboard Ready
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-surface-750 rounded-lg p-3">
                    <div className="text-lg font-bold text-accent-400 font-mono">
                      {genResult.num_scenes}
                    </div>
                    <div className="text-[10px] text-surface-400 uppercase tracking-wider">
                      Scenes
                    </div>
                  </div>
                  <div className="bg-surface-750 rounded-lg p-3">
                    <div className="text-lg font-bold text-purple-400 font-mono">
                      {genResult.total_frames}
                    </div>
                    <div className="text-[10px] text-surface-400 uppercase tracking-wider">
                      Frames
                    </div>
                  </div>
                  <div className="bg-surface-750 rounded-lg p-3">
                    <div className="text-xs font-medium text-zinc-300 truncate">
                      {genResult.genre}
                    </div>
                    <div className="text-[10px] text-surface-400 uppercase tracking-wider">
                      Genre
                    </div>
                  </div>
                </div>
                <p className="text-xs text-surface-400 mt-3 italic">
                  {genResult.logline}
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'storyboard' && (
          <StoryboardCanvas />
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
