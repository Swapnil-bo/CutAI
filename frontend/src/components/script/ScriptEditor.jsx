import { useRef, useEffect } from 'react'
import { FileText, Type } from 'lucide-react'

export default function ScriptEditor({ value, onChange, disabled }) {
  const textareaRef = useRef(null)

  // Auto-resize textarea to content
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.max(400, el.scrollHeight) + 'px'
  }, [value])

  return (
    <div className="relative">
      {/* Editor chrome — mimics screenplay software */}
      <div className="bg-surface-800 border border-surface-700 rounded-xl overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-surface-700/60 bg-surface-850">
          <div className="flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-surface-400" />
            <span className="text-xs font-medium text-surface-400 uppercase tracking-wider">
              Screenplay
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Type className="w-3 h-3 text-surface-500" />
              <span className="text-[10px] font-mono text-surface-500">
                JetBrains Mono
              </span>
            </div>
            {value && (
              <span className="text-[10px] font-mono text-surface-500">
                {value.split('\n').length} lines
              </span>
            )}
          </div>
        </div>

        {/* Textarea — the actual editor */}
        <div className="relative">
          {/* Line numbers gutter */}
          <div className="absolute left-0 top-0 bottom-0 w-12 bg-surface-850/50 border-r border-surface-700/30 pointer-events-none z-10">
            <div className="pt-6 px-2 text-right">
              {(value || '').split('\n').map((_, i) => (
                <div
                  key={i}
                  className="text-[10px] font-mono text-surface-600 leading-[1.7rem] select-none"
                >
                  {i + 1}
                </div>
              ))}
            </div>
          </div>

          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            spellCheck={false}
            placeholder={`INT. COFFEE SHOP - NIGHT

A dimly lit corner booth. Rain streaks down the window.

DETECTIVE COLE sits alone, nursing a cold cup of coffee.
A MANILA ENVELOPE sits unopened on the table.

                    COLE
          (muttering)
    Three years. Three years and it
    comes down to this.

He reaches for the envelope...`}
            className="
              w-full min-h-[400px] bg-transparent text-zinc-300
              font-mono text-[13px] leading-[1.7rem]
              pl-16 pr-6 py-6
              resize-none
              focus:outline-none
              placeholder-surface-600
              disabled:opacity-40 disabled:cursor-not-allowed
              selection:bg-accent-500/20
            "
          />
        </div>
      </div>

      {/* Hint text */}
      <p className="mt-2 text-[11px] text-surface-500 px-1">
        Write in standard screenplay format. INT/EXT sluglines, character names in CAPS, dialogue indented.
      </p>
    </div>
  )
}
