// Core domain types for Anton Rx

export interface Drug {
  id: string
  name: string
  genericName: string
  therapeuticArea: string
  drugCategory: string
}

export interface PayerPolicy {
  payerId: string
  payerName: string
  drugId: string
  covered: boolean
  accessStatus: 'preferred' | 'non-preferred' | 'specialty'
  preferredCount: number
  coveredIndications: string[]
  priorAuth: boolean
  priorAuthDetails: string
  stepTherapy: boolean
  stepTherapyDetails: string
  siteOfCare: string[]
  dosingLimits: string
  coverageCriteria: string[]
  effectiveDate: string
  lastUpdated: string
  confidence: 'high' | 'medium' | 'low'
}

export type ProcessingStepStatus = 'pending' | 'active' | 'complete'

export interface PartialResult {
  type: 'payer-chips' | 'extracted-fields' | 'skeleton-table' | 'summary-preview'
  data: unknown
}

export interface ProcessingStep {
  id: string
  label: string
  status: ProcessingStepStatus
  duration: number
  partialResult?: PartialResult
  ghostSection?: 'payers' | 'cards' | 'comparison' | 'insights' | 'summary'
}

export type AIThinkingStage = 'understanding' | 'identifying' | 'detecting' | 'complete'

export interface AIThinking {
  stage: AIThinkingStage
  parsedIntent: {
    drug: string
    action: string
    entities: string[]
  }
  messages: string[]
}

export interface ProcessingStats {
  policiesAnalyzed: number
  processingTimeMs: number
  startTime: number
}

export type InsightIcon = 'info' | 'warning' | 'tip'
export type ImpactLevel = 'high' | 'medium' | 'low'
export type ConfidenceLevel = 'high' | 'medium' | 'low'

export interface Insight {
  id: string
  icon: InsightIcon
  text: string
  impact: ImpactLevel
  confidence: ConfidenceLevel
  whyItMatters?: string
}

export interface ComparisonResult {
  drug: Drug
  policies: PayerPolicy[]
  aiSummary: string
  insights: Insight[]
  lastUpdated: string
  confidence: ConfidenceLevel
  stats: ProcessingStats
}

// Ghost preview states
export interface GhostState {
  payers: boolean
  cards: boolean
  comparison: boolean
  insights: boolean
  summary: boolean
}
