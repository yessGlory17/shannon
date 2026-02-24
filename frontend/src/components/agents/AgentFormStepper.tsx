import { useState, useEffect, useMemo } from 'react'
import { StepIndicator } from '../common/StepIndicator'
import { BasicInfoStep } from './steps/BasicInfoStep'
import { ToolsPermissionsStep } from './steps/ToolsPermissionsStep'
import { SystemPromptStep } from './steps/SystemPromptStep'
import { useStepperForm, type StepDefinition } from '../../hooks/useStepperForm'

export interface AgentFormData {
  name: string
  description: string
  model: string
  system_prompt: string
  allowed_tools: string[]
  mcp_server_ids: string[]
  permissions: string
}

interface AgentFormStepperProps {
  initialData: AgentFormData
  isEditing: boolean
  onSave: (data: AgentFormData) => void
  onCancel: () => void
}

export function AgentFormStepper({
  initialData,
  isEditing,
  onSave,
  onCancel,
}: AgentFormStepperProps) {
  const [form, setForm] = useState<AgentFormData>(initialData)
  const [nameError, setNameError] = useState(false)

  const steps: StepDefinition[] = useMemo(
    () => [
      {
        label: 'Basic Info',
        validate: () => {
          if (!form.name.trim()) {
            setNameError(true)
            return false
          }
          setNameError(false)
          return true
        },
      },
      { label: 'Tools & Permissions' },
      { label: 'System Prompt' },
    ],
    [form.name]
  )

  const stepper = useStepperForm(steps)

  useEffect(() => {
    if (isEditing) {
      stepper.markAllVisited()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing])

  useEffect(() => {
    setForm(initialData)
    if (!isEditing) {
      stepper.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData])

  const updateForm = (updates: Partial<AgentFormData>) => {
    setForm((prev) => ({ ...prev, ...updates }))
    if (updates.name !== undefined) {
      setNameError(false)
    }
  }

  const handleSave = () => {
    if (!form.name.trim()) {
      stepper.goToStep(0)
      setNameError(true)
      return
    }
    onSave(form)
  }

  return (
    <div className="h-full flex flex-col bg-zinc-900 border border-zinc-800 rounded-lg">
      {/* Step Indicators */}
      <div className="px-6 pt-5 pb-0">
        <StepIndicator
          steps={steps}
          currentStep={stepper.currentStep}
          visitedSteps={stepper.visitedSteps}
          onStepClick={stepper.goToStep}
        />
      </div>

      {/* Step Content - fills available space */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {stepper.currentStep === 0 && (
          <BasicInfoStep
            form={form}
            onChange={updateForm}
            nameError={nameError}
          />
        )}
        {stepper.currentStep === 1 && (
          <ToolsPermissionsStep
            form={form}
            onChange={updateForm}
          />
        )}
        {stepper.currentStep === 2 && (
          <SystemPromptStep
            value={form.system_prompt}
            onChange={(val) => updateForm({ system_prompt: val })}
            agentName={form.name}
            agentDescription={form.description}
          />
        )}
      </div>

      {/* Navigation Buttons - pinned to bottom */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800">
        <div>
          {stepper.canGoBack && (
            <button
              onClick={stepper.goBack}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-md transition-colors"
            >
              Back
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-md transition-colors"
          >
            Cancel
          </button>
          {stepper.isLastStep ? (
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-md transition-colors"
            >
              {isEditing ? 'Update' : 'Create'}
            </button>
          ) : (
            <button
              onClick={() => stepper.goNext()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-md transition-colors"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
