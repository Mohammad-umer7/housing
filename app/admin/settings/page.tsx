'use client'

// Admin Settings — three sections:
//   • Chatbot Instructions: per-role custom instructions appended to the SADDAD
//     assistant's base prompt (citizen / officer / admin), saved to system_settings.
//   • Rules & Calculations: admin overrides for the governance thresholds the
//     pipeline applies (statutory MOEI defaults shown, per-rule reset).
//   • Accessibility: the same accessibility & language panel citizens get.
// Ports the source admin settings page onto the MOEI design system.

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Ico } from '@/components/saddad-ui'
import { useA11y } from '@/components/AccessibilityProvider'
import AccessibilitySettings from '@/components/AccessibilitySettings'

// ── Chatbot ───────────────────────────────────────────────────────────────────

type RoleKey = 'citizen' | 'officer' | 'admin'

const ROLE_META: Record<RoleKey, { label: string; sublabel: string; placeholder: string }> = {
  citizen: {
    label: 'Citizen Assistant', sublabel: 'Shown to beneficiaries on the citizen portal',
    placeholder: 'e.g. "Always remind citizens that decisions are usually issued within 48 hours."',
  },
  officer: {
    label: 'Officer Assistant', sublabel: 'Shown to review officers handling escalated cases',
    placeholder: 'e.g. "For borderline cases near the 20% threshold, request a fresh salary certificate before approving."',
  },
  admin: {
    label: 'Admin Assistant', sublabel: 'Shown to programme administrators',
    placeholder: 'e.g. "Remind admin that configuration changes require a change-request number."',
  },
}

// ── Rules ─────────────────────────────────────────────────────────────────────

type RuleValues = {
  maxDeductionPercent: number
  hardshipDeductionPercent: number
  hardshipPerMemberIncome: number
  certFreshnessDays: number
  dbrCapSalaried: number
  dbrCapRetiree: number
  salaryDiscrepancyThresholdPct: number
}
type RulesData = RuleValues & { defaults: RuleValues }

type RuleField = {
  key: keyof RuleValues
  label: string
  description: string
  unit: 'percent' | 'aed' | 'days'
  min: number
  max: number
  step: number
  warning?: string
  group: string
}

const RULE_FIELDS: RuleField[] = [
  {
    key: 'maxDeductionPercent',
    label: 'Max Salary Deduction',
    description: 'The monthly repayment plan cannot deduct more than this percentage from the beneficiary\'s salary. The statutory MOEI value is 20%.',
    unit: 'percent', min: 5, max: 50, step: 1, group: 'Repayment',
    warning: 'Changing this value affects ALL future case calculations immediately.',
  },
  {
    key: 'hardshipDeductionPercent',
    label: 'Hardship Deduction Target',
    description: 'For families whose per-member income is below the hardship threshold, a lighter repayment plan is applied.',
    unit: 'percent', min: 5, max: 50, step: 1, group: 'Repayment',
  },
  {
    key: 'hardshipPerMemberIncome',
    label: 'Hardship Income Threshold',
    description: 'If average income per family member falls below this amount, the case is classified as a hardship case.',
    unit: 'aed', min: 500, max: 20000, step: 100, group: 'Repayment',
  },
  {
    key: 'certFreshnessDays',
    label: 'Certificate Freshness Window',
    description: 'Salary certificates older than this many days trigger officer review instead of auto-processing.',
    unit: 'days', min: 7, max: 90, step: 1, group: 'Document Validation',
  },
  {
    key: 'dbrCapSalaried',
    label: 'DBR Cap — Salaried',
    description: 'Debt-burden ratio cap for salaried employees (CBUAE/SZHP 2022). Total deductions cannot exceed this share of salary.',
    unit: 'percent', min: 10, max: 100, step: 5, group: 'Risk Thresholds',
  },
  {
    key: 'dbrCapRetiree',
    label: 'DBR Cap — Retirees',
    description: 'Slightly lower DBR cap for retired and senior beneficiaries.',
    unit: 'percent', min: 10, max: 100, step: 5, group: 'Risk Thresholds',
  },
]

function fmtValue(val: number, unit: RuleField['unit']): string {
  if (unit === 'percent') return `${Math.round(val * 100)}%`
  if (unit === 'aed') return `AED ${val.toLocaleString()}`
  return `${val} days`
}
const toInput = (val: number, unit: RuleField['unit']) => (unit === 'percent' ? Math.round(val * 100) : val)
const fromInput = (raw: number, unit: RuleField['unit']) => (unit === 'percent' ? raw / 100 : raw)

// ── Main page ─────────────────────────────────────────────────────────────────

type Section = 'chatbot' | 'rules' | 'accessibility'

export default function AdminSettingsPage() {
  const { t } = useA11y()
  const [section, setSection] = useState<Section>('chatbot')

  // Chatbot state
  const [instructions, setInstructions] = useState<Record<RoleKey, string>>({ citizen: '', officer: '', admin: '' })
  const [savedInstructions, setSavedInstructions] = useState<Record<RoleKey, string>>({ citizen: '', officer: '', admin: '' })
  const [chatbotLoading, setChatbotLoading] = useState(true)
  const [chatbotSaving, setChatbotSaving] = useState(false)
  const [activeRoleTab, setActiveRoleTab] = useState<RoleKey>('citizen')

  // Rules state
  const [rules, setRules] = useState<RulesData | null>(null)
  const [ruleInputs, setRuleInputs] = useState<Record<string, number>>({})
  const [savedRuleInputs, setSavedRuleInputs] = useState<Record<string, number>>({})
  const [rulesLoading, setRulesLoading] = useState(true)
  const [rulesSaving, setRulesSaving] = useState(false)

  const [flash, setFlash] = useState<string | null>(null)

  async function loadChatbot() {
    try {
      const res = await fetch('/api/admin/settings/assistant', { credentials: 'include' })
      if (!res.ok) throw new Error(`Status ${res.status}`)
      const json = await res.json()
      if (json.success) {
        const d = { citizen: json.data.citizen ?? '', officer: json.data.officer ?? '', admin: json.data.admin ?? '' }
        setInstructions(d)
        setSavedInstructions(d)
      }
    } catch { setFlash('Error: failed to load chatbot settings') }
    finally { setChatbotLoading(false) }
  }

  async function saveChatbot() {
    setChatbotSaving(true)
    setFlash(null)
    try {
      const res = await fetch('/api/admin/settings/assistant', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify(instructions),
      })
      if (!res.ok) throw new Error()
      setSavedInstructions({ ...instructions })
      setFlash('Chatbot instructions saved successfully.')
    } catch { setFlash('Error: failed to save chatbot settings') }
    finally { setChatbotSaving(false) }
  }

  async function loadRules() {
    try {
      const res = await fetch('/api/admin/settings/rules', { credentials: 'include' })
      if (!res.ok) throw new Error(`Status ${res.status}`)
      const json = await res.json()
      const d: RulesData = json.data
      setRules(d)
      const init: Record<string, number> = {}
      for (const f of RULE_FIELDS) init[f.key] = toInput(d[f.key], f.unit)
      setRuleInputs(init)
      setSavedRuleInputs(init)
    } catch { setFlash('Error: failed to load governance rules') }
    finally { setRulesLoading(false) }
  }

  async function saveRules() {
    setRulesSaving(true)
    setFlash(null)
    try {
      const body: Record<string, number> = {}
      for (const f of RULE_FIELDS) body[f.key] = fromInput(ruleInputs[f.key] ?? 0, f.unit)
      const res = await fetch('/api/admin/settings/rules', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      setFlash('Governance rules saved — new cases will use the updated values immediately.')
      await loadRules()
    } catch { setFlash('Error: failed to save governance rules') }
    finally { setRulesSaving(false) }
  }

  useEffect(() => { void (async () => { await Promise.all([loadChatbot(), loadRules()]) })() }, [])

  const chatbotDirty = useMemo(() =>
    (Object.keys(instructions) as RoleKey[]).some(k => instructions[k] !== savedInstructions[k]),
  [instructions, savedInstructions])

  const rulesDirty = useMemo(() =>
    RULE_FIELDS.some(f => (ruleInputs[f.key] ?? 0) !== (savedRuleInputs[f.key] ?? 0)),
  [ruleInputs, savedRuleInputs])

  const dirty = section === 'chatbot' ? chatbotDirty : section === 'rules' ? rulesDirty : false
  const saving = section === 'chatbot' ? chatbotSaving : rulesSaving
  const loading = section === 'chatbot' ? chatbotLoading : section === 'rules' ? rulesLoading : false

  const groups = useMemo(() => {
    const g: Record<string, RuleField[]> = {}
    for (const f of RULE_FIELDS) {
      if (!g[f.group]) g[f.group] = []
      g[f.group].push(f)
    }
    return g
  }, [])

  const SECTION_TABS: { key: Section; label: string; ar: string }[] = [
    { key: 'chatbot', label: 'Chatbot Instructions', ar: 'تعليمات المساعد' },
    { key: 'rules', label: 'Rules & Calculations', ar: 'القواعد والحسابات' },
    { key: 'accessibility', label: 'Accessibility', ar: 'إمكانية الوصول' },
  ]

  return (
    <div className="fade-in" style={{ maxWidth: 900, paddingBottom: dirty ? 110 : 0 }}>
      <div className="crumbs" style={{ padding: '0 0 14px' }}>
        <Link href="/admin">{t('Overview')}</Link><span className="sep">›</span><span className="cur">{t('Settings')}</span>
      </div>

      <div style={{ marginBottom: 26 }}>
        <div style={{ color: 'var(--gold-dark)', fontWeight: 800, fontSize: 12.5, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>SADDAD · {t('Configuration', 'الإعدادات')}</div>
        <h2 style={{ fontSize: 34 }}>{t('Settings', 'الإعدادات')}</h2>
        <p className="muted" style={{ marginTop: 6, fontSize: 16 }}>{t('Configure chatbot behaviour, governance thresholds and accessibility.')}</p>
      </div>

      {/* Section tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--line-strong)', marginBottom: 22, overflowX: 'auto' }}>
        {SECTION_TABS.map(s => (
          <button key={s.key} onClick={() => setSection(s.key)}
            style={{
              padding: '11px 18px', fontSize: 15, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
              background: 'none', border: 'none', borderBottom: section === s.key ? '3px solid var(--gold)' : '3px solid transparent',
              color: section === s.key ? 'var(--ink)' : 'var(--muted)', marginBottom: -1, display: 'flex', alignItems: 'center', gap: 8,
            }}>
            {t(s.label, s.ar)}
            {((s.key === 'chatbot' && chatbotDirty) || (s.key === 'rules' && rulesDirty)) && (
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--gold-bright)' }} />
            )}
          </button>
        ))}
      </div>

      {flash && (
        <div className="notice" style={{ marginBottom: 18, borderColor: flash.startsWith('Error') ? 'rgba(200,16,46,.2)' : 'rgba(30,142,62,.25)', background: flash.startsWith('Error') ? 'var(--red-soft)' : 'var(--green-soft)' }} aria-live="polite">
          <div><p style={{ fontWeight: 600 }}>{flash}</p></div>
        </div>
      )}

      {/* ── Chatbot section ──────────────────────────────────────────────── */}
      {section === 'chatbot' && (
        <div>
          {/* Role tabs */}
          <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--line)', marginBottom: 18 }}>
            {(Object.keys(ROLE_META) as RoleKey[]).map(role => {
              const isDirty = instructions[role] !== savedInstructions[role]
              const icons: Record<RoleKey, React.ReactElement> = {
                citizen: <Ico.user width={14} height={14} />, officer: <Ico.shield width={14} height={14} />, admin: <Ico.building width={14} height={14} />,
              }
              return (
                <button key={role} onClick={() => setActiveRoleTab(role)}
                  style={{
                    padding: '10px 16px', fontSize: 14.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
                    background: 'none', border: 'none', borderBottom: activeRoleTab === role ? '3px solid var(--gold)' : '3px solid transparent',
                    color: activeRoleTab === role ? 'var(--gold-dark)' : 'var(--muted)', marginBottom: -1, display: 'flex', alignItems: 'center', gap: 7,
                  }}>
                  {icons[role]} {t(ROLE_META[role].label)}
                  {isDirty && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--gold-bright)' }} />}
                </button>
              )
            })}
          </div>

          {chatbotLoading ? (
            <div className="muted" style={{ textAlign: 'center', padding: '48px 0' }}>{t('Loading…', 'جارٍ التحميل…')}</div>
          ) : (
            (() => {
              const role = activeRoleTab
              const m = ROLE_META[role]
              return (
                <div className="card card-pad">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 'var(--r)', background: 'var(--gold-tint)', border: '1px solid var(--gold-line)', display: 'grid', placeItems: 'center', color: 'var(--gold-dark)', flexShrink: 0 }}>
                      {role === 'citizen' ? <Ico.user width={20} height={20} /> : role === 'officer' ? <Ico.shield width={20} height={20} /> : <Ico.building width={20} height={20} />}
                    </div>
                    <div>
                      <h3 style={{ fontSize: 19 }}>{t(m.label)}</h3>
                      <p className="muted" style={{ fontSize: 13.5 }}>{t(m.sublabel)}</p>
                    </div>
                  </div>

                  <label className="muted" style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                    {t('Custom Instructions', 'تعليمات مخصصة')}
                  </label>
                  <textarea
                    className="input"
                    value={instructions[role]}
                    onChange={e => setInstructions(prev => ({ ...prev, [role]: e.target.value }))}
                    rows={11} maxLength={4000}
                    placeholder={m.placeholder}
                    style={{ resize: 'vertical', fontFamily: 'var(--font)', lineHeight: 1.6 }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                    <p className="muted" style={{ fontSize: 12.5 }}>
                      {t('Appended to the base SZHP policy prompt for this role. Leave blank to use the system default.')}
                    </p>
                    <span className="mono" style={{ fontSize: 12, color: instructions[role].length > 3800 ? 'var(--amber)' : 'var(--muted)' }}>
                      {instructions[role].length}/4000
                    </span>
                  </div>
                </div>
              )
            })()
          )}
        </div>
      )}

      {/* ── Rules & Calculations section ─────────────────────────────────── */}
      {section === 'rules' && (
        <div style={{ display: 'grid', gap: 18 }}>
          <div className="notice" style={{ borderColor: 'rgba(183,121,31,.35)', background: 'var(--amber-soft)' }}>
            <span className="ico"><Ico.warn /></span>
            <div>
              <h4>{t('Live effect', 'تأثير فوري')}</h4>
              <p style={{ fontSize: 14 }}>
                {t('Changes apply immediately to all new submissions. Existing decisions are not recalculated. Statutory MOEI defaults are shown and can be restored per rule at any time.')}
              </p>
            </div>
          </div>

          {rulesLoading ? (
            <div className="muted" style={{ textAlign: 'center', padding: '48px 0' }}>{t('Loading…', 'جارٍ التحميل…')}</div>
          ) : (
            Object.entries(groups).map(([group, fields]) => (
              <div key={group} className="card">
                <div className="card-hd" style={{ padding: '16px 24px' }}>
                  <h3 style={{ fontSize: 17 }}>{t(group)}</h3>
                  <span className="pill pill-gray">{fields.length} {fields.length > 1 ? t('rules') : t('rule')}</span>
                  {fields.some(f => (ruleInputs[f.key] ?? 0) !== (savedRuleInputs[f.key] ?? 0)) && (
                    <span className="pill pill-gold">{t('unsaved')}</span>
                  )}
                </div>
                <div style={{ padding: '20px 24px', display: 'grid', gap: 26 }}>
                  {fields.map(f => {
                    const def = rules?.defaults[f.key] ?? 0
                    const defInput = toInput(def, f.unit)
                    const current = ruleInputs[f.key] ?? defInput
                    const isChanged = current !== (savedRuleInputs[f.key] ?? defInput)
                    const isDefault = Math.abs(current - defInput) < 0.01
                    const sliderPct = ((current - f.min) / (f.max - f.min)) * 100

                    return (
                      <div key={f.key}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 10 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 800, color: 'var(--ink)', fontSize: 15.5 }}>{t(f.label)}</span>
                              {isChanged && <span className="pill pill-gold" style={{ padding: '3px 9px' }}>{t('modified')}</span>}
                            </div>
                            <p className="muted" style={{ fontSize: 13.5, marginTop: 3, lineHeight: 1.5 }}>{t(f.description)}</p>
                            {f.warning && (
                              <p style={{ fontSize: 12.5, color: 'var(--amber)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                                <Ico.warn width={12} height={12} /> {t(f.warning)}
                              </p>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                            <input
                              type="number" className="input mono"
                              value={current} min={f.min} max={f.max} step={f.step}
                              onChange={e => { const v = Number(e.target.value); if (!isNaN(v)) setRuleInputs(prev => ({ ...prev, [f.key]: v })) }}
                              style={{ width: 90, textAlign: 'center', padding: '10px 8px' }}
                            />
                            <span className="muted" style={{ fontSize: 13, width: 34 }}>{f.unit === 'percent' ? '%' : f.unit === 'aed' ? 'AED' : t('days')}</span>
                            {!isDefault && (
                              <button className="btn btn-neutral" style={{ padding: '8px 12px', fontSize: 12.5 }}
                                onClick={() => setRuleInputs(prev => ({ ...prev, [f.key]: defInput }))}
                                title={`${t('Reset to default')} (${fmtValue(def, f.unit)})`}>
                                {t('Reset')}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Slider */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span className="mono muted" style={{ fontSize: 11, width: 30, textAlign: 'right' }}>{f.min}</span>
                          <div style={{ position: 'relative', flex: 1, height: 8, background: 'var(--panel-alt)', border: '1px solid var(--line)', borderRadius: 999 }}>
                            <div style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', width: 2, height: 14, background: 'var(--line-strong)', borderRadius: 2, left: `${((defInput - f.min) / (f.max - f.min)) * 100}%` }}
                              title={`${t('Default')}: ${fmtValue(def, f.unit)}`} />
                            <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: 999, background: isDefault ? 'var(--line-strong)' : 'var(--gold)', width: `${Math.max(0, Math.min(100, sliderPct))}%`, transition: 'width .15s' }} />
                            <input
                              type="range" min={f.min} max={f.max} step={f.step} value={current}
                              onChange={e => setRuleInputs(prev => ({ ...prev, [f.key]: Number(e.target.value) }))}
                              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                              aria-label={t(f.label)}
                            />
                          </div>
                          <span className="mono muted" style={{ fontSize: 11, width: 30 }}>{f.max}</span>
                        </div>

                        <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
                          {t('MOEI default')}: <span className="mono" style={{ color: 'var(--ink)' }}>{fmtValue(def, f.unit)}</span>
                          {!isDefault && <> · {t('Active')}: <span className="mono" style={{ color: 'var(--gold-dark)', fontWeight: 700 }}>{fmtValue(fromInput(current, f.unit), f.unit)}</span></>}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Accessibility section ────────────────────────────────────────── */}
      {section === 'accessibility' && (
        <div className="card card-pad">
          <AccessibilitySettings />
        </div>
      )}

      {/* ── Sticky save bar ──────────────────────────────────────────────── */}
      {dirty && !loading && (
        <div style={{ position: 'fixed', bottom: 0, insetInlineStart: 0, insetInlineEnd: 0, zIndex: 50, display: 'flex', justifyContent: 'center', padding: '0 16px 18px', pointerEvents: 'none' }}>
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 22px', borderColor: 'var(--gold-line)', boxShadow: 'var(--shadow-lg)', pointerEvents: 'auto' }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--gold-bright)', flexShrink: 0 }} />
            <span style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 14.5 }}>{t('You have unsaved changes')}</span>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-neutral" style={{ padding: '9px 16px', fontSize: 13.5 }} disabled={saving}
                onClick={() => (section === 'chatbot'
                  ? setInstructions({ ...savedInstructions })
                  : setRuleInputs({ ...savedRuleInputs }))}>
                {t('Discard')}
              </button>
              <button className="btn btn-primary" style={{ padding: '9px 16px', fontSize: 13.5 }} disabled={saving}
                onClick={() => (section === 'chatbot' ? saveChatbot() : saveRules())}>
                {saving ? t('Saving…') : t('Save Changes', 'حفظ التغييرات')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
