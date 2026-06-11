'use client'

import { TrendingUp, Brain, Info } from 'lucide-react'
import type { ScenarioFormData } from '@/types/database'

interface ScenarioPlanningFormProps {
  data: ScenarioFormData
  onChange: (data: ScenarioFormData) => void
}

function FieldLabel({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="flex items-start gap-1.5 mb-1.5">
      <label className="text-sm font-semibold text-amber-900 dark:text-amber-200">{label}</label>
      <div className="group relative mt-0.5">
        <Info className="w-3.5 h-3.5 text-amber-400 cursor-help" />
        <div className="absolute left-5 top-0 w-64 bg-amber-900 text-amber-50 text-xs rounded-lg p-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none shadow-xl">
          {hint}
        </div>
      </div>
    </div>
  )
}

const textareaClass =
  'w-full rounded-lg border border-amber-200 dark:border-amber-800/50 bg-white dark:bg-card/60 px-3 py-2.5 text-sm text-amber-900 dark:text-amber-100 placeholder:text-amber-400 dark:placeholder:text-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none transition-all'

export function ScenarioPlanningForm({ data, onChange }: ScenarioPlanningFormProps) {
  const set = (key: keyof ScenarioFormData) => (e: React.ChangeEvent<HTMLTextAreaElement>) =>
    onChange({ ...data, [key]: e.target.value })

  return (
    <div className="space-y-8">
      {/* ── Section 1: Time-Series ─────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-600 to-amber-700 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-base font-bold text-amber-900 dark:text-amber-100">
              Quantitative Time-Series Data
            </h3>
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Paste CSV, tab-separated, or one value per line (Year, Value)
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Trade Volumes */}
          <div className="bg-amber-50/60 dark:bg-amber-900/10 rounded-xl p-4 border border-amber-100 dark:border-amber-900/30">
            <FieldLabel
              label="Trade Volumes"
              hint="Historical trade volume data. Format: Year,Value (one per line) e.g. 2020,450000"
            />
            <textarea
              rows={7}
              className={textareaClass}
              placeholder={'2020, 450000\n2021, 520000\n2022, 610000\n2023, 580000\n2024, 640000'}
              value={data.tradeVolumes}
              onChange={set('tradeVolumes')}
            />
            <p className="text-xs text-amber-500 mt-1.5">USD millions or units</p>
          </div>

          {/* GDP Growth Rates */}
          <div className="bg-amber-50/60 dark:bg-amber-900/10 rounded-xl p-4 border border-amber-100 dark:border-amber-900/30">
            <FieldLabel
              label="Historical GDP Growth Rates"
              hint="Annual GDP growth percentage. Format: Year,Rate e.g. 2020,-3.1"
            />
            <textarea
              rows={7}
              className={textareaClass}
              placeholder={'2020, -3.1\n2021, 5.7\n2022, 3.4\n2023, 2.8\n2024, 3.1'}
              value={data.gdpGrowthRates}
              onChange={set('gdpGrowthRates')}
            />
            <p className="text-xs text-amber-500 mt-1.5">Percentage (%)</p>
          </div>

          {/* Infrastructure Investments */}
          <div className="bg-amber-50/60 dark:bg-amber-900/10 rounded-xl p-4 border border-amber-100 dark:border-amber-900/30">
            <FieldLabel
              label="Infrastructure Investment Amounts"
              hint="Past infrastructure spending. Format: Year,Amount e.g. 2020,12000"
            />
            <textarea
              rows={7}
              className={textareaClass}
              placeholder={'2020, 12000\n2021, 15500\n2022, 18200\n2023, 21000\n2024, 24500'}
              value={data.infrastructureInvestments}
              onChange={set('infrastructureInvestments')}
            />
            <p className="text-xs text-amber-500 mt-1.5">USD millions</p>
          </div>
        </div>
      </div>

      {/* ── Section 2: Sentiment Sources ──────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-yellow-600 flex items-center justify-center">
            <Brain className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-base font-bold text-amber-900 dark:text-amber-100">
              Sentiment Analysis Sources
            </h3>
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Paste unstructured text data for NLP sentiment analysis
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* News Articles */}
          <div className="bg-amber-50/60 dark:bg-amber-900/10 rounded-xl p-4 border border-amber-100 dark:border-amber-900/30">
            <FieldLabel
              label="Recent News Articles"
              hint="Paste recent news article text or headlines relevant to this country/sector."
            />
            <textarea
              rows={5}
              className={textareaClass}
              placeholder="Paste news article text or headlines here..."
              value={data.newsArticles}
              onChange={set('newsArticles')}
            />
          </div>

          {/* Press Releases */}
          <div className="bg-amber-50/60 dark:bg-amber-900/10 rounded-xl p-4 border border-amber-100 dark:border-amber-900/30">
            <FieldLabel
              label="Press Releases"
              hint="Official press releases from government bodies, central banks, or key institutions."
            />
            <textarea
              rows={5}
              className={textareaClass}
              placeholder="Paste press release content here..."
              value={data.pressReleases}
              onChange={set('pressReleases')}
            />
          </div>

          {/* Diplomatic Transcripts */}
          <div className="bg-amber-50/60 dark:bg-amber-900/10 rounded-xl p-4 border border-amber-100 dark:border-amber-900/30">
            <FieldLabel
              label="Diplomatic Transcripts"
              hint="Transcripts from bilateral talks, summits, or diplomatic communiqués."
            />
            <textarea
              rows={5}
              className={textareaClass}
              placeholder="Paste diplomatic transcript text here..."
              value={data.diplomaticTranscripts}
              onChange={set('diplomaticTranscripts')}
            />
          </div>

          {/* Policy Announcements */}
          <div className="bg-amber-50/60 dark:bg-amber-900/10 rounded-xl p-4 border border-amber-100 dark:border-amber-900/30">
            <FieldLabel
              label="Official Policy Announcements"
              hint="Published policy documents, budget statements, and legislative announcements."
            />
            <textarea
              rows={5}
              className={textareaClass}
              placeholder="Paste policy announcement text here..."
              value={data.policyAnnouncements}
              onChange={set('policyAnnouncements')}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
