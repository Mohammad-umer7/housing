'use client'

import { Input } from '@/components/ui/input'

interface CountrySelectorProps {
  label: string
  value: string
  onChange: (country: string) => void
}

const countries = [
  'UAE',
  'Norway',
  'Germany',
  'Singapore',
  'Canada',
  'Australia',
  'Japan',
  'USA',
  'China',
  'India',
  'Brazil',
  'France',
]

export function CountrySelector({ label, value, onChange }: CountrySelectorProps) {
  return (
    <div className="rounded-lg border border-amber-200 bg-white/80 p-4">
      <label className="block text-sm font-medium text-amber-900 mb-3">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-amber-200 bg-white text-amber-900 appearance-none cursor-pointer hover:border-amber-300 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
        >
          {countries.map((country) => (
            <option key={country} value={country}>
              {country}
            </option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-amber-600">
          ▼
        </div>
      </div>
    </div>
  )
}
