'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, Zap, TreePine, Building2, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { KPICard } from './kpi-card'
import { exportKPIToPDF } from '@/lib/pdf-generator'

interface KPI {
  id: string
  title: string
  value: string
  change: number
  unit: string
  icon: React.ReactNode
  color: string
  description: string
}

const kpis: KPI[] = [
  {
    id: 'gdp',
    title: 'Global GDP Growth',
    value: '2.8',
    change: 1.2,
    unit: '%',
    icon: <TrendingUp className="w-6 h-6" />,
    color: 'from-amber-500 to-amber-600',
    description: 'Year-over-year growth',
  },
  {
    id: 'energy',
    title: 'Energy Production',
    value: '4,215',
    change: 3.5,
    unit: 'GW',
    icon: <Zap className="w-6 h-6" />,
    color: 'from-amber-600 to-yellow-600',
    description: 'Global renewable energy',
  },
  {
    id: 'sustainability',
    title: 'Sustainability Index',
    value: '68.4',
    change: 2.1,
    unit: '/100',
    icon: <TreePine className="w-6 h-6" />,
    color: 'from-amber-700 to-yellow-700',
    description: 'Environmental metrics',
  },
  {
    id: 'infrastructure',
    title: 'Infrastructure Rating',
    value: '7.2',
    change: 0.8,
    unit: '/10',
    icon: <Building2 className="w-6 h-6" />,
    color: 'from-yellow-600 to-amber-700',
    description: 'Global infrastructure score',
  },
  {
    id: 'trade',
    title: 'International Trade',
    value: '12.5',
    change: 4.2,
    unit: 'B USD',
    icon: <TrendingUp className="w-6 h-6" />,
    color: 'from-amber-600 to-orange-600',
    description: 'Bilateral agreements',
  },
  {
    id: 'sentiment',
    title: 'Market Sentiment',
    value: '76.3',
    change: 2.8,
    unit: '/100',
    icon: <Building2 className="w-6 h-6" />,
    color: 'from-amber-500 to-yellow-600',
    description: 'Investor confidence',
  },
  {
    id: 'tech',
    title: 'Tech Adoption Rate',
    value: '84.2',
    change: 5.1,
    unit: '%',
    icon: <Zap className="w-6 h-6" />,
    color: 'from-amber-700 to-yellow-600',
    description: 'Digital transformation',
  },
  {
    id: 'risk',
    title: 'Geopolitical Risk',
    value: '3.4',
    change: -1.2,
    unit: '/10',
    icon: <TreePine className="w-6 h-6" />,
    color: 'from-yellow-600 to-amber-600',
    description: 'Lower is safer',
  },
]

export function KPIGrid() {
  const [items, setItems] = useState<KPI[]>(kpis)

  useEffect(() => {
    const timer = setInterval(() => {
      setItems(prevItems =>
        prevItems.map(kpi => {
          const val = parseFloat(kpi.value.replace(/,/g, ''))
          let delta = (Math.random() - 0.5) * 0.1
          
          if (kpi.id === 'energy') {
            delta = (Math.random() - 0.5) * 8
          } else if (kpi.id === 'trade') {
            delta = (Math.random() - 0.5) * 0.3
          } else if (kpi.id === 'sentiment') {
            delta = (Math.random() - 0.5) * 0.5
          } else if (kpi.id === 'tech') {
            delta = (Math.random() - 0.5) * 0.2
          } else if (kpi.id === 'risk') {
            delta = (Math.random() - 0.5) * 0.05
          } else if (kpi.id === 'infrastructure') {
            delta = (Math.random() - 0.5) * 0.03
          }

          let newVal = val + delta
          
          // boundary checks
          if (kpi.id === 'sustainability' || kpi.id === 'sentiment' || kpi.id === 'tech') {
            newVal = Math.max(1, Math.min(100, newVal))
          } else if (kpi.id === 'risk' || kpi.id === 'infrastructure') {
            newVal = Math.max(1, Math.min(10, newVal))
          } else if (kpi.id === 'gdp') {
            newVal = Math.max(-2, Math.min(15, newVal))
          }

          let formattedValue = ''
          if (kpi.id === 'energy') {
            formattedValue = Math.round(newVal).toLocaleString()
          } else {
            formattedValue = newVal.toFixed(1)
          }

          const changeDelta = parseFloat(((Math.random() - 0.5) * 0.1).toFixed(2))
          const newChange = parseFloat((kpi.change + changeDelta).toFixed(2))

          return {
            ...kpi,
            value: formattedValue,
            change: newChange
          }
        })
      )
    }, 2500)

    return () => clearInterval(timer)
  }, [])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
          </span>
          <span className="text-xs font-mono font-bold text-red-500 tracking-wider uppercase">Live Telemetry Active</span>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => exportKPIToPDF(items)}
          className="border-amber-200 text-amber-700 hover:bg-amber-50 gap-1.5 h-8 text-xs font-semibold"
        >
          <Download className="w-3.5 h-3.5" />
          Export KPIs (PDF)
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-4">
        {items.map((kpi) => (
          <KPICard key={kpi.id} {...kpi} />
        ))}
      </div>
    </div>
  )
}
