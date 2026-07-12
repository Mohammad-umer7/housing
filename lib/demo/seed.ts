// Seed data for the portable demo (no Supabase). Loaded once into the in-memory
// mock store (lib/demo/mock-supabase.ts). Everything here is FAKE — invented names,
// Emirates IDs, phone numbers and loan figures — safe to ship publicly.
//
// Tables mirror supabase/schema.sql + uae-pass-schema.sql so the same data-layer /
// source-systems / route code runs unchanged against the mock.

type Row = Record<string, unknown>

const NOW = '2026-07-01T09:00:00.000Z'

// ── Fake beneficiaries (loan / arrears "system of record") ──────────────────────
// A spread of profiles so a demo shows every pipeline outcome:
//   clean approve · borderline · high-arrears escalation · priority (UAE PASS) cases.
const APPLICANTS: Row[] = [
  {
    // Canonical doc-demo applicant: reason 'other' → a single salary certificate is the
    // only required document, so the three demo sample docs route cleanly. Salary 27,880
    // matches the calibrated demo-approve.pdf certificate. Clean financials → APPROVE path.
    case_number: 'MSZHP_100075', full_name: 'Salem Saif Al Ameri', full_name_ar: 'سالم سيف العامري',
    emirates_id: '784-1988-2341567-3', phone: '+971501234567',
    arrears_amount: 10641, monthly_salary: 27880, monthly_expenses: 4200,
    property_address: 'Villa 42, Al Bateen, Abu Dhabi', previous_default: false, status: 'pending',
    loan_bank_name: 'Emirates Development Bank', loan_account_number: 'EDB-2021-104587',
    total_loan_amount: 480000, remaining_loan_balance: 410000, current_installment: 3620,
    remaining_loan_months: 132, auto_dda: true, reschedule_reason: 'other',
    months_in_arrears: 3, family_size: 4, marital_status: 'married', income_changed: false,
    number_of_children: 2, has_active_application: false, payment_history: [], created_at: NOW,
  },
  {
    case_number: 'MSZHP_111325', full_name: 'Aisha Mohammed Al Marri', full_name_ar: 'عائشة محمد المري',
    emirates_id: '784-1992-7651234-8', phone: '+971507654321',
    arrears_amount: 34012, monthly_salary: 9700, monthly_expenses: 2800,
    property_address: 'Apt 1204, Al Reem Island, Abu Dhabi', previous_default: false, status: 'pending',
    loan_bank_name: 'Abu Dhabi Islamic Bank', loan_account_number: 'ADIB-2020-388291',
    total_loan_amount: 320000, remaining_loan_balance: 250000, current_installment: 3092,
    remaining_loan_months: 96, auto_dda: true, reschedule_reason: 'salary_reduction',
    months_in_arrears: 11, family_size: 3, marital_status: 'married', income_changed: true,
    number_of_children: 1, has_active_application: false, payment_history: [], created_at: NOW,
  },
  {
    case_number: 'MSZHP_120880', full_name: 'Hamdan Khalifa Al Suwaidi', full_name_ar: 'حمدان خليفة السويدي',
    emirates_id: '784-1979-4523678-1', phone: '+971509876543',
    arrears_amount: 295500, monthly_salary: 12000, monthly_expenses: 5500,
    property_address: 'Villa 17, Mohammed Bin Zayed City', previous_default: false, status: 'pending',
    loan_bank_name: 'First Abu Dhabi Bank', loan_account_number: 'FAB-2019-665491',
    total_loan_amount: 850000, remaining_loan_balance: 800000, current_installment: 5910,
    remaining_loan_months: 180, auto_dda: true, reschedule_reason: 'business_failure',
    months_in_arrears: 42, family_size: 6, marital_status: 'married', income_changed: false,
    number_of_children: 4, has_active_application: false, payment_history: [], created_at: NOW,
  },
  {
    case_number: 'MSZHP_131013', full_name: 'Latifa Ahmed Al Falasi', full_name_ar: 'لطيفة أحمد الفلاسي',
    emirates_id: '784-1995-9988776-5', phone: '+971502233445',
    arrears_amount: 105621, monthly_salary: 9480, monthly_expenses: 1100,
    property_address: 'Apt 305, Al Nahda, Sharjah', previous_default: false, status: 'pending',
    loan_bank_name: 'Emirates Development Bank', loan_account_number: 'EDB-2022-552103',
    total_loan_amount: 180000, remaining_loan_balance: 170000, current_installment: 4801,
    remaining_loan_months: 60, auto_dda: true, reschedule_reason: 'job_loss',
    months_in_arrears: 22, family_size: 5, marital_status: 'married', income_changed: true,
    number_of_children: 3, has_active_application: false, payment_history: [], created_at: NOW,
  },
  {
    case_number: 'MSZHP_145634', full_name: 'Rashid Obaid Al Mazrouei', full_name_ar: 'راشد عبيد المزروعي',
    emirates_id: '784-1985-1122334-2', phone: '+971554466778',
    arrears_amount: 54840, monthly_salary: 28365, monthly_expenses: 3500,
    property_address: 'Villa 88, Khalifa City A, Abu Dhabi', previous_default: true, status: 'pending',
    loan_bank_name: 'Emirates NBD', loan_account_number: 'ENBD-2018-774512',
    total_loan_amount: 410000, remaining_loan_balance: 360000, current_installment: 5484,
    remaining_loan_months: 84, auto_dda: true, reschedule_reason: 'family_circumstances',
    months_in_arrears: 10, family_size: 4, marital_status: 'married', income_changed: false,
    number_of_children: 2, has_active_application: false, payment_history: [], created_at: NOW,
  },
  {
    case_number: 'MSZHP_150420', full_name: 'Mariam Yousef Al Hosani', full_name_ar: 'مريم يوسف الحوسني',
    emirates_id: '784-1990-5566778-9', phone: '+971563344556',
    arrears_amount: 22330, monthly_salary: 24955, monthly_expenses: 3000,
    property_address: 'Villa 5, Al Maqtaa, Abu Dhabi', previous_default: false, status: 'pending',
    loan_bank_name: 'Emirates Development Bank', loan_account_number: 'EDB-2023-771902',
    total_loan_amount: 600000, remaining_loan_balance: 540000, current_installment: 3190,
    remaining_loan_months: 168, auto_dda: true, reschedule_reason: 'medical_expenses',
    months_in_arrears: 7, family_size: 2, marital_status: 'married', income_changed: false,
    number_of_children: 1, has_active_application: false, payment_history: [], created_at: NOW,
  },
  {
    // Priority / hardship (UAE PASS widow) — demonstrates G-06 fast-track routing.
    case_number: 'MSZHP_160915', full_name: 'Fatima Abdullah Al Nuaimi', full_name_ar: 'فاطمة عبدالله النعيمي',
    emirates_id: '784-1975-3344556-7', phone: '+971505551234',
    arrears_amount: 48884, monthly_salary: 11000, monthly_expenses: 3200,
    property_address: 'Villa 9, Al Rahba, Abu Dhabi', previous_default: false, status: 'pending',
    loan_bank_name: 'Emirates Development Bank', loan_account_number: 'EDB-2020-119284',
    total_loan_amount: 340000, remaining_loan_balance: 300000, current_installment: 4444,
    remaining_loan_months: 90, auto_dda: true, reschedule_reason: 'family_circumstances',
    months_in_arrears: 11, family_size: 5, marital_status: 'widowed', income_changed: true,
    number_of_children: 4, has_active_application: false, payment_history: [], created_at: NOW,
  },
  {
    // Priority / hardship (UAE PASS senior/retiree).
    case_number: 'MSZHP_170233', full_name: 'Obaid Rashid Al Ketbi', full_name_ar: 'عبيد راشد الكتبي',
    emirates_id: '784-1958-7788990-1', phone: '+971502228899',
    arrears_amount: 14253, monthly_salary: 21800, monthly_expenses: 4000,
    property_address: 'Villa 23, Al Ain', previous_default: false, status: 'pending',
    loan_bank_name: 'First Abu Dhabi Bank', loan_account_number: 'FAB-2017-552210',
    total_loan_amount: 300000, remaining_loan_balance: 190000, current_installment: 4751,
    remaining_loan_months: 48, auto_dda: true, reschedule_reason: 'retirement',
    months_in_arrears: 3, family_size: 3, marital_status: 'married', income_changed: true,
    number_of_children: 0, has_active_application: false, payment_history: [], created_at: NOW,
  },
  {
    // Priority / hardship (UAE PASS person of determination).
    case_number: 'MSZHP_180644', full_name: 'Khalid Sultan Al Dhaheri', full_name_ar: 'خالد سلطان الظاهري',
    emirates_id: '784-1983-2233445-6', phone: '+971557778899',
    arrears_amount: 37338, monthly_salary: 13900, monthly_expenses: 3800,
    property_address: 'Apt 702, Al Wahda, Abu Dhabi', previous_default: false, status: 'pending',
    loan_bank_name: 'Emirates Development Bank', loan_account_number: 'EDB-2021-667281',
    total_loan_amount: 260000, remaining_loan_balance: 210000, current_installment: 3092,
    remaining_loan_months: 84, auto_dda: true, reschedule_reason: 'medical_expenses',
    months_in_arrears: 9, family_size: 4, marital_status: 'married', income_changed: false,
    number_of_children: 2, has_active_application: false, payment_history: [], created_at: NOW,
  },
  {
    case_number: 'MSZHP_190188', full_name: 'Noura Ali Al Shamsi', full_name_ar: 'نورة علي الشامسي',
    emirates_id: '784-1993-9900112-3', phone: '+971503334455',
    arrears_amount: 20922, monthly_salary: 25200, monthly_expenses: 2600,
    property_address: 'Apt 88, Yas Island, Abu Dhabi', previous_default: false, status: 'pending',
    loan_bank_name: 'Abu Dhabi Islamic Bank', loan_account_number: 'ADIB-2022-104433',
    total_loan_amount: 420000, remaining_loan_balance: 300000, current_installment: 3487,
    remaining_loan_months: 120, auto_dda: true, reschedule_reason: 'other',
    months_in_arrears: 6, family_size: 3, marital_status: 'married', income_changed: false,
    number_of_children: 1, has_active_application: false, payment_history: [], created_at: NOW,
  },
]

// ── UAE PASS identity/social profiles (DB-3) ────────────────────────────────────
const SOCIAL_AR: Record<string, string> = {
  none: 'مستفيد عادي', widow: 'أرملة', orphan: 'يتيم',
  senior: 'كبار المواطنين / متقاعد', determination: 'أصحاب الهمم',
}
function uaePassFrom(a: Row, social: string): Row {
  return {
    case_number: a.case_number, emirates_id: a.emirates_id,
    full_name: a.full_name, full_name_ar: a.full_name_ar, phone: a.phone,
    marital_status: a.marital_status, family_size: a.family_size,
    number_of_children: a.number_of_children ?? 0,
    social_status: social, social_status_ar: SOCIAL_AR[social] ?? SOCIAL_AR.none,
    is_priority: social !== 'none', created_at: NOW,
  }
}
const UAE_PASS_PROFILES: Row[] = [
  uaePassFrom(APPLICANTS[0], 'none'),
  uaePassFrom(APPLICANTS[1], 'none'),
  uaePassFrom(APPLICANTS[2], 'none'),
  uaePassFrom(APPLICANTS[3], 'none'),
  uaePassFrom(APPLICANTS[4], 'none'),
  uaePassFrom(APPLICANTS[5], 'none'),
  uaePassFrom(APPLICANTS[6], 'widow'),
  uaePassFrom(APPLICANTS[7], 'senior'),
  uaePassFrom(APPLICANTS[8], 'determination'),
  uaePassFrom(APPLICANTS[9], 'none'),
]

// ── Historical approved decisions (fairness precedent corpus) ───────────────────
// A real spread of debt-to-income ratios so the Fairness agent + Critic's
// lookup_similar_decisions have precedent to compare against. Drawn from the cleaned
// RescheduleArrears sample. status/dti/arrears are what getSimilarCases reads.
const H = (case_number: string, monthly_salary: number, arrears_amount: number, current_installment: number,
  months_in_arrears: number, monthly_payment: number | null, duration_months: number | null,
  debt_to_income_ratio: number, processed_at: string): Row => ({
  case_number, status: 'approved', monthly_salary, arrears_amount, monthly_expenses: 0,
  current_installment, months_in_arrears, monthly_payment, duration_months,
  total_new_monthly_payment: monthly_payment != null ? current_installment + monthly_payment : null,
  debt_to_income_ratio, reschedule_reason: 'other', decision_reason: 'Bulk Approved by Manager', processed_at,
})
const HISTORICAL_CASES: Row[] = [
  H('MSZHP_111671', 16711, 6574, 3287, 2, 55, 120, 0.197, '2023-02-08T00:00:00.000Z'),
  H('MSZHP_157545', 47589, 84816, 7068, 12, 1531, 60, 0.149, '2023-01-30T00:00:00.000Z'),
  H('MSZHP_142172', 19700, 34012, 3092, 11, 830, 41, 0.157, '2023-01-20T00:00:00.000Z'),
  H('MSZHP_138920', 3000, 69673, 3667, 19, null, null, 1.222, '2023-01-20T00:00:00.000Z'),
  H('MSZHP_137668', 23610, 11808, 3936, 3, 738, 16, 0.167, '2023-01-18T00:00:00.000Z'),
  H('MSZHP_47756', 76437, 60012, 1667, 36, 5000, 12, 0.022, '2023-01-18T00:00:00.000Z'),
  H('MSZHP_152123', 26861, 40302, 4478, 9, 896, 45, 0.167, '2023-01-20T00:00:00.000Z'),
  H('MSZHP_123416', 25200, 20922, 3487, 6, 1017, 24, 0.138, '2023-02-02T00:00:00.000Z'),
  H('MSZHP_33686', 25200, 28010, 2801, 10, 1167, 24, 0.111, '2023-01-18T00:00:00.000Z'),
  H('MSZHP_138181', 21800, 14253, 4751, 3, null, null, 0.218, '2023-01-18T00:00:00.000Z'),
  H('MSZHP_15119', 20052, 7884, 3942, 2, 69, 115, 0.197, '2023-01-20T00:00:00.000Z'),
  H('MSZHP_114355', 51322, 224248, 5188, 43, 4025, 57, 0.101, '2023-01-06T00:00:00.000Z'),
  H('MSZHP_43901', 16052, 5557, 1667, 3, 505, 11, 0.104, '2023-01-18T00:00:00.000Z'),
  H('MSZHP_128429', 21180, 9002, 4501, 2, null, null, 0.213, '2023-01-18T00:00:00.000Z'),
  H('MSZHP_139439', 16095, 34488, 3832, 9, null, null, 0.238, '2023-01-18T00:00:00.000Z'),
  H('MSZHP_58280', 36300, 11086, 5543, 2, 504, 22, 0.153, '2023-08-08T00:00:00.000Z'),
  H('MSZHP_151065', 22155, 54756, 3693, 15, 4423, 75, 0.167, '2025-06-04T00:00:00.000Z'),
  H('MSZHP_123311', 24900, 124025, 3025, 41, 1908, 65, 0.121, '2023-01-18T00:00:00.000Z'),
  H('MSZHP_131013h', 9480, 105621, 4801, 22, null, null, 0.506, '2023-01-18T00:00:00.000Z'),
  H('MSZHP_133157', 50400, 127368, 14152, 9, null, null, 0.281, '2023-01-18T00:00:00.000Z'),
  H('MSZHP_142982', 28950, 91062, 5059, 18, 731, 118, 0.175, '2023-03-07T00:00:00.000Z'),
  H('MSZHP_130937', 20919, 17928, 2988, 6, 747, 24, 0.143, '2023-01-18T00:00:00.000Z'),
  H('MSZHP_163764', 24955, 22330, 3190, 7, 930, 24, 0.128, '2023-01-18T00:00:00.000Z'),
  H('MSZHP_108148', 27880, 48884, 4444, 11, 1321, 37, 0.159, '2023-01-24T00:00:00.000Z'),
  H('MSZHP_129839', 19450, 101344, 3167, 32, 719, 141, 0.163, '2023-01-16T00:00:00.000Z'),
  H('MSZHP_151256', 31900, 43072, 5384, 8, 979, 44, 0.169, '2023-03-09T00:00:00.000Z'),
  H('MSZHP_32012', 19955, 5096, 2548, 2, 510, 10, 0.128, '2023-01-16T00:00:00.000Z'),
  H('MSZHP_3445', 29759, 10349, 1667, 6, 862, 12, 0.056, '2023-01-16T00:00:00.000Z'),
  H('MSZHP_100602', 59350, 170472, 7103, 24, 3964, 43, 0.12, '2023-02-14T00:00:00.000Z'),
  H('MSZHP_158388', 10000, 82320, 5880, 14, 1112, 74, 0.588, '2023-01-24T00:00:00.000Z'),
  H('MSZHP_55432', 24567, 295500, 5910, 50, null, null, 0.241, '2023-01-13T00:00:00.000Z'),
  H('MSZHP_7181', 17200, 14395, 2879, 5, 514, 28, 0.167, '2023-01-16T00:00:00.000Z'),
  H('MSZHP_140064', 23398, 72072, 3003, 24, 627, 115, 0.128, '2023-01-16T00:00:00.000Z'),
  H('MSZHP_145634h', 28365, 54840, 5484, 10, 997, 55, 0.193, '2023-01-10T00:00:00.000Z'),
  H('MSZHP_144027', 27500, 77775, 4575, 17, 1235, 63, 0.166, '2023-02-02T00:00:00.000Z'),
  H('MSZHP_107766', 11000, 64008, 2667, 24, null, null, 0.242, '2023-07-25T00:00:00.000Z'),
  H('MSZHP_143330', 19570, 45287, 4117, 11, null, null, 0.21, '2023-01-13T00:00:00.000Z'),
  H('MSZHP_151018', 23925, 97773, 4251, 23, 531, 184, 0.178, '2023-06-08T00:00:00.000Z'),
  H('MSZHP_104640', 40000, 39987, 4443, 9, 1666, 24, 0.111, '2023-01-10T00:00:00.000Z'),
  H('MSZHP_127218', 18473, 37338, 2667, 14, 505, 74, 0.144, '2023-01-11T00:00:00.000Z'),
]

// Build a FRESH copy of the seed each time (so a process restart / test reset gets
// clean data and never shares mutable row objects with a previous store).
export function buildDemoSeed(): Record<string, Row[]> {
  const deep = <T>(v: T): T => JSON.parse(JSON.stringify(v))
  return {
    applicants: deep(APPLICANTS),
    uae_pass_profiles: deep(UAE_PASS_PROFILES),
    historical_cases: deep(HISTORICAL_CASES),
    // SADDAD's own store — starts empty; the pipeline fills it as cases are processed.
    cases: [],
    agent_steps: [],
    audit_logs: [],
    job_queue: [],
    feedback: [],
    // Seeded (empty) so ensureSystemSettings' pre-check select succeeds → no rpc path.
    system_settings: [],
    login_log: [],
  }
}
