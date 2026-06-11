'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Download, FileText, Share2, TrendingUp } from 'lucide-react'
import PDFExport from '@/components/dashboard/pdf-export'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from 'recharts'

// Real GDP and Inflation Data
const gdpInflationData = [
  { year: '2022', gdp: 7.5, inflation: 4.8 },
  { year: '2023', gdp: 3.6, inflation: 1.5 },
  { year: '2024(e)', gdp: 4.0, inflation: 1.7 },
  { year: '2025(f)', gdp: 4.8, inflation: 1.6 },
  { year: '2026(f)', gdp: 5.0, inflation: 2.0 },
]

// GDP by Sector Data
const gdpBySectorData = [
  { name: 'Services', value: 51.6, fill: '#fb7e14' },
  { name: 'Industry', value: 47.7, fill: '#9d9d9d' },
  { name: 'Agriculture', value: 0.7, fill: '#c8c8c8' },
]

// Unemployment Rate Data
const unemploymentData = [
  { year: '2020', rate: 4.3 },
  { year: '2021', rate: 3.1 },
  { year: '2022', rate: 2.9 },
  { year: '2023', rate: 2.2 },
  { year: '2024', rate: 2.1 },
]

// Current Account Balance Data
const currentAccountData = [
  { year: '2022', balance: 66.5, percentage: 10.2 },
  { year: '2023', balance: 68.6, percentage: 10.5 },
  { year: '2024(e)', balance: 80.0, percentage: 11.8 },
  { year: '2025(f)', balance: 75.0, percentage: 10.9 },
  { year: '2026(f)', balance: 74.0, percentage: 10.5 },
]

export function ReportsPage() {
  const handleDownloadPDF = () => {
    console.log('Downloading report as PDF...')
  }

  const handleDownloadExcel = () => {
    console.log('Downloading report as Excel...')
  }

  const handleShareReport = () => {
    console.log('Sharing report...')
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-br from-amber-50 via-cream-surface to-amber-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-amber-700" />
              <h1 className="text-4xl font-bold text-amber-900">
                United Arab Emirates - Major Economic Indicators
              </h1>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handleDownloadPDF}
                className="gap-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </Button>
              <Button
                onClick={handleDownloadExcel}
                className="gap-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white"
              >
                <Download className="w-4 h-4" />
                Export Data
              </Button>
              <Button
                onClick={handleShareReport}
                variant="outline"
                className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50"
              >
                <Share2 className="w-4 h-4" />
                Share
              </Button>
            </div>
          </div>
          <p className="text-amber-700 mt-2">
            Data as of December 2025 | Source: UAE Ministry of Economy, IMF, World Bank
          </p>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Real GDP and Inflation */}
          <Card className="p-6 border border-amber-200 bg-white/80 backdrop-blur-sm shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-amber-900">
                Real GDP and Inflation
              </h2>
              <span className="text-xs text-amber-600 font-medium">
                2024 (estimated), 2025 & 2026 (forecast)
              </span>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={gdpInflationData} margin={{ left: 0, right: 20, top: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d4a574" />
                <XAxis dataKey="year" stroke="#7c612a" />
                <YAxis stroke="#7c612a" label={{ value: '% change', angle: -90, position: 'insideLeft' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#f6f0e1', border: '1px solid #d4a574' }}
                  formatter={(value) => `${value}%`}
                />
                <Legend wrapperStyle={{ color: '#7c612a' }} />
                <Line
                  type="monotone"
                  dataKey="gdp"
                  stroke="#7c612a"
                  strokeWidth={3}
                  dot={{ fill: '#7c612a', r: 6 }}
                  activeDot={{ r: 8 }}
                  name="Real GDP"
                />
                <Line
                  type="monotone"
                  dataKey="inflation"
                  stroke="#fb7e14"
                  strokeWidth={3}
                  dot={{ fill: '#fb7e14', r: 6 }}
                  activeDot={{ r: 8 }}
                  name="Inflation"
                />
              </LineChart>
            </ResponsiveContainer>
            <div className="text-xs text-amber-700 mt-4">
              📊 Download data | Source: National accounts, IMF staff estimates
            </div>
          </Card>

          {/* GDP by Sector */}
          <Card className="p-6 border border-amber-200 bg-white/80 backdrop-blur-sm shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-amber-900">GDP by Sector (2023)</h2>
              <span className="text-xs text-amber-600 font-medium">% distribution</span>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={gdpBySectorData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={110}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, value }) => `${name} ${value}%`}
                  labelLine={false}
                >
                  {gdpBySectorData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value}%`} />
              </PieChart>
            </ResponsiveContainer>
            <div className="text-xs text-amber-700 mt-4">
              📊 Download data | Individual figures may not add up to 100% due to rounding. | Source: UNCTAD
            </div>
          </Card>

          {/* Unemployment Rate */}
          <Card className="p-6 border border-amber-200 bg-white/80 backdrop-blur-sm shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-amber-900">Unemployment Rate</h2>
              <span className="text-xs text-amber-600 font-medium">%</span>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={unemploymentData} margin={{ left: 0, right: 20, top: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d4a574" />
                <XAxis dataKey="year" stroke="#7c612a" />
                <YAxis stroke="#7c612a" domain={[0, 5]} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#f6f0e1', border: '1px solid #d4a574' }}
                  formatter={(value) => `${value}%`}
                />
                <Legend wrapperStyle={{ color: '#7c612a' }} />
                <Line
                  type="monotone"
                  dataKey="rate"
                  stroke="#7c612a"
                  strokeWidth={3}
                  dot={{ fill: '#7c612a', r: 6 }}
                  activeDot={{ r: 8 }}
                  name="Unemployment Rate"
                />
              </LineChart>
            </ResponsiveContainer>
            <div className="text-xs text-amber-700 mt-4">
              📊 Download data | Source: World Bank (modelled ILO estimate)
            </div>
          </Card>

          {/* Current Account Balance */}
          <Card className="p-6 border border-amber-200 bg-white/80 backdrop-blur-sm shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-amber-900">Current Account Balance</h2>
              <span className="text-xs text-amber-600 font-medium">
                2024 (estimated), 2025 & 2026 (forecast)
              </span>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={currentAccountData} margin={{ left: 0, right: 20, top: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d4a574" />
                <XAxis dataKey="year" stroke="#7c612a" />
                <YAxis
                  yAxisId="left"
                  stroke="#7c612a"
                  label={{ value: 'USD $ billion', angle: -90, position: 'insideLeft' }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#fb7e14"
                  label={{ value: '% of GDP', angle: 90, position: 'insideRight' }}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#f6f0e1', border: '1px solid #d4a574' }}
                  formatter={(value, name) => {
                    if (name === 'balance') return [`$${value}B`, 'Current Account Balance']
                    return [`${value}%`, '% of GDP']
                  }}
                />
                <Legend wrapperStyle={{ color: '#7c612a' }} />
                <Bar yAxisId="left" dataKey="balance" fill="#fb7e14" name="Current Account Balance" />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="percentage"
                  stroke="#7c612a"
                  strokeWidth={3}
                  dot={{ fill: '#7c612a', r: 6 }}
                  name="% of GDP"
                />
              </ComposedChart>
            </ResponsiveContainer>
            <div className="text-xs text-amber-700 mt-4">
              📊 Download data | Source: IMF World Economic Outlook
            </div>
          </Card>
        </div>

        {/* Key Insights */}
        <Card className="p-8 border border-amber-200 bg-white/80 backdrop-blur-sm shadow-lg">
          <h2 className="text-2xl font-bold text-amber-900 mb-6">Key Economic Insights</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-4 rounded-lg bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200">
              <div className="text-sm font-semibold text-amber-700 mb-2">GDP Growth</div>
              <div className="text-3xl font-bold text-amber-900">5.0%</div>
              <div className="text-xs text-amber-600 mt-2">Forecast 2026</div>
            </div>
            <div className="p-4 rounded-lg bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200">
              <div className="text-sm font-semibold text-amber-700 mb-2">Inflation Rate</div>
              <div className="text-3xl font-bold text-amber-900">2.0%</div>
              <div className="text-xs text-amber-600 mt-2">Forecast 2026</div>
            </div>
            <div className="p-4 rounded-lg bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200">
              <div className="text-sm font-semibold text-amber-700 mb-2">Unemployment</div>
              <div className="text-3xl font-bold text-amber-900">2.1%</div>
              <div className="text-xs text-amber-600 mt-2">2024</div>
            </div>
            <div className="p-4 rounded-lg bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200">
              <div className="text-sm font-semibold text-amber-700 mb-2">Current Account</div>
              <div className="text-3xl font-bold text-amber-900">USD 74.0B</div>
              <div className="text-xs text-amber-600 mt-2">Forecast 2026</div>
            </div>
          </div>
        </Card>

        {/* PDF Export Section */}
        <div className="mt-8">
          <PDFExport />
        </div>
      </div>
    </div>
  )
}
