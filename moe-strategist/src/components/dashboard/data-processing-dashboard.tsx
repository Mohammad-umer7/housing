'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronLeft, Database, Cpu, BarChart3, CheckCircle } from 'lucide-react'
import { Step1Inputs } from './processing/step1-inputs'
import { Step2Thinking } from './processing/step2-thinking'
import { Step3Charts } from './processing/step3-charts'
import { MODULE_CONFIGS } from '@/types/modules'
import type { ModuleType } from '@/types/modules'

// ── Sidebar ───────────────────────────────────────────────────────────────────

const STEPS = [
  { step: 1 as const, icon: Database, label: 'Input Data' },
  { step: 2 as const, icon: Cpu, label: 'Processing' },
  { step: 3 as const, icon: BarChart3, label: 'Results' },
]

function DashboardSidebar({
  currentStep,
  moduleType,
  onClose,
}: {
  currentStep: 1 | 2 | 3
  moduleType: ModuleType
  onClose: () => void
}) {
  const config = MODULE_CONFIGS[moduleType]

  return (
    <aside
      className="w-64 flex-shrink-0 flex flex-col border-r"
      style={{ background: '#faf6ec', borderColor: '#e8dcc8' }}
    >
      {/* Logo area */}
      <div className="px-5 pt-6 pb-4 border-b" style={{ borderColor: '#e8dcc8' }}>
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #9b7a36, #c2a14e)' }}
          >
            <span className="text-white font-bold text-sm">MS</span>
          </div>
          <span className="font-bold text-sm" style={{ color: '#9b7a36' }}>
            MOE Strategist
          </span>
        </div>
        <div
          className="rounded-xl px-3 py-2.5 border"
          style={{ background: 'white', borderColor: '#e8dcc8' }}
        >
          <p className="text-xs font-semibold" style={{ color: '#4a3728' }}>
            {config.title}
          </p>
          <p className="text-[10px] mt-0.5" style={{ color: '#9b7a36' }}>
            {config.badgeLabel}
          </p>
        </div>
      </div>

      {/* Steps */}
      <div className="flex-1 px-4 py-6">
        <p
          className="text-[10px] font-bold uppercase tracking-widest mb-4 px-1"
          style={{ color: '#c2a14e' }}
        >
          Workflow
        </p>
        <div className="relative">
          {/* Connector line */}
          <div
            className="absolute left-[18px] top-9 h-[calc(100%-3.5rem)] w-0.5"
            style={{ background: '#e8dcc8' }}
          />

          {STEPS.map(({ step, icon: Icon, label }) => {
            const isDone = currentStep > step
            const isActive = currentStep === step
            const isPending = currentStep < step

            return (
              <div key={step} className="relative flex items-start gap-3 mb-6">
                {/* Icon circle */}
                <div
                  className="relative z-10 flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center border-2 transition-all duration-300"
                  style={{
                    background: isDone
                      ? '#22c55e'
                      : isActive
                      ? '#9b7a36'
                      : 'white',
                    borderColor: isDone
                      ? '#22c55e'
                      : isActive
                      ? '#9b7a36'
                      : '#e8dcc8',
                    boxShadow: isActive ? '0 0 0 4px rgba(155,122,54,0.15)' : 'none',
                  }}
                >
                  {isDone ? (
                    <CheckCircle className="w-4 h-4 text-white" />
                  ) : (
                    <Icon
                      className="w-4 h-4"
                      style={{ color: isActive ? 'white' : '#c2a14e' }}
                    />
                  )}
                </div>

                {/* Labels */}
                <div className="pt-1 min-w-0">
                  <p
                    className="text-sm font-semibold leading-tight"
                    style={{
                      color: isDone ? '#22c55e' : isActive ? '#4a3728' : '#c2a14e',
                    }}
                  >
                    {label}
                  </p>
                  <p
                    className="text-[10px] mt-0.5"
                    style={{ color: isPending ? '#d4b896' : '#9b7a36' }}
                  >
                    Step {step} of 3
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Bottom close button */}
      <div className="px-4 pb-5">
        <button
          onClick={onClose}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm transition-all hover:opacity-80"
          style={{
            borderColor: '#e8dcc8',
            background: 'white',
            color: '#9b7a36',
          }}
        >
          <X className="w-4 h-4" />
          Close Module
        </button>
      </div>
    </aside>
  )
}

// ── Step content area ─────────────────────────────────────────────────────────

const SLIDE_VARIANTS = {
  enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
}

// ── Main dashboard ────────────────────────────────────────────────────────────

interface DataProcessingDashboardProps {
  moduleType: ModuleType
  onClose: () => void
}

export function DataProcessingDashboard({
  moduleType,
  onClose,
}: DataProcessingDashboardProps) {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1)
  const [direction, setDirection] = useState(1)
  const [inputData, setInputData] = useState<Record<string, unknown>>({})
  const config = MODULE_CONFIGS[moduleType]

  const goTo = useCallback(
    (step: 1 | 2 | 3) => {
      setDirection(step > currentStep ? 1 : -1)
      setCurrentStep(step)
    },
    [currentStep]
  )

  const handleStep1Ready = useCallback((data: Record<string, unknown>) => {
    setInputData(data)
    goTo(2)
  }, [goTo])

  const handleStep2Done = useCallback(() => {
    goTo(3)
  }, [goTo])

  return (
    <div
      className="flex h-[calc(100vh-64px)] overflow-hidden"
      style={{ background: '#faf6ec' }}
    >
      {/* Fixed sidebar */}
      <DashboardSidebar
        currentStep={currentStep}
        moduleType={moduleType}
        onClose={onClose}
      />

      {/* Scrollable main area */}
      <main className="flex-1 overflow-y-auto">
        {/* Step header */}
        <div
          className="sticky top-0 z-10 px-8 py-4 border-b flex items-center gap-4"
          style={{
            background: 'rgba(250,246,236,0.95)',
            backdropFilter: 'blur(8px)',
            borderColor: '#e8dcc8',
          }}
        >
          {currentStep > 1 && (
            <button
              onClick={() => goTo((currentStep - 1) as 1 | 2)}
              className="flex items-center gap-1 text-sm font-medium transition-opacity hover:opacity-70"
              style={{ color: '#9b7a36' }}
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          )}
          <div>
            <h1 className="text-lg font-bold" style={{ color: '#4a3728' }}>
              {currentStep === 1
                ? config.step1Title
                : currentStep === 2
                ? 'AI Processing Pipeline'
                : config.step3Title}
            </h1>
            <p className="text-xs" style={{ color: '#9b7a36' }}>
              {currentStep === 1
                ? config.step1Subtitle
                : currentStep === 2
                ? `Running ${config.agents.length} AI agents — please wait`
                : config.step3Subtitle}
            </p>
          </div>

          {/* Step badges */}
          <div className="ml-auto flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                style={{
                  background:
                    s < currentStep ? '#22c55e' : s === currentStep ? '#9b7a36' : '#e8dcc8',
                  color: s <= currentStep ? 'white' : '#c2a14e',
                }}
              >
                {s < currentStep ? '✓' : s}
              </div>
            ))}
          </div>
        </div>

        {/* Animated step content */}
        <div className="px-8 py-8 max-w-4xl mx-auto">
          <AnimatePresence mode="wait" custom={direction}>
            {currentStep === 1 && (
              <motion.div
                key="step1"
                custom={direction}
                variants={SLIDE_VARIANTS}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.28, ease: 'easeInOut' }}
              >
                <Step1Inputs moduleType={moduleType} onReady={handleStep1Ready} />
              </motion.div>
            )}

            {currentStep === 2 && (
              <motion.div
                key="step2"
                custom={direction}
                variants={SLIDE_VARIANTS}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.28, ease: 'easeInOut' }}
              >
                <Step2Thinking
                  config={config}
                  inputData={inputData}
                  onComplete={handleStep2Done}
                />
              </motion.div>
            )}

            {currentStep === 3 && (
              <motion.div
                key="step3"
                custom={direction}
                variants={SLIDE_VARIANTS}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.28, ease: 'easeInOut' }}
              >
                {/* Results header */}
                <div
                  className="rounded-2xl p-5 mb-8 border-2"
                  style={{
                    background: 'linear-gradient(135deg, #f6f0e1, white)',
                    borderColor: '#e8dcc8',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}
                    >
                      <CheckCircle className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold" style={{ color: '#4a3728' }}>
                        {config.step3Title}
                      </h2>
                      <p className="text-xs" style={{ color: '#9b7a36' }}>
                        {config.step3Subtitle} · Generated{' '}
                        {new Date().toLocaleString('en-US', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </p>
                    </div>
                    <button
                      onClick={() => goTo(1)}
                      className="ml-auto text-xs font-medium px-3 py-1.5 rounded-xl border transition-all hover:opacity-80"
                      style={{
                        color: '#9b7a36',
                        borderColor: '#e8dcc8',
                        background: 'white',
                      }}
                    >
                      New Analysis
                    </button>
                  </div>
                </div>

                <Step3Charts moduleType={moduleType} inputData={inputData} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}
