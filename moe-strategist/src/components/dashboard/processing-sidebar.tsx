'use client'

import { Database, Cpu, BarChart3, CheckCircle } from 'lucide-react'

interface ProcessingSidebarProps {
  currentStep: 1 | 2 | 3
  onStepClick?: (step: 1 | 2 | 3) => void
}

const steps = [
  {
    step: 1 as const,
    icon: Database,
    label: 'Input Data',
    desc: 'Enter or upload data',
  },
  {
    step: 2 as const,
    icon: Cpu,
    label: 'Processing',
    desc: 'Analyzing inputs',
  },
  {
    step: 3 as const,
    icon: BarChart3,
    label: 'Results',
    desc: 'View insights',
  },
]

export function ProcessingSidebar({ currentStep, onStepClick }: ProcessingSidebarProps) {
  return (
    <aside className="w-64 flex-shrink-0 bg-white/80 dark:bg-card/80 border-r border-amber-200 dark:border-amber-900/40 h-full sticky top-0 flex flex-col py-8 px-4">
      <div className="mb-8 px-2">
        <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200 uppercase tracking-wider">
          Workflow
        </h2>
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
          Follow steps to complete analysis
        </p>
      </div>

      <div className="relative flex flex-col gap-0 flex-1">
        {steps.map((item, index) => {
          const isDone = currentStep > item.step
          const isActive = currentStep === item.step
          const isPending = currentStep < item.step
          const Icon = item.icon
          const isLast = index === steps.length - 1

          return (
            <div key={item.step} className="relative flex flex-col items-start">
              {/* Connector line */}
              {!isLast && (
                <div className="absolute left-5 top-10 w-0.5 h-12 z-0">
                  <div
                    className={`w-full h-full transition-colors duration-500 ${
                      isDone ? 'bg-green-400' : 'bg-amber-200 dark:bg-amber-800/40'
                    }`}
                  />
                </div>
              )}

              {/* Step row */}
              <button
                onClick={() => onStepClick?.(item.step)}
                disabled={isPending}
                className={`relative z-10 flex items-center gap-3 w-full rounded-xl px-3 py-3 mb-3 text-left transition-all duration-200 ${
                  isActive
                    ? 'bg-amber-600 text-white shadow-md'
                    : isDone
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/30'
                    : 'bg-amber-50/60 dark:bg-amber-900/10 text-amber-400 dark:text-amber-600 cursor-not-allowed'
                }`}
              >
                {/* Icon circle */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isActive
                      ? 'bg-white/20'
                      : isDone
                      ? 'bg-green-100 dark:bg-green-800/40'
                      : 'bg-amber-100 dark:bg-amber-800/20'
                  }`}
                >
                  {isDone ? (
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <Icon
                      className={`w-4 h-4 ${
                        isActive
                          ? 'text-white'
                          : isPending
                          ? 'text-amber-300 dark:text-amber-600'
                          : 'text-green-600'
                      }`}
                    />
                  )}
                </div>

                {/* Labels */}
                <div className="min-w-0">
                  <p className={`text-sm font-semibold leading-tight ${isActive ? 'text-white' : ''}`}>
                    {item.label}
                  </p>
                  <p
                    className={`text-xs mt-0.5 leading-tight ${
                      isActive
                        ? 'text-amber-100'
                        : isDone
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-amber-400 dark:text-amber-600'
                    }`}
                  >
                    {item.desc}
                  </p>
                </div>

                {/* Step number badge */}
                <div
                  className={`ml-auto text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 ${
                    isActive
                      ? 'bg-white text-amber-700'
                      : isDone
                      ? 'bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200'
                      : 'bg-amber-100 text-amber-400 dark:bg-amber-900/30 dark:text-amber-600'
                  }`}
                >
                  {item.step}
                </div>
              </button>
            </div>
          )
        })}
      </div>

      {/* Bottom note */}
      <div className="mt-auto pt-4 border-t border-amber-100 dark:border-amber-900/30">
        <p className="text-xs text-amber-500 dark:text-amber-600 text-center">
          All inputs are securely saved to the database
        </p>
      </div>
    </aside>
  )
}
