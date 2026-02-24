import { Suspense, lazy, useState } from 'react'
import { Wand2, Loader2, RotateCcw, Check } from 'lucide-react'

const ClaudePromptEditor = lazy(() =>
  import('../editor/ClaudePromptEditor').then((mod) => ({
    default: mod.ClaudePromptEditor,
  }))
)

interface SystemPromptStepProps {
  value: string
  onChange: (value: string) => void
  agentName: string
  agentDescription: string
}

export function SystemPromptStep({ value, onChange, agentName, agentDescription }: SystemPromptStepProps) {
  const [improving, setImproving] = useState(false)
  const [explanation, setExplanation] = useState<string | null>(null)
  const [previousValue, setPreviousValue] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleImprove = async () => {
    setImproving(true)
    setError(null)
    setExplanation(null)
    setPreviousValue(value)
    try {
      const result = await window.go.main.App.ImprovePrompt(value, agentName, agentDescription)
      if (result.improved_prompt) {
        onChange(result.improved_prompt)
        setExplanation(result.explanation)
      }
    } catch (e) {
      console.error('Prompt improve failed:', e)
      setError('Failed to improve prompt. Check that Claude CLI is configured.')
      setPreviousValue(null)
    } finally {
      setImproving(false)
    }
  }

  const handleRevert = () => {
    if (previousValue !== null) {
      onChange(previousValue)
      setPreviousValue(null)
      setExplanation(null)
    }
  }

  const handleAccept = () => {
    setPreviousValue(null)
    setExplanation(null)
  }

  return (
    <div className="h-full flex flex-col gap-2">
      {/* Header with AI button */}
      <div className="flex items-center justify-between">
        <label className="block text-xs text-zinc-500">System Prompt</label>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-600">
            Supports XML tags, Markdown, and {'{{variables}}'}
          </span>
          <button
            onClick={handleImprove}
            disabled={improving}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-600/30 text-xs rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {improving ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Wand2 size={12} />
            )}
            {improving ? 'Improving...' : 'AI Improve'}
          </button>
        </div>
      </div>

      {/* Explanation banner */}
      {explanation && previousValue !== null && (
        <div className="flex items-start gap-3 px-3 py-2.5 bg-violet-600/10 border border-violet-600/20 rounded-md">
          <p className="flex-1 text-xs text-violet-300/80">{explanation}</p>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={handleRevert}
              className="flex items-center gap-1 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-800 hover:bg-zinc-700 rounded transition-colors"
            >
              <RotateCcw size={10} />
              Revert
            </button>
            <button
              onClick={handleAccept}
              className="flex items-center gap-1 px-2 py-1 text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-600/20 hover:bg-emerald-600/30 rounded transition-colors"
            >
              <Check size={10} />
              Keep
            </button>
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="px-3 py-2 bg-red-600/10 border border-red-600/20 rounded-md">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 min-h-[300px]">
        <Suspense
          fallback={
            <div className="h-full bg-zinc-800 border border-zinc-700 rounded-md flex items-center justify-center">
              <span className="text-sm text-zinc-500">Loading editor...</span>
            </div>
          }
        >
          <ClaudePromptEditor value={value} onChange={onChange} height="100%" />
        </Suspense>
      </div>
    </div>
  )
}
