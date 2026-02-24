import { Check } from 'lucide-react'

interface StepIndicatorProps {
  steps: { label: string }[]
  currentStep: number
  visitedSteps: Set<number>
  onStepClick: (index: number) => void
}

export function StepIndicator({
  steps,
  currentStep,
  visitedSteps,
  onStepClick,
}: StepIndicatorProps) {
  return (
    <div className="flex items-center mb-6">
      {steps.map((step, index) => {
        const isActive = index === currentStep
        const isCompleted = visitedSteps.has(index) && index < currentStep
        const isClickable = visitedSteps.has(index)

        return (
          <div key={index} className="flex items-center flex-1 last:flex-none">
            <button
              onClick={() => isClickable && onStepClick(index)}
              disabled={!isClickable}
              className={`flex items-center gap-2 ${
                isClickable ? 'cursor-pointer' : 'cursor-default'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-emerald-600 text-white'
                    : isCompleted
                    ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/40'
                    : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
                }`}
              >
                {isCompleted ? <Check size={12} /> : index + 1}
              </div>
              <span
                className={`text-xs font-medium whitespace-nowrap ${
                  isActive ? 'text-zinc-200' : isCompleted ? 'text-zinc-400' : 'text-zinc-500'
                }`}
              >
                {step.label}
              </span>
            </button>
            {index < steps.length - 1 && (
              <div
                className={`flex-1 h-px mx-4 ${
                  isCompleted ? 'bg-emerald-600/40' : 'bg-zinc-700'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
