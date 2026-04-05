// API client for Anton Rx backend
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api'

export interface ApiPolicy {
  id: string
  drug_id: string
  drug_name: string
  generic_name: string
  drug_category: string
  therapeutic_area: string
  payer_id: string
  payer_name: string
  policy_title: string
  covered: boolean | null
  access_status: string
  preferred_count: number
  covered_indications: string[]
  prior_auth: boolean | null
  prior_auth_details: string
  step_therapy: boolean | null
  step_therapy_details: string
  site_of_care: string[]
  dosing_limits: string
  coverage_criteria: string[]
  hcpcs_code: string | null
  effective_date: string
  last_updated: string
  confidence: string
  version: number
  document_id: string | null
}

export interface ApiDrug {
  id: string
  name: string
  generic_name: string
  therapeutic_area: string
  drug_category: string
}

export interface ApiComparisonResponse {
  drug: ApiDrug
  payers: Array<{
    payer_id: string
    payer_name: string
    policy: ApiPolicy | null
  }>
}

export interface ApiAskResponse {
  question: string
  answer: string
  sources: Array<{
    text: string
    score: number
    payer_id?: string
    drug_id?: string
    policy_id?: string
    source_url?: string
  }>
  relevant_policies: ApiPolicy[]
}

// Convert snake_case API response to camelCase frontend types
import type { Drug, PayerPolicy, ComparisonResult, Insight } from './types'

function toDrug(api: ApiDrug): Drug {
  return {
    id: api.id,
    name: api.name,
    genericName: api.generic_name,
    therapeuticArea: api.therapeutic_area,
    drugCategory: api.drug_category,
  }
}

function toPayerPolicy(api: ApiPolicy): PayerPolicy {
  return {
    payerId: api.payer_id,
    payerName: api.payer_name,
    drugId: api.drug_id,
    covered: api.covered ?? true,
    accessStatus: (api.access_status as PayerPolicy['accessStatus']) || 'specialty',
    preferredCount: api.preferred_count ?? 0,
    coveredIndications: api.covered_indications ?? [],
    priorAuth: api.prior_auth ?? false,
    priorAuthDetails: api.prior_auth_details ?? '',
    stepTherapy: api.step_therapy ?? false,
    stepTherapyDetails: api.step_therapy_details ?? '',
    siteOfCare: api.site_of_care ?? [],
    dosingLimits: api.dosing_limits ?? '',
    coverageCriteria: api.coverage_criteria ?? [],
    effectiveDate: api.effective_date ?? '',
    lastUpdated: api.last_updated ?? '',
    confidence: (api.confidence as PayerPolicy['confidence']) || 'medium',
  }
}

function generateInsights(policies: PayerPolicy[]): Insight[] {
  const insights: Insight[] = []

  const paCnt = policies.filter(p => p.priorAuth).length
  if (paCnt > 0 && paCnt < policies.length) {
    insights.push({
      id: 'pa-split',
      icon: 'warning',
      text: `${paCnt} of ${policies.length} payers require prior authorization`,
      impact: 'high',
      confidence: 'high',
    })
  }

  const stCnt = policies.filter(p => p.stepTherapy).length
  if (stCnt > 0) {
    insights.push({
      id: 'st-present',
      icon: 'warning',
      text: `${stCnt} payer${stCnt > 1 ? 's' : ''} require step therapy — check first-line requirements`,
      impact: 'high',
      confidence: 'high',
    })
  }

  const notCovered = policies.filter(p => !p.covered)
  if (notCovered.length > 0) {
    insights.push({
      id: 'not-covered',
      icon: 'warning',
      text: `Not covered by ${notCovered.map(p => p.payerName).join(', ')}`,
      impact: 'high',
      confidence: 'high',
    })
  }

  if (insights.length === 0) {
    insights.push({
      id: 'all-clear',
      icon: 'tip',
      text: 'No major access barriers detected across compared payers',
      impact: 'low',
      confidence: 'high',
    })
  }

  insights.push({
    id: 'count',
    icon: 'info',
    text: `Analyzed ${policies.length} payer policies from real policy documents`,
    impact: 'medium',
    confidence: 'high',
  })

  return insights
}

function generateSummary(drug: Drug, policies: PayerPolicy[]): string {
  const stPayers = policies.filter(p => p.stepTherapy).map(p => p.payerName)
  const noStPayers = policies.filter(p => !p.stepTherapy).map(p => p.payerName)

  if (stPayers.length > 0 && noStPayers.length > 0) {
    return `${stPayers.join(' and ')} require${stPayers.length === 1 ? 's' : ''} step therapy for ${drug.name}, while ${noStPayers.join(' and ')} do${noStPayers.length === 1 ? 'es' : ''} not.`
  } else if (stPayers.length > 0) {
    return `All compared payers require step therapy for ${drug.name}.`
  }
  return `None of the compared payers require step therapy for ${drug.name}.`
}

// ---------- API calls ----------

export async function fetchComparison(drugId: string, startTime: number): Promise<ComparisonResult> {
  const res = await fetch(`${API_BASE}/comparison/${drugId}`)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  const data: ApiComparisonResponse = await res.json()

  const drug = toDrug(data.drug)
  const policies = data.payers
    .filter(p => p.policy !== null)
    .map(p => toPayerPolicy(p.policy!))

  return {
    drug,
    policies,
    aiSummary: generateSummary(drug, policies),
    insights: generateInsights(policies),
    lastUpdated: new Date().toISOString(),
    confidence: 'high',
    stats: {
      policiesAnalyzed: policies.length * 4,
      processingTimeMs: Date.now() - startTime,
      startTime,
    },
  }
}

// ---------- Ask (with client-side cache) ----------

const _askCache = new Map<string, { ts: number; data: ApiAskResponse }>()
const ASK_CACHE_TTL = 10 * 60 * 1000 // 10 minutes

export async function askQuestion(question: string): Promise<ApiAskResponse> {
  const key = question.trim().toLowerCase()
  const cached = _askCache.get(key)
  if (cached && Date.now() - cached.ts < ASK_CACHE_TTL) {
    return cached.data
  }

  const res = await fetch(`${API_BASE}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  const data: ApiAskResponse = await res.json()

  _askCache.set(key, { ts: Date.now(), data })
  return data
}

export async function fetchDrugs(): Promise<Drug[]> {
  const res = await fetch(`${API_BASE}/drugs`)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  const data: ApiDrug[] = await res.json()
  return data.map(toDrug)
}

// ---------- Version History ----------

export interface PolicyVersionRecord {
  id: string
  policy_id: string
  version: number
  data: Record<string, unknown>
  change_summary: string | null
  created_at: string
}

export async function fetchPolicyVersions(policyId: string): Promise<PolicyVersionRecord[]> {
  const res = await fetch(`${API_BASE}/policies/${encodeURIComponent(policyId)}/versions`)
  if (!res.ok) return []
  return res.json()
}

// ---------- Matrix ----------

export interface MatrixCell {
  policy: ApiPolicy | null
  has_data: boolean
}

export interface MatrixPayer {
  payer_id: string
  payer_name: string
}

export interface MatrixDrug {
  drug_id: string
  drug_name: string
}

export interface MatrixRow {
  drug: MatrixDrug
  cells: Record<string, MatrixCell>
}

export interface MatrixResponse {
  payers: MatrixPayer[]
  drugs: MatrixDrug[]
  rows: MatrixRow[]
  total_policies: number
}

export async function fetchMatrix(): Promise<MatrixResponse> {
  const res = await fetch(`${API_BASE}/matrix`)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}
