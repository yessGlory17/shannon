import { Loader2, Check, X, Minus } from 'lucide-react'
import type { SetupStepEvent } from '../../../types'

interface SetupExecuteStepProps {
  steps: SetupStepEvent[]
  isRunning: boolean
  isDone: boolean
  onRun: () => void
}

const stepLabels: Record<string, string> = {
  git_init: 'Initialize Git',
  gitignore: 'Create .gitignore',
  initial_commit: 'Create initial commit',
  done: 'Setup complete',
}

function StepIcon({ status }: { status: string }) {
  switch (status) {
    case 'running':
      return <Loader2 size={14} className="animate-spin text-blue-400" />
    case 'completed':
      return <Check size={14} className="text-emerald-400" />
    case 'failed':
      return <X size={14} className="text-red-400" />
    case 'skipped':
      return <Minus size={14} className="text-zinc-500" />
    default:
      return <Minus size={14} className="text-zinc-600" />
  }
}

export function SetupExecuteStep({ steps, isRunning, isDone, onRun }: SetupExecuteStepProps) {
  return (
    <div className="space-y-4">
      {steps.length === 0 && !isRunning && (
        <div className="text-center py-8">
          <p className="text-sm text-zinc-400 mb-4">
            Ready to set up the project. Click the button below to start.
          </p>
          <button
            onClick={onRun}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-md transition-colors"
          >
            Run Setup
          </button>
        </div>
      )}

      {steps.length > 0 && (
        <div className="space-y-2">
          {steps.map((step, i) => (
            <div
              key={`${step.step}-${i}`}
              className={`flex items-start gap-3 p-3 rounded-md border ${
                step.status === 'failed'
                  ? 'bg-red-600/10 border-red-600/20'
                  : step.status === 'completed'
                  ? 'bg-emerald-600/5 border-emerald-600/20'
                  : step.status === 'running'
                  ? 'bg-blue-600/5 border-blue-600/20'
                  : 'bg-zinc-800/30 border-zinc-700/30'
              }`}
            >
              <div className="mt-0.5">
                <StepIcon status={step.status} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-200">
                  {stepLabels[step.step] || step.step}
                </p>
                <p className={`text-xs mt-0.5 ${
                  step.status === 'failed' ? 'text-red-400' : 'text-zinc-500'
                }`}>
                  {step.message}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {isDone && (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-600/10 border border-emerald-600/20 rounded-md">
          <Check size={14} className="text-emerald-400" />
          <span className="text-xs text-emerald-300">
            Project setup complete. Click Continue to proceed.
          </span>
        </div>
      )}
    </div>
  )
}
