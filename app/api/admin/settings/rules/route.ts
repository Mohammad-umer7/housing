import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/middleware/auth'
import { getGovernanceRuleOverrides, saveGovernanceRuleOverrides } from '@/lib/data-layer'
import { OFFICIAL_MOEI_RULES, invalidateRulesCache } from '@/governance/housing-arrears'
import { successResponse, errorResponse } from '@/lib/api-response'

// GET /api/admin/settings/rules
// Returns current active values (DB overrides merged with statutory defaults).
export async function GET(req: NextRequest) {
  try {
    await requireAuth(req, ['admin'])
  } catch {
    return NextResponse.json(errorResponse('Forbidden', 403), { status: 403 })
  }
  const ov = await getGovernanceRuleOverrides()
  return NextResponse.json(successResponse({
    // Return the current active value (DB override or statutory default)
    maxDeductionPercent:      ov.maxDeductionPercent      ?? OFFICIAL_MOEI_RULES.MAX_DEDUCTION_PERCENT,
    hardshipDeductionPercent: ov.hardshipDeductionPercent ?? OFFICIAL_MOEI_RULES.HARDSHIP_DEDUCTION_PERCENT,
    hardshipPerMemberIncome:  ov.hardshipPerMemberIncome  ?? OFFICIAL_MOEI_RULES.HARDSHIP_PER_MEMBER_INCOME,
    certFreshnessDays:        ov.certFreshnessDays        ?? OFFICIAL_MOEI_RULES.CERT_FRESHNESS_DAYS,
    dbrCapSalaried:           ov.dbrCapSalaried           ?? OFFICIAL_MOEI_RULES.DBR_CAP_SALARIED,
    dbrCapRetiree:            ov.dbrCapRetiree            ?? OFFICIAL_MOEI_RULES.DBR_CAP_RETIREE,
    salaryDiscrepancyThresholdPct: ov.salaryDiscrepancyThresholdPct ?? OFFICIAL_MOEI_RULES.SALARY_DISCREPANCY_THRESHOLD_PCT,
    // Include the statutory defaults so the UI can show "default: X"
    defaults: {
      maxDeductionPercent:      OFFICIAL_MOEI_RULES.MAX_DEDUCTION_PERCENT,
      hardshipDeductionPercent: OFFICIAL_MOEI_RULES.HARDSHIP_DEDUCTION_PERCENT,
      hardshipPerMemberIncome:  OFFICIAL_MOEI_RULES.HARDSHIP_PER_MEMBER_INCOME,
      certFreshnessDays:        OFFICIAL_MOEI_RULES.CERT_FRESHNESS_DAYS,
      dbrCapSalaried:           OFFICIAL_MOEI_RULES.DBR_CAP_SALARIED,
      dbrCapRetiree:            OFFICIAL_MOEI_RULES.DBR_CAP_RETIREE,
      salaryDiscrepancyThresholdPct: OFFICIAL_MOEI_RULES.SALARY_DISCREPANCY_THRESHOLD_PCT,
    },
  }))
}

// PUT /api/admin/settings/rules
// Saves new values and immediately invalidates the in-memory rules cache so the
// next case processed will use the updated values.
export async function PUT(req: NextRequest) {
  try {
    await requireAuth(req, ['admin'])
  } catch {
    return NextResponse.json(errorResponse('Forbidden', 403), { status: 403 })
  }
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(errorResponse('Invalid JSON', 400), { status: 400 })
  }

  // Validate ranges to prevent nonsensical values
  function pct(key: string, min = 0.01, max = 1.0): number | undefined {
    const v = Number(body[key])
    return Number.isFinite(v) && v >= min && v <= max ? v : undefined
  }
  function int(key: string, min = 1, max = 365): number | undefined {
    const v = Math.round(Number(body[key]))
    return Number.isFinite(v) && v >= min && v <= max ? v : undefined
  }

  const overrides = {
    maxDeductionPercent:      pct('maxDeductionPercent', 0.05, 0.50),
    hardshipDeductionPercent: pct('hardshipDeductionPercent', 0.05, 0.50),
    hardshipPerMemberIncome:  (() => { const v = Number(body.hardshipPerMemberIncome); return v >= 500 && v <= 20000 ? v : undefined })(),
    certFreshnessDays:        int('certFreshnessDays', 7, 365),
    dbrCapSalaried:           pct('dbrCapSalaried', 0.10, 1.0),
    dbrCapRetiree:            pct('dbrCapRetiree', 0.10, 1.0),
    salaryDiscrepancyThresholdPct: pct('salaryDiscrepancyThresholdPct', 0.01, 0.50),
  }

  await saveGovernanceRuleOverrides(overrides)
  // Flush the 5-minute cache immediately so the new values take effect on the next case
  invalidateRulesCache()

  return NextResponse.json(successResponse({ saved: true }))
}
