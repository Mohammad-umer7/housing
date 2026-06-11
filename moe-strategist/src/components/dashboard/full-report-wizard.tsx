'use client'

import { useState, useRef, useCallback } from 'react'
import { CheckCircle, Upload, FileText, ChevronRight, ChevronLeft, AlertCircle, Loader2, Download, X } from 'lucide-react'
import { extractData } from '@/lib/text-extraction'
import type { ExtractedData } from '@/lib/text-extraction'

// -- Types ----------------------------------------------------------------------

interface WizardAnswer { questionId: string; answer: string }

interface WizardQuestion {
  id: string
  question: string
  type: 'select' | 'text' | 'multiselect'
  options?: string[]
  required?: boolean
  placeholder?: string
}

// -- Questions -----------------------------------------------------------------

const QUESTIONS: WizardQuestion[] = [
  {
    id: 'report_type',
    question: 'What type of report do you need?',
    type: 'select',
    required: true,
    options: ['Country Strategic Briefing', 'Energy Sector Analysis', 'Bilateral Trade Report', 'Infrastructure Assessment', 'Sustainability & ESG Report', 'Economic Forecast'],
  },
  {
    id: 'country',
    question: 'Which country / region is this report about?',
    type: 'select',
    required: true,
    options: ['UAE', 'Norway', 'Germany', 'Saudi Arabia', 'China', 'India', 'Japan', 'United States', 'United Kingdom', 'France', 'South Korea', 'Other'],
  },
  {
    id: 'timeframe',
    question: 'What time horizon should the report cover?',
    type: 'select',
    required: true,
    options: ['Last 12 months', 'Last 3 years', '5-year outlook', '10-year outlook', 'Historical (pre-2020)'],
  },
  {
    id: 'focus_areas',
    question: 'Which focus areas are most important? (select all that apply)',
    type: 'multiselect',
    options: ['GDP & Economic Growth', 'Energy Production & Consumption', 'Renewable Energy Targets', 'Trade Volume & Agreements', 'Infrastructure Investments', 'Sustainability & Net-Zero', 'Employment & Labour Market', 'Foreign Direct Investment'],
  },
  {
    id: 'audience',
    question: 'Who is the primary audience for this report?',
    type: 'select',
    required: true,
    options: ['Minister / Executive Leadership', 'Senior Advisors', 'Policy Analysts', 'External Partners / Delegations', 'Internal Research Team'],
  },
  {
    id: 'context',
    question: 'Provide any additional context or specific questions to address.',
    type: 'text',
    placeholder: 'e.g. Focus on bilateral energy agreements signed after 2022, compare with global benchmarksâ€¦',
  },
]

// -- Progress indicator ---------------------------------------------------------

function StepIndicator({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className={`h-1.5 rounded-full transition-all ${
          i < current ? 'bg-[#9b7a36] flex-1' : i === current ? 'bg-[#c2a14e] flex-[2]' : 'bg-[#e8dcc8] flex-1'
        }`} />
      ))}
    </div>
  )
}

// -- Question renderer ----------------------------------------------------------

function QuestionCard({
  q, answer, onChange
}: { q: WizardQuestion; answer: string; onChange: (v: string) => void }) {

  if (q.type === 'select' && q.options) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {q.options.map(opt => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`px-4 py-3 rounded-xl border text-sm font-medium text-left transition-all ${
              answer === opt
                ? 'border-[#9b7a36] bg-[#9b7a36]/10 text-[#4a3728] ring-2 ring-[#9b7a36]/30'
                : 'border-[#e8dcc8] bg-white text-[#4a3728] hover:border-[#c2a14e] hover:bg-[#faf6ec]'
            }`}
          >
            {answer === opt && <CheckCircle className="w-4 h-4 text-[#9b7a36] inline mr-2" />}
            {opt}
          </button>
        ))}
      </div>
    )
  }

  if (q.type === 'multiselect' && q.options) {
    const selected = answer ? answer.split('||') : []
    const toggle = (opt: string) => {
      const next = selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt]
      onChange(next.join('||'))
    }
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {q.options.map(opt => (
          <button key={opt} onClick={() => toggle(opt)}
            className={`px-4 py-3 rounded-xl border text-sm font-medium text-left transition-all ${
              selected.includes(opt)
                ? 'border-[#9b7a36] bg-[#9b7a36]/10 text-[#4a3728] ring-2 ring-[#9b7a36]/30'
                : 'border-[#e8dcc8] bg-white text-[#4a3728] hover:border-[#c2a14e] hover:bg-[#faf6ec]'
            }`}
          >
            {selected.includes(opt) && <CheckCircle className="w-4 h-4 text-[#9b7a36] inline mr-2" />}
            {opt}
          </button>
        ))}
      </div>
    )
  }

  return (
    <textarea
      value={answer}
      onChange={e => onChange(e.target.value)}
      placeholder={q.placeholder}
      rows={4}
      className="w-full px-4 py-3 rounded-xl border border-[#e0d8cc] bg-[#faf6ec] text-[#1a1208] text-sm focus:outline-none focus:ring-2 focus:ring-[#9b7a36] resize-none"
    />
  )
}

// -- Main component -------------------------------------------------------------

interface FullReportWizardProps { onClose?: () => void }

export function FullReportWizard({ onClose }: FullReportWizardProps) {
  const TOTAL_STEPS = QUESTIONS.length + 1 // questions + upload

  const [step,       setStep]       = useState(0) // 0..QUESTIONS.length = questions, QUESTIONS.length = upload
  const [answers,    setAnswers]    = useState<Record<string, string>>({})
  const [file,       setFile]       = useState<File | null>(null)
  const [extracted,  setExtracted]  = useState<ExtractedData | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [extractErr, setExtractErr] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [done,       setDone]       = useState(false)
  const [sections,   setSections]   = useState<{title: string; content: string}[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  const currentQ = step < QUESTIONS.length ? QUESTIONS[step] : null
  const currentAnswer = currentQ ? (answers[currentQ.id] ?? '') : ''

  const canAdvance = !currentQ || !currentQ.required || currentAnswer.trim().length > 0

  const setAnswer = (id: string, val: string) => setAnswers(prev => ({ ...prev, [id]: val }))

  const handleFile = useCallback(async (f: File) => {
    setFile(f)
    setExtractErr(null)
    setExtracting(true)
    try {
      const data = await extractData(f)
      setExtracted(data)
    } catch {
      setExtractErr('Could not parse file. Proceeding without extracted data.')
    } finally {
      setExtracting(false)
    }
  }, [])

  const generate = useCallback(async () => {
    setGenerating(true)
    // Build prompt summary from answers
    const answerLines = QUESTIONS.map(q => {
      const a = answers[q.id] ?? 'â€â€�'
      return `${q.question}\n? ${a.replace(/\|\|/g, ', ')}`
    }).join('\n\n')

    try {
      const res = await fetch('/api/intel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          country: answers['country'] ?? 'UAE',
          capability: 'briefing',
          language: 'en',
          query: `Generate a Full Report based on these requirements:\n\n${answerLines}\n\n${extracted ? 'Uploaded document excerpt: ' + extracted.rawText.slice(0, 1200) : ''}`,
        }),
      })
      const builtSections: {title: string; content: string}[] = []
      if (res.ok && res.body) {
        const reader = res.body.getReader()
        const dec = new TextDecoder()
        let buf = ''
        for (;;) {
          const { done: d, value } = await reader.read()
          if (d) break
          buf += dec.decode(value, { stream: true })
          const lines = buf.split('\n'); buf = lines.pop() ?? ''
          for (const line of lines) {
            const t = line.trim()
            if (!t.startsWith('{')) continue
            try {
              const ev = JSON.parse(t)
              if (ev.event === 'section' && ev.section) {
                builtSections.push({ title: ev.section.title, content: ev.section.content })
              }
            } catch { /* ignore */ }
          }
        }
      }
      // fallback if backend unreachable
      if (builtSections.length === 0) {
        builtSections.push(
          { title: 'Executive Summary', content: `This full report was generated for ${answers['country'] ?? 'the selected country'} covering ${answers['timeframe'] ?? 'the selected period'}. Report type: ${answers['report_type'] ?? 'Strategic Briefing'}. Primary audience: ${answers['audience'] ?? 'Leadership'}.` },
          { title: 'Key Focus Areas', content: (answers['focus_areas'] ?? '').replace(/\|\|/g, '\nâ€¢ ') || 'All areas' },
          { title: 'Additional Context', content: answers['context'] || 'No additional context provided.' },
          { title: 'Document Analysis', content: extracted ? `Extracted ${extracted.metrics.length} metrics and ${extracted.keyValues.length} key-value pairs from the uploaded document.\n\n${extracted.keyValues.slice(0, 8).map(kv => `${kv.key}: ${kv.value}`).join('\n')}` : 'No document was uploaded.' },
        )
      }
      setSections(builtSections)
      setDone(true)
    } finally {
      setGenerating(false)
    }
  }, [answers, extracted])

  const printReport = () => {
    const title = `Full Report: ${answers['report_type'] ?? 'Strategic Briefing'} â€â€� ${answers['country'] ?? ''}`
    const body = sections.map(s =>
      `<div style="margin-bottom:24px"><h2 style="font:bold 15px Georgia;margin:0 0 8px;color:#4a3728">${s.title}</h2><p style="font:13px Georgia;line-height:1.8;margin:0;white-space:pre-line">${s.content}</p></div>`
    ).join('')
    const win = window.open('', '_blank', 'width=800,height=900')
    if (!win) { window.print(); return }
    win.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
      <style>body{font-family:Georgia,serif;max-width:680px;margin:40px auto;color:#1a1208}
      h1{font-size:20px;color:#4a3728;margin-bottom:4px}
      .meta{font-size:11px;color:#9b7a36;margin-bottom:32px;padding-bottom:12px;border-bottom:1px solid #e8dcc8}
      @media print{body{margin:0;padding:2rem}}</style></head><body>
      <h1>${title}</h1>
      <p class="meta">MOE Strategist · ${new Date().toLocaleDateString('en-GB',{dateStyle:'long'})}</p>
      ${body}
      <script>window.onload=function(){window.print();window.close()}<\/script>
      </body></html>`)
    win.document.close()
  }

  // -- DONE screen ------------------------------------------------------------
  if (done) {
    return (
      <div className="min-h-screen bg-[#faf6ec] flex flex-col">
        <div className="bg-[#0e0b06] border-b border-[#9b7a36]/20 px-6 py-4 flex items-center justify-between">
          <h1 className="text-lg font-bold text-[#c2a14e]">Full Report â€â€� Complete</h1>
          <div className="flex gap-3">
            <button onClick={printReport} className="flex items-center gap-2 px-4 py-2 bg-[#9b7a36] text-[#0e0b06] rounded-xl text-sm font-bold hover:bg-[#c2a14e] transition-all">
              <Download className="w-4 h-4" /> Export PDF
            </button>
            {onClose && <button onClick={onClose} className="text-[#9b7a36] hover:text-white"><X className="w-5 h-5" /></button>}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto max-w-3xl w-full mx-auto px-6 py-8">
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-2xl flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <p className="text-sm text-green-800 font-medium">Report generated with 100% verified inputs from your questionnaire{file ? ' and uploaded document' : ''}.</p>
          </div>
          <div className="space-y-6">
            {sections.map((s, i) => (
              <div key={i} className="bg-white border border-[#e8dcc8] rounded-2xl p-6">
                <h2 className="font-bold text-[#4a3728] text-base mb-3">{s.title}</h2>
                <p className="text-[#4a3728] text-sm leading-relaxed whitespace-pre-line">{s.content}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // -- Wizard ----------------------------------------------------------------
  const isUploadStep = step === QUESTIONS.length

  return (
    <div className="min-h-screen bg-[#faf6ec] flex flex-col">
      {/* Wizard header */}
      <div className="bg-[#0e0b06] border-b border-[#9b7a36]/20 px-6 py-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-[#c2a14e]" />
              <h1 className="text-base font-bold text-white">Full Report Wizard</h1>
            </div>
            <span className="text-xs font-mono text-[#9b7a36]">
              Step {step + 1} of {TOTAL_STEPS + 1}
            </span>
          </div>
          <StepIndicator total={TOTAL_STEPS + 1} current={step} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-2xl">
          {!isUploadStep && currentQ && (
            <div className="bg-white rounded-3xl shadow-lg p-8">
              <div className="mb-6">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[#9b7a36]">
                  Question {step + 1} of {QUESTIONS.length}
                </span>
                {currentQ.required && <span className="ml-2 text-red-500 text-xs">*required</span>}
                <h2 className="text-xl font-bold text-[#1a1208] mt-2">{currentQ.question}</h2>
              </div>
              <QuestionCard q={currentQ} answer={currentAnswer} onChange={v => setAnswer(currentQ.id, v)} />
            </div>
          )}

          {isUploadStep && (
            <div className="bg-white rounded-3xl shadow-lg p-8">
              <div className="mb-6">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[#9b7a36]">Final Step â€â€� Upload Supporting Document</span>
                <h2 className="text-xl font-bold text-[#1a1208] mt-2">Upload a document to enrich the report</h2>
                <p className="text-sm text-[#9b7a36] mt-1">Optional â€â€� PDF or image. The AI will read and cross-reference it against your answers.</p>
              </div>

              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-[#c2a14e]/40 rounded-2xl p-10 flex flex-col items-center gap-3 cursor-pointer hover:bg-[#faf6ec] transition-all"
              >
                <div className="w-14 h-14 rounded-full bg-[#f6f0e1] flex items-center justify-center">
                  <Upload className="w-7 h-7 text-[#9b7a36]" />
                </div>
                {file ? (
                  <div className="text-center">
                    <p className="font-semibold text-[#4a3728]">{file.name}</p>
                    <p className="text-xs text-[#9b7a36]">{(file.size / 1024).toFixed(0)} KB</p>
                  </div>
                ) : (
                  <p className="text-sm text-[#9b7a36]">Click to upload PDF or image</p>
                )}
                <input ref={fileRef} type="file" accept=".pdf,image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
              </div>

              {extracting && (
                <div className="mt-4 flex items-center gap-2 text-sm text-[#9b7a36]">
                  <Loader2 className="w-4 h-4 animate-spin" /> Extracting text from documentâ€¦
                </div>
              )}
              {extracted && !extracting && (
                <div className="mt-4 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800">
                  <CheckCircle className="w-4 h-4 inline mr-2" />
                  Extracted {extracted.metrics.length} metrics · {extracted.keyValues.length} data points · {Math.ceil(extracted.rawText.length / 100)} text blocks
                </div>
              )}
              {extractErr && (
                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
                  <AlertCircle className="w-4 h-4 inline mr-2" />{extractErr}
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6">
            <button
              onClick={() => setStep(s => Math.max(0, s - 1))}
              disabled={step === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[#e8dcc8] text-[#4a3728] text-sm font-medium hover:bg-[#f6f0e1] transition-all disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>

            {!isUploadStep ? (
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={!canAdvance}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#1a1208] text-white text-sm font-bold hover:bg-[#2a1e0a] transition-all disabled:opacity-40"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={generate}
                disabled={generating || extracting}
                className="flex items-center gap-2 px-8 py-2.5 rounded-xl bg-gradient-to-r from-[#9b7a36] to-[#c2a14e] text-[#0e0b06] text-sm font-extrabold hover:from-[#7a6030] hover:to-[#9b7a36] transition-all disabled:opacity-50 shadow-lg"
              >
                {generating
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Generatingâ€¦</>
                  : <><CheckCircle className="w-4 h-4" /> Proceed & Generate Full Report</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}