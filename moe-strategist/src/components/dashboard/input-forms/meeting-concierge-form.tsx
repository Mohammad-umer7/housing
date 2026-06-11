'use client'

import { useState } from 'react'
import { CalendarDays, Clock, Users, Globe, Plus, Trash2, Download } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { MeetingFormData } from '@/types/database'

interface MeetingConciergeFormProps {
  data: MeetingFormData
  onChange: (data: MeetingFormData) => void
}

const inputClass =
  'w-full rounded-lg border border-amber-200 dark:border-amber-800/50 bg-white dark:bg-card/60 px-3 py-2.5 text-sm text-amber-900 dark:text-amber-100 placeholder:text-amber-400 dark:placeholder:text-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all'

const textareaClass =
  'w-full rounded-lg border border-amber-200 dark:border-amber-800/50 bg-white dark:bg-card/60 px-3 py-2.5 text-sm text-amber-900 dark:text-amber-100 placeholder:text-amber-400 dark:placeholder:text-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none transition-all'

export function MeetingConciergeForm({ data, onChange }: MeetingConciergeFormProps) {
  const [newName, setNewName] = useState('')
  const [newOrg, setNewOrg] = useState('')

  const addAttendee = () => {
    if (!newName.trim()) return
    onChange({
      ...data,
      attendees: [...data.attendees, { name: newName.trim(), organization: newOrg.trim() }],
    })
    setNewName('')
    setNewOrg('')
  }

  const removeAttendee = (index: number) => {
    onChange({ ...data, attendees: data.attendees.filter((_, i) => i !== index) })
  }

  const exportICS = () => {
    const start = data.meetingDate && data.meetingTime
      ? `${data.meetingDate.replace(/-/g, '')}T${data.meetingTime.replace(/:/g, '')}00`
      : '20260101T090000'

    const attendeeLines = data.attendees
      .map((a) => `ATTENDEE;CN="${a.name}${a.organization ? ` (${a.organization})` : ''}":MAILTO:unknown@example.com`)
      .join('\n')

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//MOE Strategist//Meeting Concierge//EN',
      'BEGIN:VEVENT',
      `DTSTART:${start}`,
      `SUMMARY:MOE Meeting – ${data.countryOfInterest || 'Bilateral'}`,
      `DESCRIPTION:${data.bilateralSummaries?.replace(/\n/g, '\\n') || ''}`,
      attendeeLines,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\n')

    const blob = new Blob([ics], { type: 'text/calendar' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'meeting.ics'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-600 to-amber-700 flex items-center justify-center">
          <CalendarDays className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="text-base font-bold text-amber-900 dark:text-amber-100">
            Meeting Concierge
          </h3>
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Schedule meetings and attach bilateral agreement summaries
          </p>
        </div>
      </div>

      {/* Date + Time + Country */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-semibold text-amber-900 dark:text-amber-200 mb-1.5 flex items-center gap-1">
            <CalendarDays className="w-3.5 h-3.5" /> Meeting Date
          </label>
          <Input
            type="date"
            className={inputClass}
            value={data.meetingDate}
            onChange={(e) => onChange({ ...data, meetingDate: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-amber-900 dark:text-amber-200 mb-1.5 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> Meeting Time
          </label>
          <Input
            type="time"
            className={inputClass}
            value={data.meetingTime}
            onChange={(e) => onChange({ ...data, meetingTime: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-amber-900 dark:text-amber-200 mb-1.5 flex items-center gap-1">
            <Globe className="w-3.5 h-3.5" /> Country of Interest
          </label>
          <Input
            className={inputClass}
            placeholder="e.g. Japan"
            value={data.countryOfInterest}
            onChange={(e) => onChange({ ...data, countryOfInterest: e.target.value })}
          />
        </div>
      </div>

      {/* Attendees */}
      <div className="bg-amber-50/60 dark:bg-amber-900/10 rounded-xl p-4 border border-amber-100 dark:border-amber-900/30">
        <label className="block text-sm font-semibold text-amber-900 dark:text-amber-200 mb-3 flex items-center gap-1">
          <Users className="w-3.5 h-3.5" /> Attendees
        </label>

        {/* Add attendee row */}
        <div className="flex gap-2 mb-3">
          <Input
            className={inputClass}
            placeholder="Full name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addAttendee()}
          />
          <Input
            className={inputClass}
            placeholder="Organization"
            value={newOrg}
            onChange={(e) => setNewOrg(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addAttendee()}
          />
          <Button
            type="button"
            onClick={addAttendee}
            className="bg-amber-600 hover:bg-amber-700 text-white flex-shrink-0"
            size="sm"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {/* Attendee list */}
        {data.attendees.length === 0 ? (
          <p className="text-xs text-amber-400 dark:text-amber-600 text-center py-2">
            No attendees added yet
          </p>
        ) : (
          <ul className="space-y-2">
            {data.attendees.map((a, i) => (
              <li
                key={i}
                className="flex items-center justify-between bg-white dark:bg-card/40 rounded-lg px-3 py-2 border border-amber-100 dark:border-amber-900/30"
              >
                <div>
                  <span className="text-sm font-medium text-amber-900 dark:text-amber-100">
                    {a.name}
                  </span>
                  {a.organization && (
                    <span className="text-xs text-amber-500 ml-2">– {a.organization}</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeAttendee(i)}
                  className="text-red-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Bilateral Summaries */}
      <div>
        <label className="block text-sm font-semibold text-amber-900 dark:text-amber-200 mb-1.5">
          Historical Bilateral Agreement Summaries
        </label>
        <textarea
          rows={5}
          className={textareaClass}
          placeholder="Paste or summarize past bilateral agreements, treaties, MOUs, and framework documents relevant to this meeting..."
          value={data.bilateralSummaries}
          onChange={(e) => onChange({ ...data, bilateralSummaries: e.target.value })}
        />
      </div>

      {/* Export ICS */}
      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          onClick={exportICS}
          className="gap-2 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20"
          size="sm"
        >
          <Download className="w-4 h-4" />
          Export as .ics (Calendar)
        </Button>
      </div>
    </div>
  )
}
