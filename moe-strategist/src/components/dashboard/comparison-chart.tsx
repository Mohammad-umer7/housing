'use client'

import { useState, useEffect, useRef } from 'react'
import { Card } from '@/components/ui/card'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface ComparisonChartProps {
  country1: string
  country2: string
  metrics: string[]
  onDataUpdate?: (data: any[]) => void
}

const ALL_METRICS = ['energy', 'sustainability', 'gdp', 'infrastructure', 'technology']

const BASELINE_REGISTRY: Record<string, Record<string, number>> = {
  UAE: { energy: 65, sustainability: 72, gdp: 78, infrastructure: 68, technology: 80 },
  Norway: { energy: 85, sustainability: 90, gdp: 82, infrastructure: 88, technology: 85 },
  Germany: { energy: 75, sustainability: 82, gdp: 85, infrastructure: 84, technology: 88 },
  Singapore: { energy: 60, sustainability: 78, gdp: 92, infrastructure: 94, technology: 95 },
  Canada: { energy: 80, sustainability: 82, gdp: 80, infrastructure: 82, technology: 80 },
  Australia: { energy: 78, sustainability: 76, gdp: 78, infrastructure: 80, technology: 78 },
  Japan: { energy: 68, sustainability: 74, gdp: 88, infrastructure: 90, technology: 92 },
  USA: { energy: 82, sustainability: 70, gdp: 96, infrastructure: 86, technology: 95 },
  China: { energy: 72, sustainability: 65, gdp: 94, infrastructure: 92, technology: 90 },
  India: { energy: 58, sustainability: 60, gdp: 75, infrastructure: 70, technology: 76 },
  Brazil: { energy: 68, sustainability: 72, gdp: 70, infrastructure: 65, technology: 68 },
  France: { energy: 82, sustainability: 80, gdp: 82, infrastructure: 84, technology: 82 },
}

export function getBaseValue(country: string, metric: string): number {
  const normCountry = country.trim()
  const normMetric = metric.toLowerCase()
  if (BASELINE_REGISTRY[normCountry] && BASELINE_REGISTRY[normCountry][normMetric] !== undefined) {
    return BASELINE_REGISTRY[normCountry][normMetric]
  }
  // deterministic fallback
  let hash = 0
  for (let i = 0; i < normCountry.length; i++) {
    hash = normCountry.charCodeAt(i) + ((hash << 5) - hash)
  }
  for (let i = 0; i < normMetric.length; i++) {
    hash = normMetric.charCodeAt(i) + ((hash << 5) - hash)
  }
  return 50 + Math.abs(hash % 41) // 50 to 90
}

export function ComparisonChart({
  country1,
  country2,
  metrics,
  onDataUpdate,
}: ComparisonChartProps) {
  const [localTrendData, setLocalTrendData] = useState<any[]>([])
  const [localRadarData, setLocalRadarData] = useState<any[]>([])

  const onDataUpdateRef = useRef(onDataUpdate)
  useEffect(() => {
    onDataUpdateRef.current = onDataUpdate
  }, [onDataUpdate])

  // Initialize baselines
  useEffect(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
    const initialTrend = months.map((month, mIdx) => {
      const row: any = { month }
      ALL_METRICS.forEach((metric) => {
        const val1 = getBaseValue(country1, metric)
        const val2 = getBaseValue(country2, metric)
        const growthFactor = 1 + (mIdx - 2) * 0.02 // slight trend upward
        row[`${metric}${country1}`] = Math.round(val1 * growthFactor)
        row[`${metric}${country2}`] = Math.round(val2 * growthFactor)
      })
      return row
    })

    const initialRadar = ALL_METRICS.map((metric) => {
      const mLabel = metric.charAt(0).toUpperCase() + metric.slice(1)
      return {
        metric: mLabel,
        metricKey: metric,
        [country1]: getBaseValue(country1, metric),
        [country2]: getBaseValue(country2, metric),
      }
    })

    setLocalTrendData(initialTrend)
    setLocalRadarData(initialRadar)
  }, [country1, country2])

  // Real-time ticking interval
  useEffect(() => {
    if (localTrendData.length === 0 || localRadarData.length === 0) return

    const timer = setInterval(() => {
      const delta = () => (Math.random() - 0.5) * 4 // [-2, 2] fluctuation

      let updatedRadar: any[] = []
      setLocalRadarData((prevRadar) => {
        updatedRadar = prevRadar.map((item) => {
          const base1 = getBaseValue(country1, item.metricKey)
          const base2 = getBaseValue(country2, item.metricKey)
          
          const val1 = item[country1] + delta()
          const val2 = item[country2] + delta()
          
          const clampedVal1 = Math.round(Math.max(10, Math.min(100, Math.min(base1 + 8, Math.max(base1 - 8, val1)))))
          const clampedVal2 = Math.round(Math.max(10, Math.min(100, Math.min(base2 + 8, Math.max(base2 - 8, val2)))))
          
          return {
            ...item,
            [country1]: clampedVal1,
            [country2]: clampedVal2,
          }
        })
        return updatedRadar
      })

      setLocalTrendData((prevTrend) => {
        return prevTrend.map((row, idx) => {
          if (idx !== prevTrend.length - 1) return row // only tick latest month (Jun)
          const updatedRow = { ...row }
          ALL_METRICS.forEach((metric) => {
            const radarItem = updatedRadar.find((r) => r.metricKey === metric)
            if (radarItem) {
              updatedRow[`${metric}${country1}`] = radarItem[country1]
              updatedRow[`${metric}${country2}`] = radarItem[country2]
            }
          })
          return updatedRow
        })
      })
    }, 2000)

    return () => clearInterval(timer)
  }, [country1, country2, localTrendData.length, localRadarData.length])

  // Report changes back to parent
  useEffect(() => {
    if (localRadarData.length > 0) {
      onDataUpdateRef.current?.(localRadarData)
    }
  }, [localRadarData])

  const LiveBadge = () => (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 animate-pulse">
      <span className="w-1.5 h-1.5 rounded-full bg-red-600 dark:bg-red-500" />
      LIVE
    </span>
  )

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Line Chart - Trends */}
      {metrics.length > 0 && (
        <Card className="border-amber-200 bg-white/80 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-amber-900">
              Trends Comparison
            </h3>
            <LiveBadge />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={localTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d4a574" />
              <XAxis stroke="#a89468" dataKey="month" />
              <YAxis stroke="#a89468" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#faf6ec',
                  border: '1px solid #d4a574',
                }}
                labelStyle={{ color: '#6b4423' }}
              />
              <Legend />
              {metrics.flatMap((metric, idx) => {
                const colors1 = ["#9b7a36", "#6366f1", "#06b6d4", "#10b981", "#ec4899"]
                const colors2 = ["#c2a14e", "#818cf8", "#22d3ee", "#34d399", "#f472b6"]
                return [
                  <Line
                    key={`${metric}${country1}`}
                    type="monotone"
                    dataKey={`${metric}${country1}`}
                    stroke={colors1[idx % colors1.length]}
                    dot={false}
                    name={`${country1} ${metric.charAt(0).toUpperCase() + metric.slice(1)}`}
                  />,
                  <Line
                    key={`${metric}${country2}`}
                    type="monotone"
                    dataKey={`${metric}${country2}`}
                    stroke={colors2[idx % colors2.length]}
                    strokeDasharray="5 5"
                    dot={false}
                    name={`${country2} ${metric.charAt(0).toUpperCase() + metric.slice(1)}`}
                  />
                ]
              })}
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Radar Chart - Overall Comparison */}
      {metrics.length > 0 && (
        <Card className="border-amber-200 bg-white/80 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-amber-900">
              Overall Metrics
            </h3>
            <LiveBadge />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={localRadarData}>
              <PolarGrid stroke="#d4a574" />
              <PolarAngleAxis stroke="#a89468" dataKey="metric" />
              <PolarRadiusAxis stroke="#a89468" />
              <Radar
                name={country1}
                dataKey={country1}
                stroke="#9b7a36"
                fill="#9b7a36"
                fillOpacity={0.1}
              />
              <Radar
                name={country2}
                dataKey={country2}
                stroke="#c2a14e"
                fill="#c2a14e"
                fillOpacity={0.1}
              />
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Bar Chart - Detailed Comparison */}
      {metrics.length > 0 && (
        <Card className="border-amber-200 bg-white/80 p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-amber-900">
              Detailed Comparison
            </h3>
            <LiveBadge />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={localRadarData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d4a574" />
              <XAxis stroke="#a89468" dataKey="metric" />
              <YAxis stroke="#a89468" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#faf6ec',
                  border: '1px solid #d4a574',
                }}
                labelStyle={{ color: '#6b4423' }}
              />
              <Legend />
              <Bar dataKey={country1} fill="#9b7a36" name={country1} />
              <Bar dataKey={country2} fill="#c2a14e" name={country2} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Empty State */}
      {metrics.length === 0 && (
        <Card className="border-slate-700 bg-slate-800/50 p-8 lg:col-span-2">
          <div className="text-center text-slate-400">
            <p>Select metrics to compare</p>
          </div>
        </Card>
      )}
    </div>
  )
}
