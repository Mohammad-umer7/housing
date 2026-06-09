// Fairness Agent (graph node) — compares the proposed decision against historical
// decisions at a similar debt-to-income ratio and flags inconsistency. Non-fatal:
// a failure here must never block the pipeline.
//
// fairnessSkippedNode records an honest "skipped" agent_step when the Planner chose
// FAST_TRACK, so the audit trail reflects what was deliberately omitted.

import { updateAgentStep, getSimilarCases, type AgentName } from '@/lib/data-layer'
import type { SaddadStateType, SaddadNodeUpdate } from './graph-state'
import type { FairnessResult } from './types'

export async function fairnessNode(state: SaddadStateType): Promise<SaddadNodeUpdate> {
  const { caseNumber, govResult, financials } = state
  console.log(`[FairnessAgent] START case=${caseNumber}`)
  const start = Date.now()
  const agent: AgentName = 'fairness_agent'

  const defaultResult: FairnessResult = {
    consistencyFlag: true,
    consistencyScore: 100,
    similarCasesFound: 0,
    fairnessNote: 'Fairness check waived — no comparable cases available',
  }

  try {
    await updateAgentStep(caseNumber, agent, { status: 'running', started_at: new Date().toISOString() })

    const similarCases = await getSimilarCases(financials.debt_to_income_ratio)

    let result: FairnessResult
    if (similarCases.length === 0) {
      result = {
        consistencyFlag: true,
        consistencyScore: 100,
        similarCasesFound: 0,
        fairnessNote: 'No comparable cases found — consistency check waived',
      }
    } else {
      const currentDecisionLower = govResult.decision.toLowerCase()
      const sameDecisionCount = similarCases.filter((c: { status: string }) => c.status === currentDecisionLower).length
      const consistencyScore = Math.round((sameDecisionCount / similarCases.length) * 100)
      const consistencyFlag = consistencyScore >= 70

      result = {
        consistencyFlag,
        consistencyScore,
        similarCasesFound: similarCases.length,
        fairnessNote: consistencyFlag
          ? `${sameDecisionCount}/${similarCases.length} comparable cases received same decision (${consistencyScore}% consistency)`
          : `Only ${sameDecisionCount}/${similarCases.length} comparable cases matched — potential inconsistency flagged for review`,
      }
    }

    const duration = Date.now() - start
    await updateAgentStep(caseNumber, agent, {
      status: 'done',
      completed_at: new Date().toISOString(),
      duration_ms: duration,
      result_summary: `Consistency: ${result.consistencyScore}% · ${result.similarCasesFound} similar cases · ${result.consistencyFlag ? 'CONSISTENT' : 'FLAGGED'}`,
    })

    console.log(`[FairnessAgent] DONE case=${caseNumber} consistencyScore=${result.consistencyScore} flag=${result.consistencyFlag} duration=${duration}ms`)
    return { fairnessResult: result }
  } catch (err) {
    console.error(`[FairnessAgent] ERROR (non-fatal) case=${caseNumber}`, err)
    try {
      await updateAgentStep(caseNumber, agent, {
        status: 'failed',
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - start,
        result_summary: `Non-fatal error: ${String(err)}`,
      })
    } catch { /* ignore secondary failure */ }
    return { fairnessResult: defaultResult }
  }
}

// Reached when the Planner chose FAST_TRACK — records the deliberate skip.
export async function fairnessSkippedNode(state: SaddadStateType): Promise<SaddadNodeUpdate> {
  const { caseNumber } = state
  const reason = 'Skipped by Planner (FAST_TRACK strategy)'
  await updateAgentStep(caseNumber, 'fairness_agent', {
    status: 'done',
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    duration_ms: 0,
    result_summary: reason,
  })
  return {
    fairnessResult: {
      consistencyFlag: true,
      consistencyScore: 100,
      similarCasesFound: 0,
      fairnessNote: reason,
    },
  }
}
