import { useState, useMemo } from 'react'
import { StepIndicator } from '../common/StepIndicator'
import { SetupStatusStep } from './steps/SetupStatusStep'
import { SetupOptionsStep } from './steps/SetupOptionsStep'
import { SetupExecuteStep } from './steps/SetupExecuteStep'
import { useStepperForm, type StepDefinition } from '../../hooks/useStepperForm'
import { useWailsEvent } from '../../hooks/useWailsEvent'
import type { ProjectSetupStatus, SetupAction, SetupStepEvent } from '../../types'

interface ProjectSetupWizardProps {
  path: string
  status: ProjectSetupStatus
  onComplete: () => void
  onSkip: () => void
}

export function ProjectSetupWizard({ path, status, onComplete, onSkip }: ProjectSetupWizardProps) {
  const [actions, setActions] = useState<SetupAction>({
    init_git: !status.has_git,
    create_gitignore: !status.has_gitignore,
    initial_commit: !status.has_commits,
  })
  const [setupSteps, setSetupSteps] = useState<SetupStepEvent[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [isDone, setIsDone] = useState(false)

  const steps: StepDefinition[] = useMemo(
    () => [
      { label: 'Status' },
      { label: 'Options' },
      { label: 'Setup' },
    ],
    []
  )

  const stepper = useStepperForm(steps)

  // Listen for setup events from backend
  // Merge events by step name so each step shows once with its latest status
  useWailsEvent<SetupStepEvent>('project:setup', (event) => {
    setSetupSteps((prev) => {
      const idx = prev.findIndex((s) => s.step === event.step)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = event
        return next
      }
      return [...prev, event]
    })
    if (event.step === 'done') {
      setIsRunning(false)
      setIsDone(true)
    }
  })

  const handleRunSetup = async () => {
    setIsRunning(true)
    setSetupSteps([])
    setIsDone(false)
    try {
      await window.go.main.App.RunProjectSetup(path, actions)
      // Backend call completed — if done event hasn't arrived via Wails yet, set it now
      setIsRunning(false)
      setIsDone(true)
    } catch (e) {
      console.error('Setup failed:', e)
      setIsRunning(false)
    }
  }

  const noActionsSelected = !actions.init_git && !actions.create_gitignore && !actions.initial_commit

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg flex flex-col" style={{ minHeight: '400px' }}>
      {/* Header */}
      <div className="px-6 pt-5 pb-0">
        <h2 className="text-sm font-medium text-zinc-300 mb-4">Project Setup</h2>
        <StepIndicator
          steps={steps}
          currentStep={stepper.currentStep}
          visitedSteps={stepper.visitedSteps}
          onStepClick={stepper.goToStep}
        />
      </div>

      {/* Step Content */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {stepper.currentStep === 0 && (
          <SetupStatusStep status={status} />
        )}
        {stepper.currentStep === 1 && (
          <SetupOptionsStep
            status={status}
            actions={actions}
            onChange={setActions}
          />
        )}
        {stepper.currentStep === 2 && (
          <SetupExecuteStep
            steps={setupSteps}
            isRunning={isRunning}
            isDone={isDone}
            onRun={handleRunSetup}
          />
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800">
        <div>
          {stepper.canGoBack && !isRunning && (
            <button
              onClick={stepper.goBack}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-md transition-colors"
            >
              Back
            </button>
          )}
        </div>
        <div className="flex gap-2">
          {!isRunning && !isDone && (
            <button
              onClick={onSkip}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-md transition-colors"
            >
              Skip Setup
            </button>
          )}
          {stepper.isLastStep ? (
            isDone ? (
              <button
                onClick={onComplete}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-md transition-colors"
              >
                Continue
              </button>
            ) : null
          ) : (
            <button
              onClick={() => stepper.goNext()}
              disabled={stepper.currentStep === 1 && noActionsSelected}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
