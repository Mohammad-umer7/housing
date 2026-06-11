'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Sun, Wind, Droplets, Network, Download, ShieldCheck, Cpu } from 'lucide-react'
import { exportVisualInsightsToPDF } from '@/lib/pdf-generator'

interface TelemetryMetric {
  id: string
  label: string
  value: string
  status: 'Optimal' | 'Stable' | 'Normal' | 'Peak'
}

interface Asset {
  id: string
  name: string
  type: string
  location: string
  image: string
  icon: React.ReactNode
  description: string
  metrics: TelemetryMetric[]
}

const assetsData: Asset[] = [
  {
    id: 'solar',
    name: 'Barakah Desert Solar Array',
    type: 'Photovoltaic Solar Park',
    location: 'Abu Dhabi Desert, UAE',
    image: '/barakah_solar.png',
    icon: <Sun className="w-5 h-5" />,
    description: 'One of the world\'s largest single-site solar parks, utilizing bifacial solar panels and robotic dry-cleaning technology to maximize energy yield in extreme desert environments.',
    metrics: [
      { id: 'output', label: 'Energy Generation Output', value: '1.45 GW', status: 'Optimal' },
      { id: 'efficiency', label: 'Panel Conversion Efficiency', value: '23.4%', status: 'Stable' },
      { id: 'temp', label: 'System Core Temperature', value: '44.2 °C', status: 'Normal' },
      { id: 'load', label: 'Grid Feed Load Factor', value: '96.2%', status: 'Peak' },
    ],
  },
  {
    id: 'wind',
    name: 'North Sea Offshore Wind Field',
    type: 'Offshore Wind Farm',
    location: 'North Sea, Norway Scope',
    image: '/offshore_wind.png',
    icon: <Wind className="w-5 h-5" />,
    description: 'Deepwater floating wind turbines leveraging steady maritime wind channels to generate highly reliable energy blocks integrated directly into northern European grid links.',
    metrics: [
      { id: 'output', label: 'Energy Generation Output', value: '842 MW', status: 'Optimal' },
      { id: 'efficiency', label: 'Turbine Capacity Factor', value: '52.1%', status: 'Stable' },
      { id: 'temp', label: 'Generator Bearing Temp', value: '58.7 °C', status: 'Normal' },
      { id: 'load', label: 'Subsea Cable Capacity', value: '88.5%', status: 'Stable' },
    ],
  },
  {
    id: 'hydrogen',
    name: 'Eco Green Hydrogen Plant',
    type: 'Industrial PEM Electrolyzer',
    location: 'Hamburg Port, Germany Scope',
    image: '/green_hydrogen.png',
    icon: <Droplets className="w-5 h-5" />,
    description: 'State-of-the-art Proton Exchange Membrane electrolyzer facility splitting water into pure green hydrogen using direct renewable grid power inputs.',
    metrics: [
      { id: 'output', label: 'Hydrogen Flow Rate', value: '12,500 Nm³/h', status: 'Stable' },
      { id: 'efficiency', label: 'Stack Energy Efficiency', value: '78.2%', status: 'Optimal' },
      { id: 'temp', label: 'PEM Electrolyzer Temp', value: '74.5 °C', status: 'Normal' },
      { id: 'load', label: 'High-Pressure Storage', value: '62.4%', status: 'Normal' },
    ],
  },
  {
    id: 'grid',
    name: 'Smart Energy Grid Control Room',
    type: 'Grid Balancing Command Wall',
    location: 'Unified Operations, Global',
    image: '/smart_grid.png',
    icon: <Network className="w-5 h-5" />,
    description: 'AI-orchestrated grid operations center. Balances variable renewable inputs with strategic battery storage reserves in real-time to maintain grid stability.',
    metrics: [
      { id: 'output', label: 'Total Balanced Load', value: '4.85 GW', status: 'Optimal' },
      { id: 'efficiency', label: 'Transmission Efficiency', value: '98.6%', status: 'Optimal' },
      { id: 'temp', label: 'Substation Transformer Temp', value: '51.3 °C', status: 'Normal' },
      { id: 'load', label: 'AI Optimization Load', value: '73.1%', status: 'Normal' },
    ],
  },
]

export function VisualInsights() {
  const [activeTab, setActiveTab] = useState<string>('solar')
  const [assets, setAssets] = useState<Asset[]>(assetsData)

  // Real-time telemetry simulation
  useEffect(() => {
    const timer = setInterval(() => {
      setAssets((prevAssets) =>
        prevAssets.map((asset) => {
          const updatedMetrics = asset.metrics.map((metric) => {
            let valFloat = parseFloat(metric.value.replace(/,/g, ''))
            const isPercentage = metric.value.includes('%')
            const isCelsius = metric.value.includes('°C')
            const isNmc = metric.value.includes('Nm³')
            const isGW = metric.value.includes('GW')
            const isMW = metric.value.includes('MW')

            let delta = 0
            if (metric.id === 'output') {
              delta = (Math.random() - 0.5) * (isGW ? 0.01 : isMW ? 4 : 50)
            } else if (metric.id === 'efficiency') {
              delta = (Math.random() - 0.5) * 0.05
            } else if (metric.id === 'temp') {
              delta = (Math.random() - 0.5) * 0.2
            } else if (metric.id === 'load') {
              delta = (Math.random() - 0.5) * 0.4
            }

            let newVal = valFloat + delta

            // bounds checks
            if (isPercentage) {
              newVal = Math.max(10, Math.min(100, newVal))
            } else if (isCelsius) {
              newVal = Math.max(20, Math.min(120, newVal))
            }

            let formattedVal = ''
            if (isPercentage) {
              formattedVal = `${newVal.toFixed(1)}%`
            } else if (isCelsius) {
              formattedVal = `${newVal.toFixed(1)} °C`
            } else if (isNmc) {
              formattedVal = `${Math.round(newVal).toLocaleString()} Nm³/h`
            } else if (isGW) {
              formattedVal = `${newVal.toFixed(2)} GW`
            } else if (isMW) {
              formattedVal = `${Math.round(newVal)} MW`
            } else {
              formattedVal = newVal.toFixed(1)
            }

            // Random status updates
            const statuses: ('Optimal' | 'Stable' | 'Normal' | 'Peak')[] = ['Optimal', 'Stable', 'Normal']
            const randomStatus = Math.random() > 0.8 ? statuses[Math.floor(Math.random() * statuses.length)] : metric.status

            return {
              ...metric,
              value: formattedVal,
              status: randomStatus,
            }
          })
          return {
            ...asset,
            metrics: updatedMetrics,
          }
        })
      )
    }, 2000)

    return () => clearInterval(timer)
  }, [])

  const activeAsset = assets.find((a) => a.id === activeTab) || assets[0]

  return (
    <Card className="p-6 border border-amber-200 bg-white/80 backdrop-blur-sm shadow-xl">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Side - Interactive selector & Specs */}
        <div className="w-full lg:w-5/12 flex flex-col gap-5">
          <div>
            <h3 className="text-xl font-bold text-amber-900 mb-1">Visual Insights & Infrastructure</h3>
            <p className="text-sm text-amber-700">Real-time visual telemetry of critical energy assets</p>
          </div>

          {/* Asset Selectors */}
          <div className="grid grid-cols-2 gap-2">
            {assets.map((asset) => (
              <button
                key={asset.id}
                onClick={() => setActiveTab(asset.id)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all duration-300 ${
                  activeTab === asset.id
                    ? 'border-amber-600 bg-amber-500/10 text-amber-900 font-bold shadow-md'
                    : 'border-amber-100 hover:border-amber-300 bg-white text-amber-700'
                }`}
              >
                <div className={`p-1.5 rounded-lg ${activeTab === asset.id ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800'}`}>
                  {asset.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate">{asset.name}</p>
                  <p className="text-[10px] text-amber-600 truncate">{asset.type}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Specifications */}
          <div className="bg-[#FAF6EC] border border-amber-100 rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-800 uppercase tracking-wider">
              <Cpu className="w-4 h-4 text-amber-600" />
              Asset Details & Strategy
            </div>
            <div>
              <p className="text-xs font-bold text-amber-900">{activeAsset.name}</p>
              <p className="text-[10px] font-mono text-amber-600">{activeAsset.location}</p>
            </div>
            <p className="text-xs text-amber-800 leading-relaxed">{activeAsset.description}</p>
            <div className="flex items-center gap-2 text-[10px] font-semibold text-green-700 bg-green-50 border border-green-200/50 px-2.5 py-1 rounded-lg w-fit">
              <ShieldCheck className="w-3.5 h-3.5" />
              Encrypted Operational Line Secure
            </div>
          </div>
        </div>

        {/* Right Side - Visual image display & telemetry details */}
        <div className="w-full lg:w-7/12 flex flex-col gap-4">
          <div className="relative h-64 sm:h-80 w-full rounded-2xl overflow-hidden border border-amber-200/50 group">
            {/* Asset Image */}
            <Image
              src={activeAsset.image}
              alt={activeAsset.name}
              fill
              priority
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />
            {/* Soft gradient cover */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

            {/* Glowing Live Overlay Badge */}
            <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-500/90 text-white text-[10px] font-mono font-bold px-2.5 py-1 rounded-full shadow-lg animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
              TELEMETRY LIVE
            </div>

            {/* Title / location on image */}
            <div className="absolute bottom-4 left-4 right-4 text-white">
              <p className="text-[10px] uppercase font-bold tracking-widest text-amber-400 font-mono">{activeAsset.type}</p>
              <h4 className="text-lg font-bold truncate">{activeAsset.name}</h4>
              <p className="text-xs text-gray-300 truncate">{activeAsset.location}</p>
            </div>
          </div>

          {/* Telemetry Metrics Grid */}
          <div className="grid grid-cols-2 gap-3">
            {activeAsset.metrics.map((metric) => (
              <div
                key={metric.id}
                className="flex flex-col gap-1.5 p-3 rounded-xl border border-amber-100 bg-white/60 hover:bg-white/90 transition-colors duration-300"
              >
                <span className="text-[10px] text-amber-700 font-medium uppercase tracking-wide truncate">{metric.label}</span>
                <div className="flex items-baseline justify-between gap-2 mt-1">
                  <span className="text-lg font-bold text-amber-900">{metric.value}</span>
                  <span className={`text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded ${
                    metric.status === 'Optimal' ? 'bg-green-100 text-green-800' :
                    metric.status === 'Peak' ? 'bg-orange-100 text-orange-800' :
                    'bg-amber-100 text-amber-800'
                  }`}>
                    {metric.status}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Export Action */}
          <div className="flex justify-end mt-1">
            <Button
              onClick={() => exportVisualInsightsToPDF(activeAsset, activeAsset.metrics)}
              className="bg-amber-600 hover:bg-amber-700 text-white gap-2 font-semibold"
            >
              <Download className="w-4 h-4" />
              Export Asset Data (PDF)
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}
