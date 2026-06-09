// Risk Forecaster (graph node) — deterministic weighted risk score. No LLM, so
// the score is reproducible for audit. Shares the single source-of-truth scoring
// functions in governance/ so it can never drift from the Financial Agent.

import { updateAgentStep, type AgentName } from '@/lib/data-layer'
import {
  computeDebtToIncomeRatio,
  computeRiskScore,
  riskLevelFromScore,
} from '@/governance/housing-arrears'
import type { SaddadStateType, SaddadNodeUpdate } from './graph-state'
import type { RiskForecast } from './types'

export async function riskForecasterNode(state: SaddadStateType): Promise<SaddadNodeUpdate> {
  const { caseNumber, formData } = state
  console.log(`[RiskForecasterAgent] START case=${caseNumber}`)
  const start = Date.now()
  const agent: AgentName = 'risk_forecaster'

  const defaultResult: RiskForecast = { riskLevel: 'MEDIUM', riskScore: 50 }

  try {
    await updateAgentStep(caseNumber, agent, { status: 'running', started_at: new Date().toISOString() })

    const arrears = Number(formData.arrears_amount) || 0
    const salary = Number(formData.monthly_salary) || 0
    const expenses = Number(formData.monthly_expenses) || 0
    const current_installment = Number(formData.current_installment) || 0
    const months_in_arrears = Number(formData.months_in_arrears) || 0
    const reschedule_reason = String(formData.reschedule_reason || 'other')

    const dti = computeDebtToIncomeRatio(current_installment, expenses, salary)
    const riskScore = computeRiskScore({ dti, arrears, monthsInArrears: months_in_arrears, rescheduleReason: reschedule_reason })
    const riskLevel = riskLevelFromScore(riskScore)

    const duration = Date.now() - start
    await updateAgentStep(caseNumber, agent, {
      status: 'done',
      completed_at: new Date().toISOString(),
      duration_ms: duration,
      result_summary: `Risk: ${riskLevel} (${riskScore}/100) · DTI ${(dti * 100).toFixed(1)}% · Reason: ${reschedule_reason}`,
    })

    console.log(`[RiskForecasterAgent] DONE case=${caseNumber} riskLevel=${riskLevel} score=${riskScore} duration=${duration}ms`)
    return { riskForecast: { riskLevel, riskScore } }
  } catch (err) {
    console.error(`[RiskForecasterAgent] ERROR (non-fatal) case=${caseNumber}`, err)
    try {
      await updateAgentStep(caseNumber, agent, {
        status: 'failed',
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - start,
        result_summary: `Non-fatal error: ${String(err)}`,
      })
    } catch { /* ignore secondary failure */ }
    return { riskForecast: defaultResult }
  }
}
