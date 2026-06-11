'use client'

import { ArrowUpRight, ArrowDownRight } from 'lucide-react'

interface KPICardProps {
  title: string
  value: string
  change: number
  unit: string
  icon: React.ReactNode
  color: string
  description: string
}

export function KPICard({
  title,
  value,
  change,
  unit,
  icon,
  color,
  description,
}: KPICardProps) {
  const isPositive = change >= 0

  return (
    <div className="group relative rounded-xl border border-amber-200 bg-white/80 backdrop-blur-sm p-6 hover:border-amber-300 hover:bg-white/90 transition-all duration-300 cursor-pointer">
      {/* Gradient background animation */}
      <div
        className={`absolute inset-0 rounded-xl opacity-0 group-hover:opacity-10 bg-gradient-to-br ${color} transition-opacity duration-300`}
      />

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-medium text-amber-700">{title}</h3>
            <div className="flex items-center gap-1.5 text-[9px] font-mono text-red-500 font-semibold bg-red-500/5 border border-red-500/10 px-1.5 py-0.5 rounded-full w-fit">
              <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />
              LIVE
            </div>
          </div>
          <div className={`p-2 rounded-lg bg-gradient-to-br ${color} bg-opacity-20`}>
            <div className="text-amber-900">{icon}</div>
          </div>
        </div>

        {/* Value */}
        <div className="mb-4">
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold text-amber-900">{value}</span>
            <span className="text-lg text-amber-600">{unit}</span>
          </div>
        </div>

        {/* Change indicator */}
        <div className="flex items-center gap-2">
          {isPositive ? (
            <ArrowUpRight className="w-4 h-4 text-green-500" />
          ) : (
            <ArrowDownRight className="w-4 h-4 text-red-500" />
          )}
          <span
            className={`text-sm font-semibold ${
              isPositive ? 'text-green-500' : 'text-red-500'
            }`}
          >
            {isPositive ? '+' : ''}{change}% {description}
          </span>
        </div>
      </div>

      {/* Bottom accent bar */}
      <div
        className={`absolute bottom-0 left-0 right-0 h-1 rounded-b-xl bg-gradient-to-r ${color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
      />
    </div>
  )
}
