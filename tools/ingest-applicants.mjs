// Ingests the REAL RescheduleArrears dataset as the live lookup source:
//   • applicants      — one beneficiary per Excel App ID (MSZHP_…), with the real
//                       financial fields + Programme/UAE-PASS data generated stably
//                       per ID (identity, family, balance, payment history). This is
//                       what the judge retrieves by typing an Application ID.
//   • historical_cases— the historical APPROVED decisions, the Fairness precedent
//                       corpus (kept separate from live `cases`).
// Also REMOVES the 6 demo personas (MOEI-2026-100x).
//
// Run: node tools/ingest-applicants.mjs            -> writes supabase/applicants-import.sql
// Run: node tools/ingest-applicants.mjs --apply    -> writes directly to DB-1
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')
const applyDirectly = process.argv.includes('--apply')

// ── DB-1 creds (only needed for --apply) ──────────────────────────────────────
let db = null
if (applyDirectly) {
  const { createClient } = require('@supabase/supabase-js')
  const env = readFileSync('.env.local', 'utf8')
  const get = (k) => (env.match(new RegExp(`^${k}=(.+)$`, 'm'))?.[1] ?? '').trim()
  const url = get('NEXT_PUBLIC_SUPABASE_URL')
  const key = get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Missing DB-1 Supabase creds in .env.local')
  db = createClient(url, key)
}

// ── deterministic, stable-per-ID generators (so the same App ID always yields the
//    same retrieved Programme data) ──────────────────────────────────────────────
const NUL = String.fromCharCode(0)
const clean = (s) => String(s ?? '').split(NUL).join('').replace(/[\u0000-\u001F\u007F]/g, '').trim()
function hashInt(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  return Math.abs(h)
}
const FIRST = ['Salem','Aisha','Hamdan','Latifa','Rashid','Mariam','Khalid','Fatima','Saeed','Noura','Ali','Shamsa','Obaid','Maitha','Sultan','Hessa','Majid','Reem','Tariq','Wadima','Hamad','Salama','Faisal','Alyazia','Nasser','Moza']
const LAST = ['Al Ameri','Al Marri','Al Suwaidi','Al Falasi','Al Mazrouei','Al Hosani','Al Nuaimi','Al Shamsi','Al Ketbi','Al Dhaheri','Al Mansoori','Al Qubaisi','Al Zaabi','Al Blooshi','Al Kaabi','Al Rashedi']
const FIRST_AR = ['سالم','عائشة','حمدان','لطيفة','راشد','مريم','خالد','فاطمة','سعيد','نورة','علي','شمسة','عبيد','ميثاء','سلطان','حصة','ماجد','ريم','طارق','وضحى','حمد','سلامة','فيصل','اليازية','ناصر','موزة']
const LAST_AR = ['العامري','المري','السويدي','الفلاسي','المزروعي','الحوسني','النعيمي','الشامسي','الكتبي','الظاهري','المنصوري','القبيسي','الزعابي','البلوشي','الكعبي','الراشدي']

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const excelDate = (serial) => {
  const n = Number(serial)
  if (!Number.isFinite(n) || n < 10000 || n > 60000) return null
  return new Date(Date.UTC(1899, 11, 30) + n * 86400000).toISOString()
}

// Read the beneficiary's free text the way an officer would, to set the reason.
function reasonFromText(text) {
  const t = (text || '').toLowerCase()
  if (/job\s*loss|unemploy|laid\s*off|terminated|فقدان\s*العمل|عاطل|لا\s*اعمل|فقدت\s*وظيفتي|إنهاء\s*الخدمة/i.test(text)) return 'job_loss'
  if (/retire|تقاعد/i.test(text)) return 'job_loss'
  if (/salary\s*(reduction|reduced|cut)|انخفاض|خفض|تخفيض\s*الراتب/i.test(text)) return 'salary_reduction'
  if (/medical|treatment|hospital|علاج|مرض|مستشفى/i.test(text)) return 'medical_expenses'
  if (/business|تجار|مشروع/i.test(t)) return 'business_failure'
  if (/family|أسر|عائل/i.test(text)) return 'family_circumstances'
  return 'other'
}

function buildPaymentHistory(monthsInArrears, installment) {
  // Last 8 months; the most recent `monthsInArrears` are missed, the rest paid.
  const out = []
  const now = new Date('2026-05-01T00:00:00.000Z')
  const missed = Math.min(8, Math.max(0, monthsInArrears))
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now); d.setUTCMonth(d.getUTCMonth() - i)
    out.push({ month: d.toISOString().slice(0, 7), status: i < missed ? 'missed' : 'paid', amount: installment })
  }
  return out
}

const wb = XLSX.readFile('RescheduleArrears (1).xlsx')
const byCase = new Map()

for (const sheet of wb.SheetNames) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { defval: null })
  for (const r of rows) {
    const appId = String(r.APPLICATION_ID ?? '')
    if (!appId.startsWith('MSZHP_')) continue

    const salary = num(r.CURRENT_SALARY)
    const arrears = num(r.OVER_DUE_AMT)
    const emi = num(r.CURRENT_EMI_AMT)
    const overdueMonths = num(r.OVER_DUE_MONTHS)
    if (salary < 3000 || salary > 500000) continue
    if (arrears < 100 || arrears > 1_000_000) continue
    if (emi < 100 || emi > 60000) continue
    if (overdueMonths < 1 || overdueMonths > 200) continue

    const h = hashInt(appId)
    const fi = h % FIRST.length
    const li = (h >> 5) % LAST.length
    const familySize = 1 + (h % 8)
    const remainingMonths = (() => {
      const add = num(r.ADDITIONAL_MONTHS)
      if (add >= 12 && add <= 360) return Math.round(add)
      return 60 + (h % 180)
    })()
    const remainingBalance = Math.round(emi * remainingMonths)
    const totalLoan = remainingBalance + emi * (h % 120)
    const freeText = `${clean(r.JUSTIFICATIONS)} ${clean(r.REMARKS)}`.trim()
    const reason = reasonFromText(freeText)
    const premium = num(r.NEW_EMI_AMT) || num(r.ADDITIONAL_PREMIUM)
    const dti = Math.round((emi / salary) * 1000) / 1000

    byCase.set(appId, {
      applicant: {
        case_number: appId,
        full_name: `${FIRST[fi]} ${LAST[li]}`,
        full_name_ar: `${FIRST_AR[fi]} ${LAST_AR[li]}`,
        emirates_id: `784-${1960 + (h % 45)}-${String(1000000 + (h % 9000000)).padStart(7, '0')}-${h % 10}`,
        phone: `+9715${(h % 90000000 + 10000000)}`.slice(0, 13),
        arrears_amount: Math.round(arrears),
        monthly_salary: Math.round(salary),
        monthly_expenses: 0,
        previous_default: false,
        status: 'pending',
        loan_bank_name: 'Emirates Development Bank',
        loan_account_number: clean(r.EDB_LOAN_ID) || `LD${1000000 + (h % 9000000)}`,
        total_loan_amount: Math.round(totalLoan),
        remaining_loan_balance: remainingBalance,
        current_installment: Math.round(emi),
        remaining_loan_months: remainingMonths,
        auto_dda: clean(r.DEDUCT_FROM_SALARY).toUpperCase() !== 'NO',
        reschedule_reason: reason,
        months_in_arrears: Math.round(overdueMonths),
        family_size: familySize,
        marital_status: familySize > 1 ? 'married' : (h % 2 ? 'married' : 'single'),
        income_changed: reason === 'job_loss' || reason === 'salary_reduction',
        has_active_application: false,
        remarks: clean(r.REMARKS).slice(0, 500) || null,
        justifications: clean(r.JUSTIFICATIONS).slice(0, 500) || null,
        payment_history: buildPaymentHistory(Math.round(overdueMonths), Math.round(emi)),
      },
      historical: {
        case_number: appId,
        status: 'approved',
        monthly_salary: Math.round(salary),
        arrears_amount: Math.round(arrears),
        current_installment: Math.round(emi),
        months_in_arrears: Math.round(overdueMonths),
        monthly_payment: premium ? Math.round(premium) : null,
        duration_months: num(r.ADDITIONAL_MONTHS) || null,
        total_new_monthly_payment: premium ? Math.round(emi + premium) : null,
        debt_to_income_ratio: dti,
        reschedule_reason: reason,
        decision_reason: clean(r.JUSTIFICATIONS).slice(0, 400) || 'Historical approved rescheduling (MSZHP)',
        processed_at: excelDate(r.APPROVED_DATE) ?? excelDate(r.CREATED_DATE) ?? '2024-01-01T00:00:00.000Z',
      },
    })
  }
}

const records = [...byCase.values()]
const applicants = records.map((r) => r.applicant)
const historical = records.map((r) => r.historical)
console.log(`Prepared ${applicants.length} applicants + ${historical.length} historical_cases from the Excel.`)

if (!applyDirectly) {
  writeFileSync('supabase/applicants-import.json', JSON.stringify({ applicants, historical }, null, 2))
  console.log('Wrote supabase/applicants-import.json (no DB changes). Re-run with --apply to load.')
  process.exit(0)
}

// ── Apply to DB-1 ─────────────────────────────────────────────────────────────
// 1) Remove the demo personas + any prior MSZHP applicants, then load fresh.
await db.from('applicants').delete().like('case_number', 'MOEI-2026-%')
await db.from('applicants').delete().like('case_number', 'MSZHP_%')
let n = 0
for (let i = 0; i < applicants.length; i += 400) {
  const batch = applicants.slice(i, i + 400)
  const { error } = await db.from('applicants').upsert(batch, { onConflict: 'case_number' })
  if (error) { console.error('applicants batch error:', error.message); process.exitCode = 1; break }
  n += batch.length; console.log(`  applicants ${n}/${applicants.length}`)
}

// 2) Precedent corpus.
await db.from('historical_cases').delete().like('case_number', 'MSZHP_%')
let m = 0
for (let i = 0; i < historical.length; i += 400) {
  const batch = historical.slice(i, i + 400)
  const { error } = await db.from('historical_cases').upsert(batch, { onConflict: 'case_number' })
  if (error) { console.error('historical batch error:', error.message); process.exitCode = 1; break }
  m += batch.length; console.log(`  historical_cases ${m}/${historical.length}`)
}

// 3) Move the old MSZHP precedent rows out of live `cases` (they now live in
//    historical_cases) so `cases` holds only live decisions.
await db.from('cases').delete().like('case_number', 'MSZHP_%')

const dtis = historical.map((r) => r.debt_to_income_ratio).sort((a, b) => a - b)
console.log(`Done. DTI median ${dtis[Math.floor(dtis.length / 2)]} (range ${dtis[0]}..${dtis[dtis.length - 1]}).`)
