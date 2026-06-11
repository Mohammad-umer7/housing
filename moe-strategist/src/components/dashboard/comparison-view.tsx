'use client'

import { useState, useRef } from 'react'
import { ComparisonChart, getBaseValue } from './comparison-chart'
import { CountrySelector } from './country-selector'
import { MetricToggle } from './metric-toggle'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Upload, Search, X, CheckCircle, Download } from 'lucide-react'
import { exportComparisonToPDF } from '@/lib/pdf-generator'

export function ComparisonView() {
  const [country1, setCountry1] = useState('UAE')
  const [country2, setCountry2] = useState('Norway')
  const [metrics, setMetrics] = useState<string[]>(['energy', 'sustainability'])
  const [pdf1, setPdf1] = useState<File | null>(null)
  const [pdf2, setPdf2] = useState<File | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const fileInput1Ref = useRef<HTMLInputElement>(null)
  const fileInput2Ref = useRef<HTMLInputElement>(null)
  const [latestChartData, setLatestChartData] = useState<any[] | null>(null)

  const toggleMetric = (metric: string) => {
    setMetrics((prev) =>
      prev.includes(metric)
        ? prev.filter((m) => m !== metric)
        : [...prev, metric]
    )
  }

  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>, setPdf: (file: File | null) => void) => {
    const file = e.target.files?.[0]
    if (file && file.type === 'application/pdf') {
      setPdf(file)
    }
  }

  const handleSearchInternet = () => {
    if (country1 && country2) {
      const query = `${country1} ${country2} comparison ${metrics.join(' ')}`
      window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank')
    }
  }

  const removePdf = (setPdf: (file: File | null) => void) => {
    setPdf(null)
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-br from-amber-50 via-amber-50 to-amber-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-amber-900 mb-2">
            Country Intelligence Comparison
          </h1>
          <p className="text-amber-700">
            Compare key metrics across countries
          </p>
        </div>

        {/* Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <CountrySelector
            label="Country 1"
            value={country1}
            onChange={setCountry1}
          />
          <CountrySelector
            label="Country 2"
            value={country2}
            onChange={setCountry2}
          />
          <MetricToggle metrics={metrics} onToggle={toggleMetric} />
        </div>

        {/* File Upload and Search Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Upload PDF 1 */}
          <Card className="border-amber-200 bg-white/80 p-4">
            <input
              ref={fileInput1Ref}
              type="file"
              accept=".pdf"
              onChange={(e) => handlePdfUpload(e, setPdf1)}
              className="hidden"
            />
            <Button
              onClick={() => fileInput1Ref.current?.click()}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white flex items-center justify-center gap-2"
            >
              <Upload size={18} />
              {pdf1 ? 'Change PDF 1' : 'Upload PDF 1'}
            </Button>
            {pdf1 && (
              <div className="mt-2 flex items-center justify-between bg-amber-50 p-2 rounded text-sm text-amber-700">
                <span className="truncate">{pdf1.name}</span>
                <button
                  onClick={() => removePdf(setPdf1)}
                  className="ml-2 hover:text-amber-900"
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </Card>

          {/* Upload PDF 2 */}
          <Card className="border-amber-200 bg-white/80 p-4">
            <input
              ref={fileInput2Ref}
              type="file"
              accept=".pdf"
              onChange={(e) => handlePdfUpload(e, setPdf2)}
              className="hidden"
            />
            <Button
              onClick={() => fileInput2Ref.current?.click()}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white flex items-center justify-center gap-2"
            >
              <Upload size={18} />
              {pdf2 ? 'Change PDF 2' : 'Upload PDF 2'}
            </Button>
            {pdf2 && (
              <div className="mt-2 flex items-center justify-between bg-amber-50 p-2 rounded text-sm text-amber-700">
                <span className="truncate">{pdf2.name}</span>
                <button
                  onClick={() => removePdf(setPdf2)}
                  className="ml-2 hover:text-amber-900"
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </Card>

          {/* Search from Internet */}
          <Card className="border-amber-200 bg-white/80 p-4">
            <Button
              onClick={handleSearchInternet}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2"
            >
              <Search size={18} />
              Search Internet
            </Button>
            <p className="mt-2 text-xs text-amber-600 text-center">
              Search Google for comparison data
            </p>
          </Card>

          {/* Export PDF Report */}
          <Card className="border-amber-200 bg-white/80 p-4">
            <Button
              onClick={() => {
                const comparisonMetricsData: Record<string, Record<string, number>> = {}
                const allMetricsKeys = ['energy', 'sustainability', 'gdp', 'infrastructure', 'technology']
                
                allMetricsKeys.forEach((m) => {
                  const dataRow = latestChartData?.find(
                    (r) => r.metricKey === m || r.metric.toLowerCase() === m.toLowerCase()
                  )
                  comparisonMetricsData[m] = {
                    [country1]: dataRow ? dataRow[country1] : getBaseValue(country1, m),
                    [country2]: dataRow ? dataRow[country2] : getBaseValue(country2, m),
                  }
                })
                exportComparisonToPDF(country1, country2, metrics, comparisonMetricsData)
              }}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white flex items-center justify-center gap-2"
            >
              <Download size={18} />
              Export PDF
            </Button>
            <p className="mt-2 text-xs text-amber-600 text-center">
              Save comparison report
            </p>
          </Card>

          {/* Summary */}
          {(pdf1 || pdf2) && (
            <Card className="border-green-200 bg-green-50/80 p-4 flex items-center justify-center col-span-full">
              <div className="text-center">
                <CheckCircle size={24} className="text-green-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-green-700">
                  {pdf1 && pdf2 ? '2 PDFs Ready' : '1 PDF Ready'}
                </p>
              </div>
            </Card>
          )}
        </div>
        <div className="space-y-6">
          <ComparisonChart
            country1={country1}
            country2={country2}
            metrics={metrics}
            onDataUpdate={setLatestChartData}
          />
        </div>
      </div>
    </div>
  )
}
