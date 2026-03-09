import { FileText, LayoutGrid, Clock, BarChart3 } from 'lucide-react'
import useProjectStore from '../stores/useProjectStore'
import useUIStore from '../stores/useUIStore'
import ScriptEditor from '../components/script/ScriptEditor'
import ScriptGenerator from '../components/script/ScriptGenerator'
import GenerationProgress from '../components/script/GenerationProgress'
import StoryboardCanvas from '../components/storyboard/StoryboardCanvas'
import VisualTimeline from '../components/timeline/VisualTimeline'
import MoodGraph from '../components/analysis/MoodGraph'
import SoundtrackPanel from '../components/analysis/SoundtrackPanel'
import CameraBreakdown from '../components/analysis/CameraBreakdown'

const TABS = {
  script: { label: 'Script', icon: FileText },
  storyboard: { label: 'Storyboard', icon: LayoutGrid },
  timeline: { label: 'Timeline', icon: Clock },
  analysis: { label: 'Analysis', icon: BarChart3 },
}

export default function ProjectPage() {
  const currentProject = useProjectStore((s) => s.currentProject)

  const activeTab = useUIStore((s) => s.activeTab)
  const scriptMode = useUIStore((s) => s.scriptMode)
  const scriptText = useUIStore((s) => s.scriptText)
  const isGenerating = useUIStore((s) => s.isGenerating)
  const sseEvents = useUIStore((s) => s.sseEvents)
  const genError = useUIStore((s) => s.genError)
  const genResult = useUIStore((s) => s.genResult)
  const setScriptMode = useUIStore((s) => s.setScriptMode)
  const setScriptText = useUIStore((s) => s.setScriptText)
  const startGeneration = useUIStore((s) => s.startGeneration)

  function handleAIGenerate({ genre, premise, numScenes }) {
    startGeneration({
      genre,
      premise,
      num_scenes: numScenes,
      title: currentProject?.title || 'Untitled Project',
    })
  }

  function handleScriptSubmit() {
    if (!scriptText.trim()) return
    startGeneration({
      script_text: scriptText.trim(),
      title: currentProject?.title || 'Untitled Project',
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
                onClick={() => setScriptMode('write')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  scriptMode === 'write'
                    ? 'bg-surface-700 text-zinc-200'
                    : 'text-surface-400 hover:text-zinc-300'
                }`}
              >
                Write Script
              </button>
              <button
                onClick={() => setScriptMode('generate')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  scriptMode === 'generate'
                    ? 'bg-surface-700 text-zinc-200'
                    : 'text-surface-400 hover:text-zinc-300'
                }`}
              >
                AI Generate
              </button>
            </div>

            {/* Write mode */}
            {scriptMode === 'write' && (
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

            {/* Generate mode */}
            {scriptMode === 'generate' && (
              <ScriptGenerator
                onGenerate={handleAIGenerate}
                disabled={isGenerating}
              />
            )}

            {/* Progress indicator */}
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
          <VisualTimeline />
        )}
        {activeTab === 'analysis' && (
          <div className="space-y-6">
            <MoodGraph />
            <CameraBreakdown />
            <SoundtrackPanel />
          </div>
        )}
      </div>
    </div>
  )
}
