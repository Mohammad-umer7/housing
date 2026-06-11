'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { OFFICIAL_MOEI_RULES } from '@/governance/housing-arrears'
import { Ico, DataHead, Field } from '@/components/saddad-ui'
import { useA11y } from '@/components/AccessibilityProvider'
import { SIGN_LANGUAGE_VIDEOS, useSignLanguageVideo } from '@/components/SignLanguageProvider'

// MOEI arrears rescheduling has NO salary floor — a genuinely low salary is referred to
// an officer by the debt-burden rule (G-03), it is not blocked. We only hard-block
// clearly-invalid input (non-positive numbers). These percentages drive the helper text.
const DEDUCTION_CAP_PCT = Math.round(OFFICIAL_MOEI_RULES.MAX_DEDUCTION_PERCENT * 100)

type PaymentHistoryEntry = { month?: string; status: string }

type LoanDetails = {
  loan_bank_name: string
  loan_account_number: string
  total_loan_amount: number
  remaining_loan_balance: number
  arrears_amount: number
  current_installment: number
  remaining_loan_months: number
  auto_dda: boolean
  monthly_expenses: number
  family_size: number
  marital_status: string
  income_changed: boolean
  payment_history: PaymentHistoryEntry[]
  number_of_children: number
  social_status: string
  social_status_label: string
  social_status_label_ar: string
  is_priority: boolean
  requiresDocUpload: boolean
  requiredDocLabel: string
  docStage: 'primary' | 'supporting'
  supportingDocLabel: string | null
}

type FormState = {
  full_name: string
  emirates_id: string
  phone: string
  case_number: string
  monthly_salary: string
  arrears_amount: string
  reschedule_reason: string
  months_in_arrears: string
  remarks: string
  consent: boolean
}

type ResubmitGate = {
  blocked: boolean
  state: 'processing' | 'under_review' | 'approved' | null
  reason: string | null
} | null

type Phase = 'idle' | 'submitting' | 'confirmed' | 'error'

type Props = {
  onSubmit: (data: Record<string, string>) => void
  onHome: () => void
}

const STEPS = [
  { num: 1, label: 'Verify Application' },
  { num: 2, label: 'Financial Details' },
  { num: 3, label: 'Documents' },
  { num: 4, label: 'Reason' },
  { num: 5, label: 'Review & Submit' },
]

export default function SubmissionForm({ onSubmit, onHome }: Props) {
  const { t } = useA11y()
  const [form, setForm] = useState<FormState>({
    full_name: '',
    emirates_id: '',
    phone: '',
    case_number: '',
    monthly_salary: '',
    arrears_amount: '',
    reschedule_reason: 'other',
    months_in_arrears: '',
    remarks: '',
    consent: false,
  })
  const [step, setStep] = useState(2)
  const [loanDetails, setLoanDetails] = useState<LoanDetails | null>(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [needsDocuments, setNeedsDocuments] = useState(false)
  const [resubmitGate, setResubmitGate] = useState<ResubmitGate>(null)
  const [files, setFiles] = useState<File[]>([])
  const [dragging, setDragging] = useState(false)
  const [supportingFiles, setSupportingFiles] = useState<File[]>([])
  const [supportingDragging, setSupportingDragging] = useState(false)
  const [certified, setCertified] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [queueInfo, setQueueInfo] = useState<{ position: number; caseId: string } | null>(null)
  const [savedFormData, setSavedFormData] = useState<Record<string, string> | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [stepError, setStepError] = useState<string | null>(null)
  const [requestDescription, setRequestDescription] = useState('')
  const [primaryDescription, setPrimaryDescription] = useState('')
  const [supportingDescription, setSupportingDescription] = useState('')
  const [additionalDocs, setAdditionalDocs] = useState<{ file: File; description: string }[]>([])
  const [additionalDragging, setAdditionalDragging] = useState(false)

  const stepsList = needsDocuments
    ? [
        { num: 1, label: 'Verify Application' },
        { num: 2, label: 'Financial Details' },
        { num: 3, label: 'Documents' },
        { num: 4, label: 'Review & Submit' },
      ]
    : [
        { num: 1, label: 'Verify Application' },
        { num: 2, label: 'Financial Details' },
        { num: 3, label: 'Reason' },
        { num: 4, label: 'Documents' },
        { num: 5, label: 'Review & Submit' },
      ]

  const signLanguageVideo =
    phase === 'confirmed'
      ? SIGN_LANGUAGE_VIDEOS.caseSubmitted
      : (step === 3 && needsDocuments) || step === 4
        ? SIGN_LANGUAGE_VIDEOS.document
        : step === 3 && !needsDocuments
          ? SIGN_LANGUAGE_VIDEOS.reason
          : (step === 5 || (step === 4 && needsDocuments))
            ? null
            : SIGN_LANGUAGE_VIDEOS.financial
  useSignLanguageVideo(signLanguageVideo)

  const lookupCase = useCallback(async (caseNumber: string, targetStep = 2) => {
    if (!caseNumber.trim()) return
    setLookupLoading(true)
    setLookupError(null)
    setLoanDetails(null)
    try {
      const res = await fetch(`/api/v1/cases/lookup?caseNumber=${encodeURIComponent(caseNumber)}`)
      const envelope = await res.json()
      if (!res.ok || !envelope.success) {
        setLookupError(envelope.error || 'Case not found in system')
        return
      }
      const d = envelope.data
      setLoanDetails({
        loan_bank_name: d.loan_bank_name ?? '',
        loan_account_number: d.loan_account_number ?? '',
        total_loan_amount: d.total_loan_amount ?? 0,
        remaining_loan_balance: d.remaining_loan_balance ?? 0,
        arrears_amount: d.arrears_amount ?? 0,
        current_installment: d.current_installment ?? 0,
        remaining_loan_months: d.remaining_loan_months ?? 0,
        auto_dda: d.auto_dda ?? false,
        monthly_expenses: d.monthly_expenses ?? 0,
        family_size: d.family_size ?? 1,
        marital_status: d.marital_status ?? '',
        income_changed: d.income_changed ?? false,
        payment_history: Array.isArray(d.payment_history) ? d.payment_history : [],
        number_of_children: d.uae_pass?.number_of_children ?? 0,
        social_status: d.uae_pass?.social_status ?? 'none',
        social_status_label: d.uae_pass?.social_status_label ?? 'Regular beneficiary',
        social_status_label_ar: d.uae_pass?.social_status_label_ar ?? '',
        is_priority: Boolean(d.uae_pass?.is_priority),
        requiresDocUpload: Boolean(d.requiredDocuments?.requiresUpload),
        requiredDocLabel: d.requiredDocuments?.label ?? 'A recent salary certificate (issued within the last 30 days)',
        docStage: d.requiredDocuments?.stage ?? 'primary',
        supportingDocLabel: d.requiredDocuments?.supporting?.label ?? null,
      })
      const reqDocs = Boolean(d.needsDocuments)
      setNeedsDocuments(reqDocs)
      setResubmitGate(d.resubmission ?? null)
      setForm(p => ({
        ...p,
        case_number: caseNumber,
        full_name: d.full_name ?? p.full_name,
        phone: d.phone ?? p.phone,
        emirates_id: d.emirates_id ?? p.emirates_id,
        monthly_salary: p.monthly_salary || (d.monthly_salary != null ? String(d.monthly_salary) : ''),
        arrears_amount: p.arrears_amount || (d.arrears_amount != null ? String(d.arrears_amount) : ''),
        reschedule_reason: d.reschedule_reason ?? p.reschedule_reason,
        months_in_arrears: p.months_in_arrears || (d.months_in_arrears != null ? String(d.months_in_arrears) : ''),
      }))
      // Step 1 (identity) already happened at UAE PASS sign-in, so we land on Financial
      // Details (step 2). A "Submit Documents" re-submission jumps straight to Documents
      // (step 3), unless the case is a documents-only re-submission which also needs step 3.
      setStep(reqDocs ? 3 : targetStep)
    } catch {
      setLookupError('Could not reach the case lookup service')
    } finally {
      setLookupLoading(false)
    }
  }, [])

  // The Application ID comes from UAE PASS sign-in (or a re-submission from the home page),
  // so the wizard auto-loads the case and starts at Financial Details — there is no manual
  // "Verify Application" step here. Runs exactly once (the ref guard defeats React Strict
  // Mode's double-invoke, which would otherwise re-run lookup and reset the target step).
  const didInitRef = useRef(false)
  useEffect(() => {
    if (typeof window === 'undefined' || didInitRef.current) return
    didInitRef.current = true

    // Resume an in-progress wizard after a page refresh (step + typed values).
    let resumeStep: number | null = null
    let resumeForm: Partial<FormState> | null = null
    try {
      const raw = sessionStorage.getItem('saddad-wizard-state')
      if (raw) { const p = JSON.parse(raw); resumeStep = typeof p.step === 'number' ? p.step : null; resumeForm = p.form ?? null }
    } catch { /* ignore */ }

    const prefill = sessionStorage.getItem('saddad_prefill_appid') || sessionStorage.getItem('saddad_app_id') || resumeForm?.case_number || ''
    const mode = sessionStorage.getItem('saddad_resubmit_mode')
    sessionStorage.removeItem('saddad_prefill_appid')
    sessionStorage.removeItem('saddad_resubmit_mode')

    const seed: Partial<FormState> = { ...(resumeForm ?? {}) }
    if (prefill) seed.case_number = prefill
    // One-time seed of the form from the carried-over App ID / resumed wizard state.
    if (Object.keys(seed).length) setForm(p => ({ ...p, ...seed }))
    if (prefill) {
      const target = mode === 'docs' ? 3 : (resumeStep && resumeStep >= 2 ? resumeStep : 2)
      lookupCase(prefill, target)
    }
  }, [lookupCase])

  // Persist wizard progress (once a case is loaded) so a refresh resumes the same step.
  useEffect(() => {
    if (typeof window === 'undefined' || !loanDetails) return
    try { sessionStorage.setItem('saddad-wizard-state', JSON.stringify({ step, form })) } catch { /* ignore */ }
  }, [step, form, loanDetails])

  function addFiles(list: File[]) {
    const pdfs = list.filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
    setFiles(prev => [...prev, ...pdfs])
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    addFiles(Array.from(e.dataTransfer.files))
  }
  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(e.target.files || []))
  }

  function addSupportingFiles(list: File[]) {
    const pdfs = list.filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
    setSupportingFiles(prev => [...prev, ...pdfs])
  }
  function handleSupportingDrop(e: React.DragEvent) {
    e.preventDefault()
    setSupportingDragging(false)
    addSupportingFiles(Array.from(e.dataTransfer.files))
  }
  function handleSupportingFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    addSupportingFiles(Array.from(e.target.files || []))
  }

  const EXTRA_ALLOWED_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'image/jpeg', 'image/png']
  const EXTRA_ALLOWED_EXTS = ['.pdf', '.docx', '.doc', '.jpg', '.jpeg', '.png']
  function addExtraFiles(list: File[]) {
    const valid = list.filter(f => EXTRA_ALLOWED_TYPES.includes(f.type) || EXTRA_ALLOWED_EXTS.some(ext => f.name.toLowerCase().endsWith(ext)))
    setAdditionalDocs(prev => [...prev, ...valid.map(f => ({ file: f, description: '' }))].slice(0, 10))
  }
  function handleExtraDrop(e: React.DragEvent) { e.preventDefault(); setAdditionalDragging(false); addExtraFiles(Array.from(e.dataTransfer.files)) }
  function handleExtraFileInput(e: React.ChangeEvent<HTMLInputElement>) { addExtraFiles(Array.from(e.target.files ?? [])) }
  function removeExtraDoc(idx: number) { setAdditionalDocs(prev => prev.filter((_, i) => i !== idx)) }
  function updateExtraDesc(idx: number, desc: string) { setAdditionalDocs(prev => prev.map((d, i) => i === idx ? { ...d, description: desc } : d)) }

  // Hard input-sanity gate: salary and amount due must be positive numbers.
  const salaryInvalid = form.monthly_salary.trim() !== '' && !(Number(form.monthly_salary) > 0)
  const arrearsInvalid = form.arrears_amount.trim() !== '' && !(Number(form.arrears_amount) > 0)
  const docRequired = needsDocuments || Boolean(loanDetails?.requiresDocUpload)
  const salary = Number(form.monthly_salary) || 0
  const deductionCeiling = Math.round(salary * OFFICIAL_MOEI_RULES.MAX_DEDUCTION_PERCENT)
  const estimatedArrearsPremium = loanDetails
    ? Math.max(0, deductionCeiling - loanDetails.current_installment)
    : deductionCeiling

  function nextStep() {
    setStepError(null)
    if (step === 2) {
      if (resubmitGate?.blocked) { setStepError(resubmitGate.reason || 'This application cannot be submitted again right now.'); return }
      if (!needsDocuments) {
        if (!(Number(form.monthly_salary) > 0)) { setStepError('Enter a valid monthly salary greater than 0.'); return }
        if (!(Number(form.arrears_amount) > 0)) { setStepError('Enter a valid amount due greater than 0.'); return }
      }
    }
    // Step 3 = Reason (non-needsDocuments) or Documents (needsDocuments)
    if (step === 3 && needsDocuments) {
      if (docRequired && files.length === 0) {
        setStepError(`This case requires a document: ${loanDetails?.requiredDocLabel ?? 'a supporting document'}`)
        return
      }
      setStep(4)
      window.scrollTo(0, 0)
      return
    }
    // Step 4 = Documents (non-needsDocuments) — validate doc before proceeding
    if (step === 4 && !needsDocuments) {
      if (docRequired && files.length === 0) {
        setStepError(`This case requires a document: ${loanDetails?.requiredDocLabel ?? 'a supporting document'}`)
        return
      }
    }
    if (step < (needsDocuments ? 4 : 5)) { setStep(step + 1); window.scrollTo(0, 0) }
  }
  function prevStep() {
    setStepError(null)
    // Step 2 is the first wizard step (identity was done at sign-in), so Back from it goes
    // to the home page rather than to a non-existent step 1.
    if (step <= 2) { onHome(); return }
    setStep(step - 1); window.scrollTo(0, 0)
  }

  async function handleSubmit() {
    if (!loanDetails) return
    if (resubmitGate?.blocked) { setSubmitError(resubmitGate.reason || 'This application cannot be re-submitted right now.'); return }
    if (needsDocuments) {
      if (files.length === 0) { setSubmitError(`Please upload the required document: ${loanDetails.requiredDocLabel ?? 'a supporting document'}`); return }
    } else {
      if (loanDetails.requiresDocUpload && files.length === 0) { setSubmitError(`This case requires a document: ${loanDetails.requiredDocLabel}`); return }
      if (!certified) { setSubmitError('Please certify that the details provided are accurate.'); return }
      if (!(Number(form.monthly_salary) > 0)) { setSubmitError('Please enter a valid monthly salary greater than 0.'); return }
      if (!(Number(form.arrears_amount) > 0)) { setSubmitError('Please enter a valid amount due greater than 0.'); return }
    }
    setPhase('submitting')
    setSubmitError(null)

    const fd = new FormData()
    fd.append('case_number', form.case_number)
    fd.append('full_name', form.full_name)
    fd.append('emirates_id', form.emirates_id)
    fd.append('phone', form.phone)
    fd.append('monthly_salary', String(Number(form.monthly_salary)))
    fd.append('monthly_expenses', String(loanDetails.monthly_expenses))
    fd.append('arrears_amount', String(Number(form.arrears_amount) || 0))
    fd.append('reschedule_reason', form.reschedule_reason)
    fd.append('months_in_arrears', String(Number(form.months_in_arrears) || 0))
    fd.append('remaining_loan_months', String(loanDetails.remaining_loan_months))
    fd.append('current_installment', String(loanDetails.current_installment))
    fd.append('loan_bank_name', loanDetails.loan_bank_name)
    fd.append('loan_account_number', loanDetails.loan_account_number)
    fd.append('total_loan_amount', String(loanDetails.total_loan_amount))
    fd.append('auto_dda', String(loanDetails.auto_dda))
    fd.append('remarks', form.remarks)
    if (files.length > 0) fd.append('salaryCertificate', files[0])
    if (supportingFiles.length > 0) fd.append('supportingDocument', supportingFiles[0])
    if (requestDescription.trim()) fd.append('request_description', requestDescription.trim())
    if (primaryDescription.trim()) fd.append('primary_description', primaryDescription.trim())
    if (supportingDescription.trim()) fd.append('supporting_description', supportingDescription.trim())
    additionalDocs.forEach((doc, idx) => {
      fd.append(`extra_file_${idx}`, doc.file)
      fd.append(`extra_description_${idx}`, doc.description.trim())
    })

    const formDataForTracking: Record<string, string> = {
      case_number: form.case_number,
      full_name: form.full_name,
      emirates_id: form.emirates_id,
      phone: form.phone,
      monthly_salary: form.monthly_salary,
      reschedule_reason: form.reschedule_reason,
      months_in_arrears: form.months_in_arrears,
    }

    try {
      const res = await fetch('/api/process-application', { method: 'POST', body: fd })
      const result = await res.json()
      if (!res.ok || !result.success) throw new Error(result.error || 'Submission failed')

      // A re-submission runs under a NEW per-submission case id ("-rN"). Track THAT id, not
      // the base Application ID — otherwise the status page polls the previous submission's
      // case and shows its stale decision instead of the fresh pipeline run.
      const newCaseId: string = result.data?.caseId || form.case_number
      formDataForTracking.case_number = newCaseId

      if (typeof window !== 'undefined') {
        localStorage.setItem('saddad_case_submitted', 'true')
        localStorage.setItem('saddad_user_case_number', newCaseId)
      }

      setSavedFormData(formDataForTracking)
      setQueueInfo({ position: result.data.queuePosition, caseId: newCaseId })
      setPhase('confirmed')
    } catch (err) {
      setSubmitError(String(err))
      setPhase('error')
    }
  }

  function watchProcessing() {
    if (savedFormData) onSubmit(savedFormData)
  }

  // ── Case Submitted confirmation ────────────────────────────────────────────────
  if (phase === 'confirmed' && queueInfo) {
    const estWaitSec = Math.max(0, (queueInfo.position - 1) * 15)
    return (
      <div className="wrap-narrow" style={{ padding: '40px 28px' }}>
        <div className="submitted-card fade-in">
          <div className="submitted-circle"><Ico.check /></div>
          <h2 className="submitted-title">{t('Case Submitted')}</h2>
          <p className="submitted-sub-ar ar">تم استلام الطلب بنجاح</p>

          <div className="case-badge-panel">
            <div className="case-badge-label">{t('Case Number')} / رقم القضية</div>
            <div className="case-badge-value">{queueInfo.caseId}</div>
          </div>

          <div className="submitted-grid">
            <div className="submitted-grid-col">
              <div className="submitted-grid-lbl">{t('Queue Position')}</div>
              <div className="submitted-grid-val green">{queueInfo.position === 1 ? t('Next up') : `#${queueInfo.position}`}</div>
            </div>
            <div className="submitted-grid-col">
              <div className="submitted-grid-lbl">{t('Est. Wait Time')}</div>
              <div className="submitted-grid-val blue"><Ico.clock width={16} height={16} /> {estWaitSec === 0 ? t('Now') : `~${estWaitSec}s`}</div>
            </div>
          </div>

          <div className="wa-notice-banner">
            <Ico.wa width={16} height={16} /> {t('You will receive a WhatsApp notification when your case is processed.')}
          </div>

          <button className="watch-processing-btn" onClick={watchProcessing}>
            {t('Watch Live Processing')} <Ico.chevR width={16} height={16} />
          </button>
        </div>
      </div>
    )
  }

  const id = {
    fullName: form.full_name || '—',
    emiratesId: form.emirates_id || '—',
    phone: form.phone || '—',
    marital: loanDetails?.marital_status || '—',
    familySize: loanDetails ? String(loanDetails.family_size) : '—',
    children: loanDetails ? String(loanDetails.number_of_children) : '—',
    social: loanDetails
      ? `${loanDetails.social_status_label}${loanDetails.social_status_label_ar ? ' · ' + loanDetails.social_status_label_ar : ''}`
      : '—',
  }

  return (
    <div className="fade-in">
      {/* Breadcrumb */}
      <div className="crumbs">
        <Ico.home width={16} height={16} /> <span>{t('Home')}</span>
        <span className="sep">›</span> <span>{t('Services')}</span>
        <span className="sep">›</span> <span className="cur">{t('Housing Arrears Rescheduling')}</span>
      </div>

      <div className="wrap-narrow" style={{ paddingBottom: 40 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <span className="pill pill-gold" style={{ marginBottom: 16 }}><Ico.building width={14} height={14} /> وزارة الطاقة والبنية التحتية</span>
          <h2 className="section-title" style={{ fontSize: 34, marginTop: 14 }}>{t('SADDAD — Housing Arrears Rescheduling')}</h2>
          <p className="section-sub ar" style={{ fontSize: 16 }}>طلب إعادة جدولة متأخرات السكن</p>
        </div>

        <div className="card card-pad fade-in">
          {/* Stepper header */}
          <div className="stepper-container">
            {stepsList.map((s, idx) => (
              <React.Fragment key={s.num}>
                <div className={'step' + (step === s.num ? ' active' : step > s.num ? ' completed' : '')}>
                  <div className="step-circle">{step > s.num ? '✓' : s.num}</div>
                  <div className="step-label">{t(s.label)}</div>
                </div>
                {idx < stepsList.length - 1 && <div className={'step-line' + (step > s.num ? ' filled' : '')} />}
              </React.Fragment>
            ))}
          </div>

          {/* Identity (step 1) is verified at UAE PASS sign-in — the wizard auto-loads the
              case and starts at Financial Details. While loading / on error, show a state. */}
          {!loanDetails && (
            <div className="fade-in" style={{ textAlign: 'center', padding: '32px 0' }}>
              {lookupError && !lookupLoading ? (
                <>
                  <p style={{ color: 'var(--red)', fontSize: 14.5, fontWeight: 600, marginBottom: 18 }}>⚠ {lookupError}</p>
                  <button className="btn btn-neutral" onClick={onHome}>← {t('Home')}</button>
                </>
              ) : (
                <p className="muted" style={{ fontSize: 15 }}>{t('Retrieving Profile…')}</p>
              )}
            </div>
          )}

          {/* Step 2: Financial Details */}
          {step === 2 && loanDetails && (
            <div className="fade-in">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <h3 style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink-navy)', marginBottom: 6 }}>{t('Financial Details')}</h3>
                <button className="btn-link" style={{ background: 'none', border: 0, color: 'var(--gold-dark)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }} onClick={onHome}>← {t('Home')}</button>
              </div>
              <p style={{ color: 'var(--muted)', fontSize: 14.5, marginBottom: 24 }}>{t('Confirm the financial details retrieved from MOEI systems.')}</p>

              {/* Re-submission blocked banner */}
              {resubmitGate?.blocked && (
                <div className="notice" style={{ marginBottom: 20, borderColor: '#cdddef', background: 'var(--blue-soft)' }}>
                  <div className="ico" style={{ color: 'var(--blue)' }}><Ico.clock /></div>
                  <div>
                    <h4>
                      {resubmitGate.state === 'under_review'
                        ? 'Application under officer review / الطلب قيد مراجعة الموظف'
                        : resubmitGate.state === 'approved'
                        ? 'Application already approved / تمت الموافقة على الطلب'
                        : 'Application in process / الطلب قيد المعالجة'}
                    </h4>
                    <p>{resubmitGate.reason}</p>
                    <p className="fine">You cannot submit a new application for this Application ID right now.</p>
                  </div>
                </div>
              )}

              {/* Documents-only re-submission banner */}
              {!resubmitGate?.blocked && needsDocuments && (
                <div className="notice" style={{ marginBottom: 20 }}>
                  <div className="ico"><Ico.warn /></div>
                  <div>
                    <h4>Additional document required / مطلوب مستند إضافي</h4>
                    <p>Your previous request was returned for additional information. You only need to re-upload a valid salary certificate — your case details are already on file.</p>
                  </div>
                </div>
              )}

              <div className="stack-lg" style={{ textAlign: 'left' }}>
                <div className="card card-pad">
                  <DataHead en="UAE PASS — Verified Identity & Social Profile" ar="الهوية والحالة الاجتماعية" color="var(--green)"
                    speakEn="Verified Identity and Social Profile retrieved via U A E PASS." speakAr="الهوية والحالة الاجتماعية المستردة عبر منصة الهوية الرقمية." />
                  {loanDetails.is_priority && (
                    <span className="pill pill-amber" style={{ marginTop: 12 }}>★ Priority care</span>
                  )}
                  <div className="form-grid" style={{ marginTop: 22 }}>
                    <Field label="Full Name" ar="الاسم" value={id.fullName} />
                    <Field label="Emirates ID" ar="الهوية" value={id.emiratesId} />
                    <Field label="Phone" ar="الهاتف" value={id.phone} />
                    <Field label="Marital Status" ar="الحالة" value={id.marital} />
                    <Field label="Family Size" ar="حجم الأسرة" value={id.familySize} />
                    <Field label="Children" ar="الأبناء" value={id.children} />
                  </div>
                  <div style={{ marginTop: 18 }}>
                    <Field label="Social Status" ar="الفئة الاجتماعية" value={id.social} />
                  </div>
                </div>

                <div className="card card-pad">
                  <DataHead en="Retrieved Programme Data — MOEI Systems / Financial Services" ar="البيانات المُستردة" color="var(--blue)"
                    speakEn="Retrieved Programme Data from M O E I systems and Financial Services." speakAr="البيانات المالية والبرامجية المستردة من أنظمة الوزارة." />
                  <div className="form-grid" style={{ marginTop: 22 }}>
                    <Field label="Bank" ar="البنك" value={loanDetails.loan_bank_name || '—'} />
                    <Field label="Loan Account" ar="الحساب" value={loanDetails.loan_account_number || '—'} />
                    <Field label="Original Loan (AED)" value={loanDetails.total_loan_amount.toLocaleString()} />
                    <Field label="Remaining Balance (AED)" value={loanDetails.remaining_loan_balance.toLocaleString()} />
                    <Field label="Current Installment (AED/mo)" value={loanDetails.current_installment.toLocaleString()} />
                    <Field label="Remaining Period" value={`${loanDetails.remaining_loan_months} months`} />
                    <Field label="Payment History (last 8mo)" value={
                      loanDetails.payment_history.length > 0
                        ? `${loanDetails.payment_history.filter(p => p.status === 'paid').length} paid · ${loanDetails.payment_history.filter(p => p.status === 'missed').length} missed`
                        : '—'} />
                    <Field label="Months in Arrears" ar="أشهر التأخر" value={form.months_in_arrears} readOnly={false} placeholder="6" onChange={(v) => setForm(p => ({ ...p, months_in_arrears: v }))} />
                  </div>
                  <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
                    {loanDetails.auto_dda && <span className="pill pill-green"><Ico.check width={12} height={12} /> Auto DDA Enrolled</span>}
                    {loanDetails.income_changed && <span className="pill pill-amber"><Ico.warn width={12} height={12} /> Income change on record</span>}
                  </div>
                </div>

                {/* Adjustable values (the two the officer/judge enters; everything else is from the record) */}
                <div className="card card-pad" style={{ background: 'var(--blue-soft)', borderColor: '#cdddef' }}>
                  <DataHead en="Enter these two values" ar="أدخل هاتين القيمتين" color="var(--blue)" />
                  <div className="form-grid" style={{ marginTop: 22 }}>
                    <div className="field">
                      <label><span>Monthly Salary (AED)</span><span className="ar">الراتب الشهري</span></label>
                      <input type="number" className="input" placeholder="8,000" value={form.monthly_salary}
                        onChange={(e) => setForm(p => ({ ...p, monthly_salary: e.target.value }))}
                        style={salaryInvalid ? { borderColor: 'var(--red)' } : undefined} />
                      {salaryInvalid ? (
                        <p style={{ color: 'var(--red)', fontSize: 12.5, marginTop: 6 }}>⚠ Enter a valid monthly salary greater than 0.</p>
                      ) : (
                        <p style={{ color: 'var(--muted)', fontSize: 12.5, marginTop: 6 }}>Total deduction is capped at {DEDUCTION_CAP_PCT}% of salary. Available arrears premium ≈ AED {estimatedArrearsPremium.toLocaleString()}/month.</p>
                      )}
                    </div>
                    <div className="field">
                      <label><span>Amount Due (AED)</span><span className="ar">المبلغ المستحق</span></label>
                      <input type="number" className="input" placeholder="50,000" value={form.arrears_amount}
                        onChange={(e) => setForm(p => ({ ...p, arrears_amount: e.target.value }))}
                        style={arrearsInvalid ? { borderColor: 'var(--red)' } : undefined} />
                      {arrearsInvalid && <p style={{ color: 'var(--red)', fontSize: 12.5, marginTop: 6 }}>⚠ Enter a valid amount due greater than 0.</p>}
                    </div>
                  </div>
                </div>
              </div>

              {stepError && <p style={{ color: 'var(--red)', fontSize: 13.5, marginTop: 16 }}>⚠ {stepError}</p>}
              <div style={{ display: 'flex', gap: 16, marginTop: 28 }}>
                <button className="btn btn-neutral" style={{ flex: 1 }} onClick={onHome}>← {t('Home')}</button>
                <button className="btn btn-primary" style={{ flex: 2 }} onClick={nextStep}>
                  Confirm &amp; Continue / تأكيد ومتابعة <Ico.chevR width={16} height={16} />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Reason (non-needsDocuments) / Documents (needsDocuments) */}
          {/* Step 4: Documents (non-needsDocuments) */}
          {((step === 3 && needsDocuments) || (step === 4 && !needsDocuments)) && (
            <div className="fade-in">
              <h3 style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink-navy)', marginBottom: 6 }}>{t('Upload Documents')}</h3>
              <p style={{ color: 'var(--muted)', fontSize: 14.5, marginBottom: 8 }}>{t('Please upload the required document to verify your request.')}</p>
              <div className="field" style={{ marginBottom: 20, marginTop: 16 }}>
                <label><span>What are you requesting?</span><span className="ar">ما الذي تطلبه؟</span></label>
                <textarea className="input" rows={3}
                  placeholder="Briefly describe what you are requesting, e.g. I am applying for a rescheduling due to a recent salary reduction…"
                  style={{ fontFamily: 'inherit', resize: 'vertical', fontSize: 13.5 }}
                  value={requestDescription} onChange={e => setRequestDescription(e.target.value)} />
              </div>
              {(() => {
                const reason = form.reschedule_reason
                const stage = loanDetails?.docStage ?? 'primary'

                // Primary doc label based on reason + stage
                let primaryLabel = loanDetails?.requiredDocLabel ?? 'a supporting document'
                if (stage === 'primary') {
                  if (reason === 'job_loss') {
                    primaryLabel = 'An official non-work / termination letter from your employer or the labour authority'
                  } else if (['medical_expenses', 'family_circumstances', 'salary_reduction', 'business_failure'].includes(reason)) {
                    primaryLabel = 'A recent salary certificate (issued within the last 30 days)'
                  }
                }

                // Supporting doc label based on reason
                const supportingLabel =
                  loanDetails?.supportingDocLabel ??
                  (reason === 'medical_expenses' ? 'A medical report or official document confirming your medical circumstance' :
                   reason === 'salary_reduction' ? 'An official employer letter confirming your salary reduction' :
                   reason === 'business_failure' ? 'A recent bank statement or income statement covering the last 3 months' :
                   reason === 'family_circumstances' ? 'An official document supporting your family circumstance' :
                   reason !== 'job_loss' ? 'A supporting document for your circumstance (e.g. medical report, employer letter, or bank statement)' : null)

                // When in supporting stage, the primary is already validated — show only supporting
                const showPrimary = stage !== 'supporting'
                // Show supporting field for all non-job-loss primary-stage cases
                const showSupporting = stage === 'supporting' || (stage === 'primary' && reason !== 'job_loss')

                return (
                  <>
                    {showPrimary && (
                      <>
                        {showSupporting && (
                          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold-dark)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Step 1 of 2 — Primary Document
                          </p>
                        )}
                        <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, color: docRequired ? 'var(--red)' : 'var(--muted)' }}>
                          {docRequired ? `* Required — ${primaryLabel}` : '(optional — income verified from records)'}
                        </p>
                        <div className="file-dropzone" onClick={() => document.getElementById('saddad-file-input')?.click()}
                          onDrop={handleDrop} onDragOver={(e) => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)}
                          style={dragging ? { borderColor: 'var(--gold)', background: 'var(--cream-soft)' } : undefined}>
                          <Ico.doc2 width={44} height={44} style={{ color: 'var(--gold)', opacity: 0.8 }} />
                          {files.length > 0 ? (
                            <>
                              <p style={{ margin: '16px 0 4px', fontWeight: 700, color: 'var(--green)' }}>✓ {files[0].name}</p>
                              <p style={{ fontSize: 13, color: 'var(--muted)' }}>Click to upload a different file</p>
                            </>
                          ) : (
                            <>
                              <p style={{ margin: '16px 0 4px', fontWeight: 700, color: 'var(--ink)' }}>Drag &amp; drop your document</p>
                              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>PDF up to 5MB</p>
                              <span className="btn btn-neutral">Browse Files</span>
                            </>
                          )}
                          <input id="saddad-file-input" type="file" accept=".pdf" className="hidden" style={{ display: 'none' }} onChange={handleFileInput} />
                        </div>
                        {files.length > 0 && (
                          <input type="text" className="input" placeholder="Brief description of this document (optional)"
                            style={{ marginTop: 10, fontSize: 13 }}
                            value={primaryDescription} onChange={e => setPrimaryDescription(e.target.value)} />
                        )}
                      </>
                    )}

                    {showSupporting && supportingLabel && (
                      <div style={{ marginTop: showPrimary ? 28 : 0 }}>
                        {showPrimary && (
                          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold-dark)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Step 2 of 2 — Supporting Document
                          </p>
                        )}
                        <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, color: 'var(--red)' }}>
                          {stage === 'supporting' ? `* Required — ${supportingLabel}` : `* Also required — ${supportingLabel}`}
                        </p>
                        <div className="file-dropzone" onClick={() => document.getElementById('saddad-supporting-file-input')?.click()}
                          onDrop={handleSupportingDrop} onDragOver={(e) => { e.preventDefault(); setSupportingDragging(true) }} onDragLeave={() => setSupportingDragging(false)}
                          style={supportingDragging ? { borderColor: 'var(--gold)', background: 'var(--cream-soft)' } : undefined}>
                          <Ico.doc2 width={44} height={44} style={{ color: 'var(--gold)', opacity: 0.8 }} />
                          {supportingFiles.length > 0 ? (
                            <>
                              <p style={{ margin: '16px 0 4px', fontWeight: 700, color: 'var(--green)' }}>✓ {supportingFiles[0].name}</p>
                              <p style={{ fontSize: 13, color: 'var(--muted)' }}>Click to upload a different file</p>
                            </>
                          ) : (
                            <>
                              <p style={{ margin: '16px 0 4px', fontWeight: 700, color: 'var(--ink)' }}>Drag &amp; drop your supporting document</p>
                              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>PDF up to 5MB</p>
                              <span className="btn btn-neutral">Browse Files</span>
                            </>
                          )}
                          <input id="saddad-supporting-file-input" type="file" accept=".pdf" className="hidden" style={{ display: 'none' }} onChange={handleSupportingFileInput} />
                        </div>
                        {supportingFiles.length > 0 && (
                          <input type="text" className="input" placeholder="Brief description of this document (optional)"
                            style={{ marginTop: 10, fontSize: 13 }}
                            value={supportingDescription} onChange={e => setSupportingDescription(e.target.value)} />
                        )}
                      </div>
                    )}
                  </>
                )
              })()}

              <div style={{ marginTop: 28, borderTop: '1px solid var(--line)', paddingTop: 20 }}>
                <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Additional Documents <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span>
                </p>
                <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
                  Upload any extra supporting files — PDF, Word (.docx), JPEG, or PNG, up to 5 MB each.
                </p>
                {additionalDocs.map((doc, idx) => (
                  <div key={idx} style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', padding: '10px 12px', marginBottom: 10, background: 'var(--panel-alt)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>📎 {doc.file.name}</span>
                      <button type="button" onClick={() => removeExtraDoc(idx)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 13, fontWeight: 700, padding: '0 4px' }}>
                        ✕ Remove
                      </button>
                    </div>
                    <input type="text" className="input" placeholder="Document description (optional)"
                      style={{ fontSize: 13 }}
                      value={doc.description} onChange={e => updateExtraDesc(idx, e.target.value)} />
                  </div>
                ))}
                {additionalDocs.length < 10 && (
                  <div className="file-dropzone"
                    style={{ padding: '14px 20px', ...(additionalDragging ? { borderColor: 'var(--gold)', background: 'var(--cream-soft)' } : {}) }}
                    onClick={() => document.getElementById('saddad-extra-file-input')?.click()}
                    onDrop={handleExtraDrop}
                    onDragOver={e => { e.preventDefault(); setAdditionalDragging(true) }}
                    onDragLeave={() => setAdditionalDragging(false)}>
                    <Ico.doc2 width={32} height={32} style={{ color: 'var(--gold)', opacity: 0.7 }} />
                    <p style={{ margin: '8px 0 2px', fontWeight: 700, color: 'var(--ink)', fontSize: 13 }}>Add additional files</p>
                    <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>PDF, Word, JPEG, PNG</p>
                    <input id="saddad-extra-file-input" type="file" multiple accept=".pdf,.docx,.doc,.jpg,.jpeg,.png"
                      style={{ display: 'none' }} onChange={handleExtraFileInput} />
                  </div>
                )}
              </div>

              {stepError && <p style={{ color: 'var(--red)', fontSize: 13.5, marginTop: 16 }}>⚠ {stepError}</p>}
              <div style={{ display: 'flex', gap: 16, marginTop: 28 }}>
                <button className="btn btn-neutral" style={{ flex: 1 }} onClick={prevStep}>Back / العودة</button>
                <button className="btn btn-primary" style={{ flex: 2 }} onClick={nextStep}
                  disabled={docRequired && files.length === 0}>
                  Continue / متابعة <Ico.chevR width={16} height={16} />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Reason (non-needsDocuments path) */}
          {step === 3 && !needsDocuments && (
            <div className="fade-in" style={{ textAlign: 'left' }}>
              <h3 style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink-navy)', marginBottom: 6, textAlign: 'center' }}>{t('Reason for Rescheduling')}</h3>
              <p style={{ color: 'var(--muted)', fontSize: 14.5, marginBottom: 24, textAlign: 'center' }}>{t('Explain why you require a rescheduling of your housing loan payments.')}</p>

              <div className="field" style={{ marginBottom: 18 }}>
                <label><span>Reschedule Reason</span><span className="ar">سبب إعادة الجدولة</span></label>
                <select className="select" value={form.reschedule_reason} onChange={(e) => setForm(p => ({ ...p, reschedule_reason: e.target.value }))}>
                  <option value="other">Other / أخرى</option>
                  <option value="job_loss">Job Loss / فقدان العمل</option>
                  <option value="business_failure">Business Failure / إفلاس تجاري</option>
                  <option value="salary_reduction">Salary Reduction / تخفيض الراتب</option>
                  <option value="family_circumstances">Family Circumstances / ظروف أسرية</option>
                  <option value="medical_expenses">Medical Condition / حالة طبية</option>
                </select>
              </div>
              <div className="field">
                <label><span>Details</span><span className="ar">سبب طلب إعادة الجدولة</span></label>
                <textarea className="input" rows={5} placeholder="e.g. Temporary reduction in household income, medical expenses, family status change…"
                  style={{ fontFamily: 'inherit', resize: 'vertical' }} value={form.remarks} onChange={(e) => setForm(p => ({ ...p, remarks: e.target.value }))} />
              </div>

              <div style={{ display: 'flex', gap: 16, marginTop: 28 }}>
                <button className="btn btn-neutral" style={{ flex: 1 }} onClick={prevStep}>Back / العودة</button>
                <button className="btn btn-primary" style={{ flex: 2 }} onClick={nextStep}>Continue / متابعة <Ico.chevR width={16} height={16} /></button>
              </div>
            </div>
          )}

          {/* Step 5: Review & Submit (or Step 4 if needsDocuments) */}
          {((step === 5 && !needsDocuments) || (step === 4 && needsDocuments)) && loanDetails && (
            <div className="fade-in" style={{ textAlign: 'left' }}>
              <h3 style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink-navy)', marginBottom: 6, textAlign: 'center' }}>{t('Review & Submit')}</h3>
              <p style={{ color: 'var(--muted)', fontSize: 14.5, marginBottom: 24, textAlign: 'center' }}>{t('Review your application details before submitting to SADDAD.')}</p>

              <div className="card card-pad" style={{ background: 'var(--panel-alt)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 800, color: 'var(--muted)' }}>Application ID</label>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{form.case_number}</div>
                  </div>
                  <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
                    <label style={{ fontSize: 13, fontWeight: 800, color: 'var(--muted)' }}>Retrieved Applicant Name</label>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{form.full_name || '—'}</div>
                  </div>
                  <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
                    <label style={{ fontSize: 13, fontWeight: 800, color: 'var(--muted)' }}>Total Arrears Amount</label>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--red)' }}>AED {(Number(form.arrears_amount) || loanDetails.arrears_amount).toLocaleString()}</div>
                  </div>
                  {requestDescription.trim() && (
                    <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
                      <label style={{ fontSize: 13, fontWeight: 800, color: 'var(--muted)' }}>Your Request</label>
                      <div style={{ fontSize: 14, color: 'var(--body)', whiteSpace: 'pre-wrap' }}>{requestDescription}</div>
                    </div>
                  )}
                  <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
                    <label style={{ fontSize: 13, fontWeight: 800, color: 'var(--muted)' }}>Uploaded Document</label>
                    <div style={{ fontSize: 15, fontWeight: 600, color: files.length > 0 ? 'var(--green)' : 'var(--muted)' }}>
                      {files.length > 0 ? `✓ ${files[0].name}` : (docRequired ? 'Required — not uploaded' : 'Not uploaded (optional)')}
                    </div>
                    {primaryDescription.trim() && <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>{primaryDescription}</div>}
                  </div>
                  {supportingFiles.length > 0 && (
                    <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
                      <label style={{ fontSize: 13, fontWeight: 800, color: 'var(--muted)' }}>Uploaded Supporting Document</label>
                      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--green)' }}>
                        ✓ {supportingFiles[0].name}
                      </div>
                      {supportingDescription.trim() && <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>{supportingDescription}</div>}
                    </div>
                  )}
                  {additionalDocs.length > 0 && (
                    <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
                      <label style={{ fontSize: 13, fontWeight: 800, color: 'var(--muted)' }}>Additional Documents</label>
                      <div style={{ display: 'grid', gap: 4, marginTop: 6 }}>
                        {additionalDocs.map((d, i) => (
                          <div key={i} style={{ fontSize: 13.5, color: 'var(--ink)' }}>
                            📎 {d.file.name}{d.description ? <span style={{ color: 'var(--muted)', fontWeight: 400 }}> — {d.description}</span> : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
                    <label style={{ fontSize: 13, fontWeight: 800, color: 'var(--muted)' }}>Rescheduling Reason</label>
                    <div style={{ fontSize: 15, color: 'var(--body)', whiteSpace: 'pre-wrap' }}>{form.reschedule_reason}{form.remarks ? ` — ${form.remarks}` : ''}</div>
                  </div>
                </div>
              </div>

              {/* Authenticity declaration */}
              <label style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
                <input type="checkbox" style={{ marginTop: 4, transform: 'scale(1.2)' }} checked={certified} onChange={(e) => setCertified(e.target.checked)} />
                <span style={{ fontSize: 13.5, color: 'var(--body)' }}>
                  {t('I certify that all details and documents provided are accurate and authentic, and understand that false or altered declarations will lead to rescheduling cancellation.')}
                </span>
              </label>

              {submitError && <p style={{ color: 'var(--red)', fontSize: 13.5, marginTop: 16 }}>⚠ {submitError}</p>}
              <div style={{ display: 'flex', gap: 16, marginTop: 28 }}>
                <button className="btn btn-neutral" style={{ flex: 1 }} onClick={prevStep}>Back / العودة</button>
                <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleSubmit}
                  disabled={phase === 'submitting' || !certified || salaryInvalid || arrearsInvalid || (docRequired && files.length === 0)}>
                  {phase === 'submitting' ? t('Queuing Case…') : <>{t('Submit to SADDAD')} <Ico.chevR width={16} height={16} /></>}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
