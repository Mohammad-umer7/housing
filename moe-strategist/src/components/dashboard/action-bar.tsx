'use client'

import { Button } from '@/components/ui/button'
import { FileText, BarChart3, Sparkles } from 'lucide-react'

export function ActionBar() {
  return (
    <div className="mt-12 p-6 rounded-xl border border-amber-200 bg-white/80 backdrop-blur-sm">
      <h3 className="text-lg font-semibold text-amber-900 mb-4">Executive Actions</h3>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button className="flex-1 gap-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white">
          <FileText className="w-4 h-4" />
          Generate Briefing Deck
        </Button>
        <Button className="flex-1 gap-2 bg-gradient-to-r from-amber-700 to-amber-800 hover:from-amber-800 hover:to-amber-900 text-white">
          <BarChart3 className="w-4 h-4" />
          Create Summary Report
        </Button>
        <Button className="flex-1 gap-2 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 text-white">
          <Sparkles className="w-4 h-4" />
          Generate Visual Insight
        </Button>
      </div>
    </div>
  )
}
