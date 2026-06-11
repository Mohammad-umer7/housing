'use client'

import { Card } from '@/components/ui/card'

interface MetricToggleProps {
  metrics: string[]
  onToggle: (metric: string) => void
}

const availableMetrics = [
  { id: 'energy', label: 'Energy Production', color: 'from-yellow-500' },
  { id: 'sustainability', label: 'Sustainability', color: 'from-green-500' },
  { id: 'transport', label: 'Transport', color: 'from-blue-500' },
  { id: 'gdp', label: 'GDP', color: 'from-purple-500' },
]

export function MetricToggle({ metrics, onToggle }: MetricToggleProps) {
  return (
    <Card className="border-amber-200 bg-white/80 p-4">
      <label className="block text-sm font-medium text-amber-900 mb-3">
        Metrics to Compare
      </label>
      <div className="space-y-2">
        {availableMetrics.map((metric) => (
          <label
            key={metric.id}
            className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-amber-100/50 transition-colors"
          >
            <input
              type="checkbox"
              checked={metrics.includes(metric.id)}
              onChange={() => onToggle(metric.id)}
              className="w-4 h-4 rounded border-amber-300 bg-white cursor-pointer"
            />
            <span className="text-sm text-amber-700">{metric.label}</span>
          </label>
        ))}
      </div>
    </Card>
  )
}
