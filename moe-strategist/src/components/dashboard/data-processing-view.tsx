'use client'

import { useState } from 'react'
import { ProcessingSidebar } from './processing-sidebar'
import { DataInputPanel } from './data-input-panel'
import { ProcessingStep } from './processing-step'
import { ResultsStep } from './results-step'
import { DataProcessingDashboard } from './data-processing-dashboard'
import type { InputData } from '@/types/database'
import type { ModuleType } from '@/types/modules'

interface DataProcessingViewProps {
  moduleType?: ModuleType | null
  onClose?: () => void
}

export function DataProcessingView({ moduleType, onClose }: DataProcessingViewProps = {}) {
  // If a specific module was selected from a card, render the rich dashboard
  if (moduleType) {
    return (
      <DataProcessingDashboard
        moduleType={moduleType}
        onClose={onClose ?? (() => {})}
      />
    )
  }

  // ── Default generic 3-step flow (Scenario / Economic / Meeting / Upload) ──

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1)
  const [inputData, setInputData] = useState<InputData>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)

  const handleInputContinue = (data: InputData) => {
    setInputData(data)
    setCurrentStep(2)
  }

  const handleProcessingComplete = (sid: string | null) => {
    setSessionId(sid)
    setCurrentStep(3)
  }

  const handleReset = () => {
    setInputData(null)
    setSessionId(null)
    setCurrentStep(1)
  }

  // Allow clicking a completed step to go back
  const handleStepClick = (step: 1 | 2 | 3) => {
    if (step < currentStep) {
      if (step === 1) handleReset()
    }
  }

  return (
    <div className="flex h-[calc(100vh-64px)] bg-gradient-to-br from-amber-50 via-amber-50/80 to-amber-100 dark:from-background dark:via-background dark:to-background overflow-hidden">
      {/* Fixed sidebar */}
      <ProcessingSidebar currentStep={currentStep} onStepClick={handleStepClick} />

      {/* Scrollable main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8 min-h-full">
          {currentStep === 1 && (
            <DataInputPanel onContinue={handleInputContinue} />
          )}
          {currentStep === 2 && (
            <ProcessingStep
              inputData={inputData}
              onComplete={handleProcessingComplete}
            />
          )}
          {currentStep === 3 && (
            <ResultsStep
              inputData={inputData}
              sessionId={sessionId}
              onReset={handleReset}
            />
          )}
        </div>
      </main>
    </div>
  )
}
