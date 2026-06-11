// ============================================================================
// MOE Strategist – Full Database Types (aligned with schema.sql)
// ============================================================================

// -- Enums --------------------------------------------------------------------

export type UserRole         = 'analyst' | 'minister' | 'admin' | 'viewer'
export type LanguagePref     = 'en' | 'ar'
export type AgreementType    = 'MOU' | 'Treaty' | 'Framework' | 'JointDeclaration' | 'CEPA' | 'DefenceAgreement' | 'EnergyPact' | 'Other'
export type AgreementStatus  = 'active' | 'expired' | 'under_negotiation' | 'suspended'
export type DocumentType     = 'briefing' | 'report' | 'transcript' | 'press_release' | 'policy' | 'agreement' | 'research' | 'other'
export type Classification   = 'public' | 'internal' | 'confidential' | 'restricted'
export type IntelCapability  = 'profile' | 'insights' | 'briefing' | 'search' | 'predict' | 'comparison'
export type IntelPhase       = 'alert' | 'urgent' | 'standard' | 'research'
export type LiveSource       = 'mock' | 'worldbank' | 'imf' | 'bloomberg'
export type SessionType      = 'scenario' | 'economic' | 'meeting' | 'upload'
export type SessionStatus    = 'pending' | 'processing' | 'complete' | 'error'

// -- Table Row Types -----------------------------------------------------------

export interface UserProfile {
  id:             string
  auth_user_id:   string | null
  email:          string
  full_name:      string | null
  role:           UserRole
  ministry_dept:  string | null
  avatar_url:     string | null
  language_pref:  LanguagePref
  created_at:     string
  updated_at:     string
}

export interface Country {
  id:                   string
  code:                 string
  code_2:               string
  name:                 string
  name_ar:              string | null
  flag_emoji:           string | null
  region:               string | null
  sub_region:           string | null
  energy_minister:      string | null
  energy_minister_ar:   string | null
  primary_energy:       string | null
  net_zero_target:      number | null
  credit_rating:        string | null
  is_active:            boolean
  created_at:           string
  updated_at:           string
}

export interface CountryMetrics {
  id:                       string
  country_id:               string
  metric_year:              number
  gdp_usd_billions:         number | null
  gdp_growth_pct:           number | null
  inflation_rate_pct:       number | null
  unemployment_rate_pct:    number | null
  trade_uae_usd_billions:   number | null
  fdi_inflows_usd_billions: number | null
  renewable_energy_pct:     number | null
  co2_emissions_mt:         number | null
  population_millions:      number | null
  source:                   string
  created_at:               string
}

export interface BilateralAgreement {
  id:             string
  country_id:     string
  title:          string
  title_ar:       string | null
  agreement_type: AgreementType
  signed_date:    string | null
  expiry_date:    string | null
  status:         AgreementStatus
  key_sectors:    string[] | null
  summary:        string | null
  full_text:      string | null
  source_url:     string | null
  created_at:     string
  updated_at:     string
}

export interface MinistryDocument {
  id:             string
  uploaded_by:    string | null
  country_id:     string | null
  document_name:  string
  document_type:  DocumentType
  content_text:   string | null
  file_url:       string | null
  language:       LanguagePref | 'both'
  classification: Classification
  metadata:       Record<string, unknown>
  is_embedded:    boolean
  created_at:     string
  updated_at:     string
}

export interface DocumentEmbedding {
  id:           string
  document_id:  string
  chunk_index:  number
  chunk_text:   string
  embedding:    number[]
  token_count:  number | null
  created_at:   string
}

export interface IntelligenceSession {
  id:                string
  user_email:        string | null
  capability:        IntelCapability
  phase:             IntelPhase
  language:          LanguagePref
  country_code:      string | null
  country_code_2:    string | null
  query_text:        string | null
  response_sections: Record<string, unknown> | null
  agent_log:         string[] | null
  tokens_used:       number | null
  latency_ms:        number | null
  groq_model:        string | null
  rag_chunks_used:   number
  created_at:        string
}

export interface LiveMetricsTick {
  id:             string
  country_id:     string | null
  ts:             string
  seq:            number | null
  gdp_raw:        number | null
  gdp_ema:        number | null
  trade_vol:      number | null
  inflation:      number | null
  sustain_score:  number | null
  cagr_1yr:       number | null
  latency_ms:     number | null
  source:         LiveSource
}

export interface MatchDocumentsRow {
  chunk_id:       string
  document_id:    string
  document_name:  string
  document_type:  DocumentType
  country_code:   string | null
  chunk_index:    number
  chunk_text:     string
  similarity:     number
}

export interface CountryContextResult {
  country_code: string
  metrics:      Partial<CountryMetrics>
  agreements:   Array<Partial<BilateralAgreement>>
  rag_chunks:   MatchDocumentsRow[]
  error?:       string
}

export interface SessionStats {
  total_sessions:  number
  top_country:     string | null
  top_capability:  string | null
  avg_latency_ms:  number | null
  total_tokens:    number | null
  rag_chunks_used: number | null
}

export interface Database {
  public: {
    Tables: {
      user_profiles:        { Row: UserProfile;         Insert: Omit<UserProfile, 'id'|'created_at'|'updated_at'>;         Update: Partial<Omit<UserProfile, 'id'|'created_at'>> }
      countries:            { Row: Country;             Insert: Omit<Country, 'id'|'created_at'|'updated_at'>;             Update: Partial<Omit<Country, 'id'|'created_at'>> }
      country_metrics:      { Row: CountryMetrics;      Insert: Omit<CountryMetrics, 'id'|'created_at'>;                   Update: Partial<Omit<CountryMetrics, 'id'|'created_at'>> }
      bilateral_agreements: { Row: BilateralAgreement;  Insert: Omit<BilateralAgreement, 'id'|'created_at'|'updated_at'>; Update: Partial<Omit<BilateralAgreement, 'id'|'created_at'>> }
      ministry_documents:   { Row: MinistryDocument;    Insert: Omit<MinistryDocument, 'id'|'created_at'|'updated_at'>;   Update: Partial<Omit<MinistryDocument, 'id'|'created_at'>> }
      document_embeddings:  { Row: DocumentEmbedding;   Insert: Omit<DocumentEmbedding, 'id'|'created_at'>;               Update: Partial<Omit<DocumentEmbedding, 'id'>> }
      intelligence_sessions:{ Row: IntelligenceSession; Insert: Omit<IntelligenceSession, 'id'|'created_at'>;             Update: Partial<Omit<IntelligenceSession, 'id'|'created_at'>> }
      live_metrics_cache:   { Row: LiveMetricsTick;     Insert: Omit<LiveMetricsTick, 'id'>;                              Update: Partial<Omit<LiveMetricsTick, 'id'>> }
      processing_sessions:  { Row: ProcessingSession;   Insert: Omit<ProcessingSession, 'id'|'created_at'|'updated_at'>;  Update: Partial<Omit<ProcessingSession, 'id'|'created_at'>> }
    }
    Functions: {
      match_documents:       { Args: { query_embedding: number[]; match_count?: number; filter_country?: string|null; filter_doc_type?: string|null; min_similarity?: number }; Returns: MatchDocumentsRow[] }
      get_country_context:   { Args: { p_country_code: string; query_embedding?: number[]|null; doc_chunk_count?: number }; Returns: CountryContextResult }
      upsert_live_tick:      { Args: { p_country_code: string; p_seq: number; p_gdp_raw: number; p_gdp_ema: number; p_trade_vol: number; p_inflation: number; p_sustain: number; p_cagr: number; p_latency_ms: number; p_source?: string }; Returns: string }
      get_session_stats:     { Args: { p_user_email: string; p_days?: number }; Returns: SessionStats }
    }
  }
}

// -- Legacy types (backward compatibility) ------------------------------------

export interface ProcessingSession {
  id:           string
  user_email:   string | null
  session_type: SessionType
  status:       SessionStatus
  created_at:   string
  updated_at:   string
}

export interface ProcessingResult {
  id:          string
  session_id:  string
  result_type: string
  result_data: Record<string, unknown>
  created_at:  string
}

export interface ScenarioFormData {
  tradeVolumes:              string
  gdpGrowthRates:            string
  infrastructureInvestments: string
  newsArticles:              string
  pressReleases:             string
  diplomaticTranscripts:     string
  policyAnnouncements:       string
}

export interface EconomicFormData {
  country:       string
  yearFrom:      string
  yearTo:        string
  gdp:           string
  tradeBalance:  string
  inflationRate: string
  fdiInflows:    string
}

export interface MeetingFormData {
  meetingDate:        string
  meetingTime:        string
  attendees:          Array<{ name: string; organization: string }>
  countryOfInterest:  string
  bilateralSummaries: string
}

export type InputData =
  | { type: 'scenario'; data: ScenarioFormData }
  | { type: 'economic'; data: EconomicFormData }
  | { type: 'meeting';  data: MeetingFormData }
  | { type: 'upload';   data: { fileName: string; extractedText: string } }
  | null
