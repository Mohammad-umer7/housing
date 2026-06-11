'use client'

import { useState, useEffect } from 'react'
import { CalendarDays, History, Loader2, RefreshCw, CheckCircle, AlertCircle, FileText } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MeetingConciergeForm } from './input-forms/meeting-concierge-form'
import { saveMeetingData, fetchMeetings } from '@/lib/supabase-operations'
import { isSupabaseConfigured } from '@/lib/supabase'
import type { MeetingFormData } from '@/types/database'

const emptyMeeting: MeetingFormData = {
  meetingDate: '',
  meetingTime: '',
  attendees: [],
  countryOfInterest: '',
  bilateralSummaries: '',
}

type Meeting = {
  id: string
  meeting_date: string | null
  meeting_time: string | null
  country_of_interest: string | null
  attendees: Array<{ name: string; organization: string }> | null
  bilateral_summaries: string | null
  created_at: string
}

export function MeetingConciergeView() {
  const [formData, setFormData] = useState<MeetingFormData>(emptyMeeting)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loadingMeetings, setLoadingMeetings] = useState(false)
  const [briefing, setBriefing] = useState<string | null>(null)

  const loadMeetings = async () => {
    setLoadingMeetings(true)
    const { data } = await fetchMeetings()
    setMeetings(data)
    setLoadingMeetings(false)
  }

  useEffect(() => {
    if (isSupabaseConfigured) {
      loadMeetings()
    }
  }, [])

  const handleSchedule = async () => {
    setSaving(true)
    setSaveStatus('idle')
    setSaveError(null)
    setBriefing(null)

    const { error } = await saveMeetingData(null, formData)
    setSaving(false)

    if (error) {
      setSaveStatus('error')
      setSaveError(error)
    } else {
      setSaveStatus('success')
      setFormData(emptyMeeting)
      if (isSupabaseConfigured) loadMeetings()
    }
  }

  const handleGenerateBriefing = () => {
    const lines: string[] = [
      '═══════════════════════════════════════',
      '   MOE STRATEGIST — MEETING BRIEFING',
      '═══════════════════════════════════════',
      '',
      `Country of Interest : ${formData.countryOfInterest || '(not specified)'}`,
      `Meeting Date        : ${formData.meetingDate || '(not specified)'}`,
      `Meeting Time        : ${formData.meetingTime || '(not specified)'}`,
      '',
      'ATTENDEES',
      '─────────',
      ...(formData.attendees.length > 0
        ? formData.attendees.map((a, i) => `  ${i + 1}. ${a.name}${a.organization ? ` — ${a.organization}` : ''}`)
        : ['  (none added)']),
      '',
      'BILATERAL AGREEMENT SUMMARIES',
      '──────────────────────────────',
      formData.bilateralSummaries?.trim()
        ? formData.bilateralSummaries
        : '  (none provided)',
      '',
      '───────────────────────────────────────',
      `Generated: ${new Date().toLocaleString()}`,
    ]
    setBriefing(lines.join('\n'))
  }

  const downloadBriefing = () => {
    if (!briefing) return
    const blob = new Blob([briefing], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `meeting-briefing-${formData.countryOfInterest || 'bilateral'}-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-br from-amber-50 via-amber-50/80 to-amber-100 dark:from-background dark:via-background dark:to-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-600 to-amber-700 rounded-xl flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-amber-900 dark:text-amber-100">
                Meeting Concierge
              </h1>
              <p className="text-amber-600 dark:text-amber-400 text-sm">
                Schedule diplomatic meetings and manage bilateral agreement intelligence
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* ── Left: Form (3/5 width) ─────────────────────────────────── */}
          <div className="lg:col-span-3">
            <Card className="border-amber-200 bg-white/80 dark:bg-card/60 p-6">
              <MeetingConciergeForm data={formData} onChange={setFormData} />

              {/* Actions */}
              <div className="mt-6 pt-4 border-t border-amber-100 dark:border-amber-900/30 flex flex-wrap gap-3">
                <Button
                  onClick={handleSchedule}
                  disabled={saving}
                  className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CalendarDays className="w-4 h-4" />
                  )}
                  {saving ? 'Scheduling...' : 'Schedule Meeting'}
                </Button>

                <Button
                  variant="ghost"
                  onClick={handleGenerateBriefing}
                  className="gap-2 border border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                >
                  <FileText className="w-4 h-4" />
                  Generate Briefing
                </Button>
              </div>

              {/* Status feedback */}
              {saveStatus === 'success' && (
                <div className="mt-3 flex items-center gap-2 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30 rounded-lg px-3 py-2">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  Meeting scheduled and saved successfully!
                </div>
              )}
              {saveStatus === 'error' && (
                <div className="mt-3 flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-lg px-3 py-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {saveError ?? 'Failed to save — check Supabase config'}
                </div>
              )}

              {/* Briefing output */}
              {briefing && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                      Generated Briefing
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={downloadBriefing}
                      className="text-xs text-amber-600 dark:text-amber-400 gap-1"
                    >
                      Download
                    </Button>
                  </div>
                  <pre className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-lg p-4 text-xs text-amber-800 dark:text-amber-200 whitespace-pre-wrap font-mono leading-relaxed overflow-auto max-h-64">
                    {briefing}
                  </pre>
                </div>
              )}
            </Card>
          </div>

          {/* ── Right: History (2/5 width) ─────────────────────────────── */}
          <div className="lg:col-span-2">
            <Card className="border-amber-200 bg-white/80 dark:bg-card/60 p-5 h-full">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-amber-600" />
                  <h3 className="text-sm font-bold text-amber-900 dark:text-amber-100">
                    Past Meetings
                  </h3>
                </div>
                {isSupabaseConfigured && (
                  <button
                    onClick={loadMeetings}
                    className="text-amber-500 hover:text-amber-700 transition-colors"
                    title="Refresh"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingMeetings ? 'animate-spin' : ''}`} />
                  </button>
                )}
              </div>

              {!isSupabaseConfigured ? (
                <div className="text-center py-8 text-amber-500 dark:text-amber-600">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Configure Supabase in .env.local to view history</p>
                </div>
              ) : loadingMeetings ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
                </div>
              ) : meetings.length === 0 ? (
                <div className="text-center py-8 text-amber-400 dark:text-amber-600">
                  <CalendarDays className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No meetings scheduled yet</p>
                </div>
              ) : (
                <div className="space-y-3 overflow-y-auto max-h-[60vh]">
                  {meetings.map((m) => (
                    <div
                      key={m.id}
                      className="border border-amber-100 dark:border-amber-900/30 rounded-xl p-3 bg-amber-50/40 dark:bg-amber-900/10 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-amber-900 dark:text-amber-100 truncate">
                            {m.country_of_interest ?? '(No country)'}
                          </p>
                          <p className="text-xs text-amber-500 dark:text-amber-500">
                            {m.meeting_date ? `${m.meeting_date}` : 'Date TBD'}
                            {m.meeting_time ? ` at ${m.meeting_time}` : ''}
                          </p>
                        </div>
                        <span className="flex-shrink-0 text-xs bg-amber-100 dark:bg-amber-800/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full">
                          {m.attendees?.length ?? 0} attendees
                        </span>
                      </div>
                      {m.bilateral_summaries && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5 line-clamp-2">
                          {m.bilateral_summaries}
                        </p>
                      )}
                      <p className="text-xs text-amber-400 dark:text-amber-600 mt-1">
                        Saved {new Date(m.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
