import { useState } from 'react'
import { Sparkles, ChevronDown } from 'lucide-react'

const GENRES = [
  'noir',
  'thriller',
  'sci-fi',
  'romance',
  'horror',
  'comedy',
  'drama',
  'action',
  'mystery',
  'western',
]

export default function ScriptGenerator({ onGenerate, disabled }) {
  const [genre, setGenre] = useState('noir')
  const [premise, setPremise] = useState('')
  const [numScenes, setNumScenes] = useState(5)

  function handleSubmit(e) {
    e.preventDefault()
    if (!premise.trim() || disabled) return
    onGenerate({ genre, premise: premise.trim(), numScenes })
  }

  return (
    <form onSubmit={handleSubmit} className="bg-surface-800 border border-surface-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-surface-700/60 bg-surface-850">
        <Sparkles className="w-3.5 h-3.5 text-accent-500" />
        <span className="text-xs font-medium text-surface-400 uppercase tracking-wider">
          AI Script Generator
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Genre + Scenes row */}
        <div className="flex gap-3">
          {/* Genre select */}
          <div className="flex-1">
            <label className="block text-[11px] font-medium text-surface-400 uppercase tracking-wider mb-1.5">
              Genre
            </label>
            <div className="relative">
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                disabled={disabled}
                className="
                  w-full bg-surface-750 border border-surface-600 rounded-lg
                  px-3 py-2 text-sm text-zinc-200
                  appearance-none cursor-pointer
                  focus:outline-none focus:border-accent-500/50
                  disabled:opacity-40 disabled:cursor-not-allowed
                "
              >
                {GENRES.map((g) => (
                  <option key={g} value={g}>
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-400 pointer-events-none" />
            </div>
          </div>

          {/* Num scenes */}
          <div className="w-28">
            <label className="block text-[11px] font-medium text-surface-400 uppercase tracking-wider mb-1.5">
              Scenes
            </label>
            <div className="relative">
              <select
                value={numScenes}
                onChange={(e) => setNumScenes(Number(e.target.value))}
                disabled={disabled}
                className="
                  w-full bg-surface-750 border border-surface-600 rounded-lg
                  px-3 py-2 text-sm text-zinc-200
                  appearance-none cursor-pointer
                  focus:outline-none focus:border-accent-500/50
                  disabled:opacity-40 disabled:cursor-not-allowed
                "
              >
                {[3, 4, 5, 6, 7].map((n) => (
                  <option key={n} value={n}>{n} scenes</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Premise */}
        <div>
          <label className="block text-[11px] font-medium text-surface-400 uppercase tracking-wider mb-1.5">
            Premise
          </label>
          <textarea
            value={premise}
            onChange={(e) => setPremise(e.target.value)}
            disabled={disabled}
            rows={3}
            placeholder="A burnt-out detective receives a mysterious letter that reopens a cold case from 10 years ago..."
            className="
              w-full bg-surface-750 border border-surface-600 rounded-lg
              px-3 py-2.5 text-sm text-zinc-200
              placeholder-surface-500 resize-none
              focus:outline-none focus:border-accent-500/50
              disabled:opacity-40 disabled:cursor-not-allowed
            "
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={!premise.trim() || disabled}
          className="
            w-full flex items-center justify-center gap-2
            px-4 py-2.5 rounded-lg text-sm font-semibold
            bg-accent-500 hover:bg-accent-400 text-surface-900
            transition-colors
            disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-accent-500
            shadow-lg shadow-accent-500/15
          "
        >
          <Sparkles className="w-4 h-4" />
          Generate Script
        </button>
      </div>
    </form>
  )
}
