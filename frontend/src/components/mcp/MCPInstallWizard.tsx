import { useState, useMemo, useCallback } from 'react'
import { X } from 'lucide-react'
import { StepIndicator } from '../common/StepIndicator'
import { useStepperForm } from '../../hooks/useStepperForm'
import { SourceStep } from './steps/SourceStep'
import { ConfigureStep } from './steps/ConfigureStep'
import { HealthCheckStep } from './steps/HealthCheckStep'
import { ReviewStep } from './steps/ReviewStep'
import type { MCPWizardData, MCPCatalogItem } from '../../types'

interface MCPInstallWizardProps {
  onClose: () => void
  onComplete: (data: MCPWizardData) => Promise<void>
  prefillFromCatalog?: MCPCatalogItem
}

const defaultWizardData: MCPWizardData = {
  source: 'catalog',
  name: '',
  server_key: '',
  description: '',
  command: '',
  args: [],
  env: {},
  envDefs: [],
  healthResult: undefined,
  healthChecked: false,
  enabled: true,
}

export function MCPInstallWizard({ onClose, onComplete, prefillFromCatalog }: MCPInstallWizardProps) {
  const [data, setData] = useState<MCPWizardData>(() => {
    if (prefillFromCatalog) {
      return {
        ...defaultWizardData,
        source: 'catalog',
        catalogItem: prefillFromCatalog,
        name: prefillFromCatalog.displayName || prefillFromCatalog.qualifiedName,
        server_key: prefillFromCatalog.qualifiedName,
        description: prefillFromCatalog.description,
      }
    }
    return defaultWizardData
  })

  const [saving, setSaving] = useState(false)

  const steps = useMemo(() => [
    {
      label: 'Source',
      validate: () => {
        if (data.source === 'catalog') return !!data.catalogItem
        if (data.source === 'json') return !!data.command
        return true // custom always passes
      },
    },
    {
      label: 'Configure',
      validate: () => !!data.name.trim() && !!data.server_key.trim() && !!data.command.trim(),
    },
    {
      label: 'Test',
      // No validation - user can skip
    },
    {
      label: 'Review',
    },
  ], [data])

  const stepper = useStepperForm(steps)

  const updateData = useCallback((updates: Partial<MCPWizardData>) => {
    setData(prev => ({ ...prev, ...updates }))
  }, [])

  const handleComplete = async () => {
    setSaving(true)
    try {
      await onComplete(data)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#111114] border border-white/[0.08] rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-brand-lg">
        {/* Header */}
        <div className="px-6 pt-5 pb-0 flex items-center justify-between">
          <h2 className="text-lg font-medium text-zinc-100">Add MCP Server</h2>
          <button onClick={onClose} className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-6 pt-4">
          <StepIndicator
            steps={steps}
            currentStep={stepper.currentStep}
            visitedSteps={stepper.visitedSteps}
            onStepClick={stepper.goToStep}
          />
        </div>

        {/* Step content (scrollable) */}
        <div className="flex-1 overflow-auto px-6 py-4">
          {stepper.currentStep === 0 && <SourceStep data={data} onChange={updateData} />}
          {stepper.currentStep === 1 && <ConfigureStep data={data} onChange={updateData} />}
          {stepper.currentStep === 2 && <HealthCheckStep data={data} onChange={updateData} />}
          {stepper.currentStep === 3 && <ReviewStep data={data} onChange={updateData} />}
        </div>

        {/* Navigation footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.06]">
          <div>
            {stepper.canGoBack && (
              <button
                onClick={stepper.goBack}
                className="px-4 py-2 bg-white/[0.06] hover:bg-white/[0.10] text-zinc-300 text-sm rounded-lg transition-colors"
              >
                Back
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white/[0.06] hover:bg-white/[0.10] text-zinc-300 text-sm rounded-lg transition-colors"
            >
              Cancel
            </button>
            {stepper.isLastStep ? (
              <button
                onClick={handleComplete}
                disabled={!data.name.trim() || !data.command.trim() || saving}
                className="px-4 py-2 bg-brand-gradient hover:opacity-90 text-white text-sm font-medium rounded-lg transition-all shadow-brand-sm disabled:opacity-50"
              >
                {saving ? 'Installing...' : 'Install & Activate'}
              </button>
            ) : (
              <button
                onClick={() => {
                  // If on source step with prefill and stepper hasn't visited step 1 yet,
                  // we might need special handling
                  stepper.goNext()
                }}
                className="px-4 py-2 bg-brand-gradient hover:opacity-90 text-white text-sm font-medium rounded-lg transition-all shadow-brand-sm"
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
