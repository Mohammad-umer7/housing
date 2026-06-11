import { supabase as supabaseClient } from './supabase'
const supabase = supabaseClient as any
import type { ScenarioFormData, EconomicFormData, MeetingFormData, ProcessingSession } from '@/types/database'

type SessionType = 'scenario' | 'economic' | 'meeting' | 'upload'

// ---- Session ----------------------------------------------------------------

export async function createSession(
  userEmail: string,
  sessionType: SessionType
): Promise<{ data: ProcessingSession | null; error: string | null }> {
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  const { data, error } = await supabase
    .from('processing_sessions')
    .insert({ user_email: userEmail, session_type: sessionType, status: 'processing' })
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  return { data: data as ProcessingSession, error: null }
}

export async function updateSessionStatus(
  sessionId: string,
  status: ProcessingSession['status']
): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase not configured' }

  const { error } = await supabase
    .from('processing_sessions')
    .update({ status })
    .eq('id', sessionId)

  return { error: error?.message ?? null }
}

// ---- Scenario Input ---------------------------------------------------------

export async function saveScenarioInput(
  sessionId: string,
  form: ScenarioFormData
): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase not configured' }

  const parseTimeSeries = (raw: string): Record<string, number> => {
    const result: Record<string, number> = {}
    raw.split('\n').forEach((line) => {
      const parts = line.split(/[,\t]/)
      if (parts.length >= 2) {
        const key = parts[0].trim()
        const val = parseFloat(parts[1].trim())
        if (key && !isNaN(val)) result[key] = val
      }
    })
    return result
  }

  const { error } = await supabase.from('scenario_inputs').insert({
    session_id: sessionId,
    trade_volumes: parseTimeSeries(form.tradeVolumes),
    gdp_growth_rates: parseTimeSeries(form.gdpGrowthRates),
    infrastructure_investments: parseTimeSeries(form.infrastructureInvestments),
    news_articles: form.newsArticles || null,
    press_releases: form.pressReleases || null,
    diplomatic_transcripts: form.diplomaticTranscripts || null,
    policy_announcements: form.policyAnnouncements || null,
  })

  return { error: error?.message ?? null }
}

// ---- Economic Input ---------------------------------------------------------

export async function saveEconomicInput(
  sessionId: string,
  form: EconomicFormData
): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase not configured' }

  const { error } = await supabase.from('processing_results').insert({
    session_id: sessionId,
    result_type: 'economic_input',
    result_data: {
      country: form.country,
      year_from: form.yearFrom,
      year_to: form.yearTo,
      gdp_usd: form.gdp,
      trade_balance: form.tradeBalance,
      inflation_rate: form.inflationRate,
      fdi_inflows: form.fdiInflows,
    },
  })

  return { error: error?.message ?? null }
}

// ---- Meeting Data -----------------------------------------------------------

export async function saveMeetingData(
  sessionId: string | null,
  form: MeetingFormData
): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase not configured' }

  const { error } = await supabase.from('meeting_concierge').insert({
    session_id: sessionId,
    meeting_date: form.meetingDate || null,
    meeting_time: form.meetingTime || null,
    attendees: form.attendees,
    country_of_interest: form.countryOfInterest || null,
    bilateral_summaries: form.bilateralSummaries || null,
  })

  return { error: error?.message ?? null }
}

// ---- Results ----------------------------------------------------------------

export async function saveResults(
  sessionId: string,
  resultType: string,
  resultData: Record<string, unknown>
): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase not configured' }

  const { error } = await supabase.from('processing_results').insert({
    session_id: sessionId,
    result_type: resultType,
    result_data: resultData,
  })

  return { error: error?.message ?? null }
}

// ---- Read meetings ----------------------------------------------------------

export async function fetchMeetings(): Promise<{
  data: Array<{
    id: string
    meeting_date: string | null
    meeting_time: string | null
    country_of_interest: string | null
    attendees: Array<{ name: string; organization: string }> | null
    bilateral_summaries: string | null
    created_at: string
  }>
  error: string | null
}> {
  if (!supabase) return { data: [], error: 'Supabase not configured' }

  const { data, error } = await supabase
    .from('meeting_concierge')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return { data: [], error: error.message }
  return { data: (data as never[]) ?? [], error: null }
}
