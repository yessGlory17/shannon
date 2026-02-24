import { useState, useCallback } from 'react'

export interface StepDefinition {
  label: string
  validate?: () => boolean
}

export function useStepperForm(steps: StepDefinition[]) {
  const [currentStep, setCurrentStep] = useState(0)
  const [visitedSteps, setVisitedSteps] = useState<Set<number>>(new Set([0]))

  const canGoNext = currentStep < steps.length - 1
  const canGoBack = currentStep > 0
  const isLastStep = currentStep === steps.length - 1

  const goNext = useCallback(() => {
    const step = steps[currentStep]
    if (step.validate && !step.validate()) return false
    if (!canGoNext) return false
    const next = currentStep + 1
    setCurrentStep(next)
    setVisitedSteps((prev) => new Set(prev).add(next))
    return true
  }, [currentStep, steps, canGoNext])

  const goBack = useCallback(() => {
    if (!canGoBack) return
    setCurrentStep(currentStep - 1)
  }, [currentStep, canGoBack])

  const goToStep = useCallback(
    (index: number) => {
      if (index < 0 || index >= steps.length) return
      if (!visitedSteps.has(index)) return
      if (index > currentStep) {
        for (let i = currentStep; i < index; i++) {
          const step = steps[i]
          if (step.validate && !step.validate()) return
        }
      }
      setCurrentStep(index)
    },
    [currentStep, steps, visitedSteps]
  )

  const reset = useCallback(() => {
    setCurrentStep(0)
    setVisitedSteps(new Set([0]))
  }, [])

  const markAllVisited = useCallback(() => {
    setVisitedSteps(new Set(steps.map((_, i) => i)))
  }, [steps])

  return {
    currentStep,
    visitedSteps,
    canGoNext,
    canGoBack,
    isLastStep,
    goNext,
    goBack,
    goToStep,
    reset,
    markAllVisited,
  }
}
