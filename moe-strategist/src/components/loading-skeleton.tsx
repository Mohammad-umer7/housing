'use client'

import { Loader, Zap } from 'lucide-react'

interface LoadingSkeletonProps {
  message?: string
  details?: string[]
}

export function LoadingSkeleton({
  message = 'Loading...',
  details,
}: LoadingSkeletonProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8">
      <div className="mb-4">
        <Loader className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
      <p className="text-lg font-medium text-white mb-2">{message}</p>
      {details && (
        <div className="space-y-1 text-sm text-slate-400">
          {details.map((detail, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Zap className="w-3 h-3 text-yellow-500" />
              {detail}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function KPICardSkeleton() {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
      <div className="animate-pulse space-y-4">
        <div className="flex justify-between items-start">
          <div className="h-4 bg-slate-700 rounded w-1/3" />
          <div className="w-10 h-10 bg-slate-700 rounded-lg" />
        </div>
        <div className="space-y-2">
          <div className="h-8 bg-slate-700 rounded w-1/2" />
          <div className="h-4 bg-slate-700 rounded w-1/3" />
        </div>
      </div>
    </div>
  )
}

export function ChartSkeleton() {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-6">
      <div className="animate-pulse space-y-4">
        <div className="h-4 bg-slate-700 rounded w-1/4" />
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-12 bg-slate-700 rounded" />
          ))}
        </div>
      </div>
    </div>
  )
}

interface ThinkingStateProps {
  thoughts: string[]
  currentThought?: number
}

export function ThinkingState({ thoughts, currentThought = 0 }: ThinkingStateProps) {
  return (
    <div className="space-y-3 p-4 rounded-lg bg-blue-900/20 border border-blue-700">
      <div className="flex items-center gap-2 mb-3">
        <Loader className="w-4 h-4 text-blue-400 animate-spin" />
        <p className="text-sm font-medium text-blue-300">AI is thinking...</p>
      </div>
      <div className="space-y-2">
        {thoughts.map((thought, idx) => (
          <div
            key={idx}
            className={`flex items-center gap-2 text-xs transition-all ${
              idx === currentThought
                ? 'text-blue-300 opacity-100'
                : idx < currentThought
                  ? 'text-blue-500 opacity-60'
                  : 'text-slate-500 opacity-40'
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full transition-all ${
                idx === currentThought
                  ? 'bg-blue-400 scale-100'
                  : idx < currentThought
                    ? 'bg-green-400'
                    : 'bg-slate-600'
              }`}
            />
            {thought}
          </div>
        ))}
      </div>
    </div>
  )
}
