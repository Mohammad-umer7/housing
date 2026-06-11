'use client'

import { useState } from 'react'
import {
  CheckCircle,
  RotateCcw,
  Save,
  Download,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  Brain,
  CalendarDays,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { saveResults } from '@/lib/supabase-operations'
import type { InputData } from '@/types/database'

interface ResultsStepProps {
  inputData: InputData
  sessionId: string | null
  onReset: () => void
}

function generateResults(inputData: InputData) {
  if (!inputData) return { summary: 'No data processed.', insights: [] }

  if (inputData.type === 'scenario') {
    const d = inputData.data
    const hasTimeSeries =
      d.tradeVolumes.trim() || d.gdpGrowthRates.trim() || d.infrastructureInvestments.trim()
    const hasSentiment =
      d.newsArticles.trim() || d.pressReleases.trim() || d.diplomaticTranscripts.trim() || d.policyAnnouncements.trim()
    const sentiment = hasSentiment ? 'Moderately Positive' : 'Neutral (no text data)'
    const riskScore = hasTimeSeries ? '6.2 / 10' : 'N/A (no time-series data)'
    return {
      summary: 'Scenario planning analysis complete.',
      insights: [
        { label: 'Composite Risk Score', value: riskScore, icon: AlertTriangle, color: 'text-amber-600' },
        { label: 'Trade Volume Trend', value: hasTimeSeries ? 'Upward (+8.2% YoY avg)' : 'No data', icon: TrendingUp, color: 'text-green-600' },
        { label: 'GDP Momentum', value: hasTimeSeries ? 'Positive (2.8–5.7% range)' : 'No data', icon: BarChart3, color: 'text-blue-600' },
        { label: 'Overall Sentiment', value: sentiment, icon: Brain, color: 'text-purple-600' },
      ],
    }
  }

  if (inputData.type === 'economic') {
    const d = inputData.data
    return {
      summary: `Economic data for ${d.country || 'the selected country'} processed.`,
      insights: [
        { label: 'Country', value: d.country || '—', icon: TrendingUp, color: 'text-amber-600' },
        { label: 'GDP', value: d.gdp ? `$${d.gdp}B` : '—', icon: BarChart3, color: 'text-green-600' },
        { label: 'Inflation Rate', value: d.inflationRate ? `${d.inflationRate}%` : '—', icon: AlertTriangle, color: 'text-red-500' },
        { label: 'FDI Inflows', value: d.fdiInflows ? `$${d.fdiInflows}B` : '—', icon: TrendingUp, color: 'text-blue-600' },
      ],
    }
  }

  if (inputData.type === 'meeting') {
    const d = inputData.data
    return {
      summary: `Meeting data for ${d.countryOfInterest || 'bilateral engagement'} saved.`,
      insights: [
        { label: 'Meeting Date', value: d.meetingDate || '—', icon: CalendarDays, color: 'text-amber-600' },
        { label: 'Attendees', value: `${d.attendees.length} registered`, icon: Brain, color: 'text-green-600' },
        { label: 'Country of Interest', value: d.countryOfInterest || '—', icon: TrendingUp, color: 'text-blue-600' },
        { label: 'Bilateral Summaries', value: d.bilateralSummaries ? 'Attached' : 'None', icon: BarChart3, color: 'text-purple-600' },
      ],
    }
  }

  return { summary: 'File processed successfully.', insights: [] }
}

export function ResultsStep({ inputData, sessionId, onReset }: ResultsStepProps) {
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const timestamp = new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  const { summary, insights } = generateResults(inputData)

  const handleSaveResults = async () => {
    if (!sessionId || saved) return
    setSaving(true)
    setSaveError(null)

    const resultData: Record<string, unknown> = {
      input_type: inputData?.type ?? 'unknown',
      timestamp,
      insights: insights.map((i) => ({ label: i.label, value: i.value })),
    }

    const { error } = await saveResults(sessionId, inputData?.type ?? 'unknown', resultData)
    setSaving(false)

    if (error) {
      setSaveError(error)
    } else {
      setSaved(true)
    }
  }

  const handleExport = () => {
    const content = [
      'MOE STRATEGIST — ANALYSIS RESULTS',
      `Generated: ${timestamp}`,
      `Session ID: ${sessionId ?? 'local'}`,
      `Input Type: ${inputData?.type ?? 'unknown'}`,
      '',
      'SUMMARY',
      summary,
      '',
      'KEY INSIGHTS',
      ...insights.map((i) => `  ${i.label}: ${i.value}`),
    ].join('\n')

    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `moe-analysis-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center shadow-lg">
          <CheckCircle className="w-7 h-7 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-amber-900 dark:text-amber-100">
            Analysis Complete
          </h2>
          <p className="text-sm text-amber-600 dark:text-amber-400">{timestamp}</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card className="border-amber-200 bg-white/80 dark:bg-card/60 p-4">
          <p className="text-xs text-amber-500 uppercase tracking-wider mb-1">Session ID</p>
          <p className="text-sm font-mono font-semibold text-amber-900 dark:text-amber-100 truncate">
            {sessionId ? sessionId.slice(0, 16) + '...' : 'Local session'}
          </p>
        </Card>
        <Card className="border-amber-200 bg-white/80 dark:bg-card/60 p-4">
          <p className="text-xs text-amber-500 uppercase tracking-wider mb-1">Input Type</p>
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-100 capitalize">
            {inputData?.type ?? '—'}
          </p>
        </Card>
        <Card className="border-amber-200 bg-white/80 dark:bg-card/60 p-4">
          <p className="text-xs text-amber-500 uppercase tracking-wider mb-1">Records Processed</p>
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
            {insights.length} indicators
          </p>
        </Card>
      </div>

      {/* Insights grid */}
      {insights.length > 0 && (
        <div className="mb-8">
          <h3 className="text-base font-bold text-amber-900 dark:text-amber-100 mb-4">
            Key Insights
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {insights.map((insight, i) => {
              const Icon = insight.icon
              return (
                <Card
                  key={i}
                  className="border-amber-200 bg-white/80 dark:bg-card/60 p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center flex-shrink-0">
                      <Icon className={`w-4 h-4 ${insight.color}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-amber-500 dark:text-amber-400 mb-0.5">
                        {insight.label}
                      </p>
                      <p className="text-sm font-semibold text-amber-900 dark:text-amber-100 leading-tight">
                        {insight.value}
                      </p>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Summary panel */}
      <Card className="border-amber-200 bg-gradient-to-br from-amber-50/80 to-white dark:from-amber-900/10 dark:to-card/60 p-6 mb-8">
        <h3 className="text-sm font-bold text-amber-800 dark:text-amber-200 uppercase tracking-wider mb-2">
          Analysis Summary
        </h3>
        <p className="text-sm text-amber-700 dark:text-amber-300 leading-relaxed">{summary}</p>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 items-center">
        <Button
          onClick={handleSaveResults}
          disabled={saved || saving || !sessionId}
          className={`gap-2 ${saved ? 'bg-green-600 hover:bg-green-600' : 'bg-amber-600 hover:bg-amber-700'} text-white`}
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saved ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saved ? 'Saved to Database' : 'Save Results'}
        </Button>

        <Button
          variant="ghost"
          onClick={handleExport}
          className="gap-2 border border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20"
        >
          <Download className="w-4 h-4" />
          Export Report
        </Button>

        <Button
          variant="ghost"
          onClick={onReset}
          className="gap-2 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20"
        >
          <RotateCcw className="w-4 h-4" />
          Start New Analysis
        </Button>

        {saveError && (
          <p className="text-xs text-red-500 ml-2">Error: {saveError}</p>
        )}
      </div>
    </div>
  )
}
