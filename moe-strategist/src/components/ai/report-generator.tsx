'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Download,
  FileText,
  X,
  Sparkles,
  Copy,
  Share2,
  Loader,
} from 'lucide-react'

interface AIReportGeneratorProps {
  onClose: () => void
}

type ReportType = 'briefing' | 'summary' | 'visual'
type GenerationState = 'idle' | 'generating' | 'complete'

export function AIReportGenerator({ onClose }: AIReportGeneratorProps) {
  const [reportType, setReportType] = useState<ReportType>('briefing')
  const [generationState, setGenerationState] = useState<GenerationState>('idle')
  const [reportContent, setReportContent] = useState('')
  const [talkingPoints, setTalkingPoints] = useState<string[]>([])

  const handleGenerateReport = async () => {
    setGenerationState('generating')
    setReportContent('')

    // Simulate AI generation with streaming effect
    const content = `# Executive Briefing Deck: Global Strategic Analysis

## Key Findings

### Energy Sustainability Trends
- Global renewable energy adoption reached 4,215 GW in Q2 2026
- UAE and Norway demonstrate contrasting energy strategies
- UAE focuses on solar and nuclear integration
- Norway leverages hydroelectric and wind power

### Economic Indicators
- Global GDP growth maintained at 2.8% YoY
- Infrastructure investments up by 3.5% across APAC region
- Bilateral trade agreements increased by 12% in emerging markets

### Strategic Recommendations
1. Accelerate renewable energy transition
2. Strengthen bilateral partnerships in Southeast Asia
3. Invest in infrastructure modernization
4. Foster technology transfer agreements`

    const points = [
      'Energy sector growth outpacing economic growth',
      'Sustainability metrics improving across key markets',
      'Infrastructure development critical for competitiveness',
      'International partnerships driving innovation',
    ]

    // Simulate streaming
    let contentIndex = 0
    const interval = setInterval(() => {
      if (contentIndex < content.length) {
        setReportContent(content.substring(0, contentIndex))
        contentIndex += 20
      } else {
        clearInterval(interval)
        setGenerationState('complete')
        setTalkingPoints(points)
      }
    }, 50)
  }

  const handleDownloadPDF = () => {
    console.log('Downloading as PDF...')
  }

  const handleDownloadPowerPoint = () => {
    console.log('Downloading as PowerPoint...')
  }

  const handleCopyText = () => {
    navigator.clipboard.writeText(reportContent)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="w-full max-w-4xl max-h-[90vh] overflow-hidden bg-white rounded-lg border border-amber-200 shadow-2xl flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-amber-200">
            <div className="flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-amber-600" />
              <h2 className="text-2xl font-bold text-amber-900">AI Report Generator</h2>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="hover:bg-amber-100"
            >
              <X className="w-6 h-6" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Report Type Selection */}
            {generationState === 'idle' && (
              <div>
                <label className="block text-sm font-semibold text-amber-900 mb-4">
                  Select Report Type
                </label>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { id: 'briefing', title: 'Briefing Deck', icon: '📊' },
                    { id: 'summary', title: 'Summary Report', icon: '📄' },
                    { id: 'visual', title: 'Visual Insight', icon: '🎨' },
                  ].map((type) => (
                    <button
                      key={type.id}
                      onClick={() =>
                        setReportType(type.id as ReportType)
                      }
                      className={`p-4 rounded-lg border-2 transition-all ${
                        reportType === type.id
                          ? 'border-amber-500 bg-amber-100'
                          : 'border-amber-200 bg-amber-50 hover:border-amber-300'
                      }`}
                    >
                      <div className="text-2xl mb-2">{type.icon}</div>
                      <div className="font-medium text-amber-900 text-sm">
                        {type.title}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Generation State */}
            {generationState === 'generating' && (
              <div className="text-center py-8">
                <div className="flex justify-center mb-4">
                  <Loader className="w-8 h-8 text-amber-600 animate-spin" />
                </div>
                <p className="text-amber-800 font-medium">
                  Analyzing data and generating report...
                </p>
                <div className="mt-4 space-y-2 text-sm text-amber-700">
                  <div>✓ Fetching latest infrastructure data</div>
                  <div>⟳ Synthesizing bilateral agreements</div>
                  <div>⟳ Analyzing energy trends</div>
                </div>
              </div>
            )}

            {/* Report Content */}
            {generationState === 'complete' && (
              <div>
                <div className="mb-4 p-4 rounded-lg bg-amber-50 border border-amber-200">
                  <pre className="text-amber-900 text-sm whitespace-pre-wrap font-mono overflow-hidden">
                    {reportContent}
                  </pre>
                </div>

                {/* Talking Points */}
                {talkingPoints.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-amber-900 mb-3">
                      Key Talking Points
                    </h3>
                    <div className="space-y-2">
                      {talkingPoints.map((point, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200"
                        >
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-600 flex items-center justify-center text-white text-xs font-bold">
                            {idx + 1}
                          </span>
                          <span className="text-amber-900">{point}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="border-t border-amber-200 p-6 bg-amber-50/50 flex gap-3 justify-end">
            {generationState === 'idle' && (
              <>
                <Button variant="ghost" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  onClick={handleGenerateReport}
                  className="gap-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white"
                >
                  <Sparkles className="w-4 h-4" />
                  Generate Report
                </Button>
              </>
            )}

            {generationState === 'complete' && (
              <>
                <Button
                  variant="ghost"
                  onClick={handleCopyText}
                  className="gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Copy
                </Button>
                <Button
                  variant="ghost"
                  className="gap-2"
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </Button>
                <Button
                  onClick={handleDownloadPDF}
                  className="gap-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white"
                >
                  <Download className="w-4 h-4" />
                  PDF
                </Button>
                <Button
                  onClick={handleDownloadPowerPoint}
                  className="gap-2 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white"
                >
                  <Download className="w-4 h-4" />
                  PowerPoint
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
