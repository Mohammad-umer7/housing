'use client'

import { Globe, DollarSign } from 'lucide-react'
import { Input } from '@/components/ui/input'
import type { EconomicFormData } from '@/types/database'

interface EconomicDataFormProps {
  data: EconomicFormData
  onChange: (data: EconomicFormData) => void
}

const inputClass =
  'w-full rounded-lg border border-amber-200 dark:border-amber-800/50 bg-white dark:bg-card/60 px-3 py-2.5 text-sm text-amber-900 dark:text-amber-100 placeholder:text-amber-400 dark:placeholder:text-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all'

function Field({
  label,
  placeholder,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-amber-900 dark:text-amber-200 mb-1.5">
        {label}
      </label>
      <Input
        type={type}
        className={inputClass}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

export function EconomicDataForm({ data, onChange }: EconomicDataFormProps) {
  const set = (key: keyof EconomicFormData) => (v: string) =>
    onChange({ ...data, [key]: v })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-600 to-amber-700 flex items-center justify-center">
          <Globe className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="text-base font-bold text-amber-900 dark:text-amber-100">
            Economic Data Entry
          </h3>
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Manually enter country economic indicators
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field
          label="Country"
          placeholder="e.g. Saudi Arabia"
          value={data.country}
          onChange={set('country')}
        />

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Year From"
            placeholder="2018"
            value={data.yearFrom}
            onChange={set('yearFrom')}
            type="number"
          />
          <Field
            label="Year To"
            placeholder="2024"
            value={data.yearTo}
            onChange={set('yearTo')}
            type="number"
          />
        </div>

        <div className="bg-amber-50/60 dark:bg-amber-900/10 rounded-xl p-4 border border-amber-100 dark:border-amber-900/30">
          <div className="flex items-center gap-1.5 mb-3">
            <DollarSign className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              Key Indicators
            </span>
          </div>
          <div className="space-y-3">
            <Field
              label="GDP (USD Billions)"
              placeholder="e.g. 1060.0"
              value={data.gdp}
              onChange={set('gdp')}
              type="number"
            />
            <Field
              label="Trade Balance (USD Billions)"
              placeholder="e.g. 150.5"
              value={data.tradeBalance}
              onChange={set('tradeBalance')}
              type="number"
            />
          </div>
        </div>

        <div className="bg-amber-50/60 dark:bg-amber-900/10 rounded-xl p-4 border border-amber-100 dark:border-amber-900/30">
          <div className="flex items-center gap-1.5 mb-3">
            <DollarSign className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              Investment Metrics
            </span>
          </div>
          <div className="space-y-3">
            <Field
              label="Inflation Rate (%)"
              placeholder="e.g. 2.3"
              value={data.inflationRate}
              onChange={set('inflationRate')}
              type="number"
            />
            <Field
              label="FDI Inflows (USD Billions)"
              placeholder="e.g. 45.2"
              value={data.fdiInflows}
              onChange={set('fdiInflows')}
              type="number"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
