import type { Drug, PayerPolicy, Insight, ProcessingStep } from './types'

// Sample drugs
export const drugs: Drug[] = [
  {
    id: 'rituximab',
    name: 'Rituximab',
    genericName: 'rituximab',
    therapeuticArea: 'Oncology / Autoimmune',
    drugCategory: 'Anti-CD20 Monoclonal Antibody',
  },
  {
    id: 'humira',
    name: 'Humira',
    genericName: 'adalimumab',
    therapeuticArea: 'Autoimmune / Rheumatology',
    drugCategory: 'TNF Inhibitor',
  },
  {
    id: 'bevacizumab',
    name: 'Bevacizumab',
    genericName: 'bevacizumab',
    therapeuticArea: 'Oncology',
    drugCategory: 'Anti-VEGF Monoclonal Antibody',
  },
]

// Sample payer policies
export const payerPolicies: PayerPolicy[] = [
  // Rituximab policies
  {
    payerId: 'cigna',
    payerName: 'Cigna',
    drugId: 'rituximab',
    covered: true,
    accessStatus: 'specialty',
    preferredCount: 2,
    coveredIndications: ['Non-Hodgkin Lymphoma (NHL)', 'Chronic Lymphocytic Leukemia (CLL)', 'Rheumatoid Arthritis', 'Granulomatosis with Polyangiitis (GPA)'],
    priorAuth: true,
    priorAuthDetails: 'Required for all indications. Clinical documentation must include diagnosis, prior therapies tried, and lab results.',
    stepTherapy: true,
    stepTherapyDetails: 'Must try methotrexate or another conventional DMARD for 12 weeks before approval.',
    siteOfCare: ['Hospital Outpatient', 'Infusion Center'],
    dosingLimits: '375 mg/m² IV, max 8 cycles per 12 months',
    coverageCriteria: [
      'FDA-approved indication',
      'Failed or intolerant to first-line therapy',
      'Documentation of disease severity',
    ],
    effectiveDate: '2024-01-01',
    lastUpdated: '2024-04-02',
    confidence: 'high',
  },
  {
    payerId: 'uhc',
    payerName: 'UnitedHealthcare',
    drugId: 'rituximab',
    covered: true,
    accessStatus: 'preferred',
    preferredCount: 1,
    coveredIndications: ['Non-Hodgkin Lymphoma (NHL)', 'Chronic Lymphocytic Leukemia (CLL)', 'Rheumatoid Arthritis', 'GPA', 'MPA', 'Pemphigus Vulgaris'],
    priorAuth: true,
    priorAuthDetails: 'Required. Can be submitted online via CoverMyMeds or fax.',
    stepTherapy: false,
    stepTherapyDetails: 'No step therapy required for oncology indications.',
    siteOfCare: ['Hospital Outpatient', 'Infusion Center', 'Home Infusion'],
    dosingLimits: '375 mg/m² IV, no annual cycle limit',
    coverageCriteria: [
      'FDA-approved indication',
      'Diagnosis confirmation',
      'Body weight for dosing',
    ],
    effectiveDate: '2024-01-15',
    lastUpdated: '2024-04-01',
    confidence: 'high',
  },
  {
    payerId: 'bcbs',
    payerName: 'Blue Cross Blue Shield',
    drugId: 'rituximab',
    covered: true,
    accessStatus: 'non-preferred',
    preferredCount: 3,
    coveredIndications: ['Non-Hodgkin Lymphoma (NHL)', 'CLL', 'Rheumatoid Arthritis'],
    priorAuth: true,
    priorAuthDetails: 'Prior authorization required within 30 days of treatment initiation.',
    stepTherapy: true,
    stepTherapyDetails: 'Step therapy applies to autoimmune indications only. Not required for oncology.',
    siteOfCare: ['Hospital Outpatient', 'Infusion Center'],
    dosingLimits: '375 mg/m² IV, max 6 cycles per 12 months',
    coverageCriteria: [
      'FDA-approved indication or compendia support',
      'Medical necessity documentation',
      'Treatment plan from specialist',
    ],
    effectiveDate: '2024-02-01',
    lastUpdated: '2024-03-28',
    confidence: 'medium',
  },
  // Humira policies
  {
    payerId: 'cigna',
    payerName: 'Cigna',
    drugId: 'humira',
    covered: false,
    accessStatus: 'non-preferred',
    preferredCount: 4,
    coveredIndications: [],
    priorAuth: false,
    priorAuthDetails: 'Drug is not covered under this plan. Biosimilar alternatives are preferred.',
    stepTherapy: false,
    stepTherapyDetails: 'N/A — drug is not covered.',
    siteOfCare: [],
    dosingLimits: 'N/A',
    coverageCriteria: [
      'Drug is explicitly excluded from coverage',
      'Biosimilar adalimumab alternatives are available',
    ],
    effectiveDate: '2024-01-01',
    lastUpdated: '2024-03-15',
    confidence: 'high',
  },
  {
    payerId: 'uhc',
    payerName: 'UnitedHealthcare',
    drugId: 'humira',
    covered: true,
    accessStatus: 'preferred',
    preferredCount: 1,
    coveredIndications: ['Rheumatoid Arthritis', 'Psoriatic Arthritis', 'Crohn\'s Disease', 'Ulcerative Colitis', 'Plaque Psoriasis', 'Hidradenitis Suppurativa', 'Uveitis'],
    priorAuth: true,
    priorAuthDetails: 'Prior authorization through OptumRx.',
    stepTherapy: false,
    stepTherapyDetails: 'Preferred biologic - no step therapy required.',
    siteOfCare: ['Self-Administration', 'Physician Office', 'Home Health'],
    dosingLimits: '40 mg SC every other week, no annual limit',
    coverageCriteria: [
      'FDA-approved indication',
      'Documented diagnosis',
      'No active infections',
    ],
    effectiveDate: '2024-01-01',
    lastUpdated: '2024-04-02',
    confidence: 'high',
  },
  {
    payerId: 'bcbs',
    payerName: 'Blue Cross Blue Shield',
    drugId: 'humira',
    covered: true,
    accessStatus: 'non-preferred',
    preferredCount: 3,
    coveredIndications: ['Rheumatoid Arthritis', 'Psoriatic Arthritis', 'Crohn\'s Disease', 'Plaque Psoriasis'],
    priorAuth: true,
    priorAuthDetails: 'Authorization valid for 12 months with renewal option.',
    stepTherapy: true,
    stepTherapyDetails: 'Requires trial of biosimilar adalimumab first.',
    siteOfCare: ['Self-Administration', 'Physician Office'],
    dosingLimits: '40 mg SC every other week, max 26 doses/year',
    coverageCriteria: [
      'FDA-approved indication',
      'Trial of biosimilar unless contraindicated',
      'Specialist confirmation',
    ],
    effectiveDate: '2024-02-15',
    lastUpdated: '2024-03-20',
    confidence: 'high',
  },
  // Bevacizumab policies
  {
    payerId: 'cigna',
    payerName: 'Cigna',
    drugId: 'bevacizumab',
    covered: true,
    accessStatus: 'preferred',
    preferredCount: 1,
    coveredIndications: ['Colorectal Cancer', 'Non-Small Cell Lung Cancer', 'Glioblastoma', 'Renal Cell Carcinoma', 'Cervical Cancer'],
    priorAuth: true,
    priorAuthDetails: 'Required for all oncology indications. Must include NCCN-supported use documentation.',
    stepTherapy: false,
    stepTherapyDetails: 'No step therapy for NCCN-supported oncology indications.',
    siteOfCare: ['Hospital Outpatient', 'Infusion Center'],
    dosingLimits: '5-15 mg/kg IV every 2-3 weeks per NCCN protocol',
    coverageCriteria: [
      'NCCN-supported indication',
      'Oncologist treatment plan',
      'Body weight and dosing protocol',
    ],
    effectiveDate: '2025-10-01',
    lastUpdated: '2026-02-28',
    confidence: 'high',
  },
  {
    payerId: 'uhc',
    payerName: 'UnitedHealthcare',
    drugId: 'bevacizumab',
    covered: true,
    accessStatus: 'preferred',
    preferredCount: 1,
    coveredIndications: ['Colorectal Cancer', 'NSCLC', 'Glioblastoma', 'Renal Cell Carcinoma', 'Cervical Cancer', 'Ovarian Cancer'],
    priorAuth: true,
    priorAuthDetails: 'Online submission via CoverMyMeds. Expedited review available for urgent cases.',
    stepTherapy: false,
    stepTherapyDetails: 'No step therapy required — first-line access for approved indications.',
    siteOfCare: ['Hospital Outpatient', 'Infusion Center', 'Home Infusion'],
    dosingLimits: '5-15 mg/kg IV per NCCN, no cycle cap',
    coverageCriteria: [
      'FDA-approved or NCCN-supported indication',
      'Diagnosis confirmation by oncologist',
      'Treatment protocol documentation',
    ],
    effectiveDate: '2025-11-01',
    lastUpdated: '2026-03-15',
    confidence: 'high',
  },
]

// Processing steps configuration
export const processingSteps: ProcessingStep[] = [
  { id: 'find', label: 'Finding relevant policies', status: 'pending', duration: 1800, ghostSection: undefined },
  { id: 'fetch', label: 'Fetching payer documents', status: 'pending', duration: 1400, ghostSection: 'payers' },
  { id: 'extract', label: 'Extracting criteria', status: 'pending', duration: 1800, ghostSection: 'cards' },
  { id: 'normalize', label: 'Normalizing data', status: 'pending', duration: 900, ghostSection: undefined },
  { id: 'rag', label: 'Running RAG retrieval', status: 'pending', duration: 1300, ghostSection: 'comparison' },
  { id: 'build', label: 'Building comparison', status: 'pending', duration: 1700, ghostSection: 'comparison' },
  { id: 'generate', label: 'Generating insights', status: 'pending', duration: 1400, ghostSection: 'summary' },
]

// Sample insights for Rituximab comparison
export const rituximabInsights: Insight[] = [
  {
    id: '1',
    icon: 'warning',
    text: 'Cigna requires step therapy, which may delay treatment by 2-4 weeks',
    impact: 'high',
    confidence: 'high',
    whyItMatters: 'Patients must try methotrexate first before Rituximab approval, adding 12 weeks to the treatment timeline for autoimmune conditions.',
  },
  {
    id: '2',
    icon: 'info',
    text: 'UnitedHealthcare offers the broadest site-of-care options including home infusion',
    impact: 'medium',
    confidence: 'high',
    whyItMatters: 'Home infusion can significantly improve patient convenience and reduce treatment burden, especially for chronic conditions.',
  },
  {
    id: '3',
    icon: 'tip',
    text: 'Consider UHC for faster approval if step therapy is a barrier',
    impact: 'high',
    confidence: 'medium',
    whyItMatters: 'For patients who have contraindications to first-line therapies, UHC\'s policy allows direct access to Rituximab without delays.',
  },
  {
    id: '4',
    icon: 'info',
    text: 'All three payers require prior authorization',
    impact: 'low',
    confidence: 'high',
  },
  {
    id: '5',
    icon: 'warning',
    text: 'BCBS has medium confidence rating - verify current policy before submission',
    impact: 'medium',
    confidence: 'medium',
    whyItMatters: 'Policy documents may have been updated recently. Recommend calling payer directly to confirm requirements.',
  },
]

// AI thinking messages progression
export const aiThinkingMessages = {
  understanding: 'Analyzing your question...',
  identifying: 'Identified intent: Policy Comparison',
  detecting: 'Detected entities: Drug, Payers',
  complete: 'Ready to show results',
}

// Query suggestions for landing page
export const querySuggestions = [
  'Compare Rituximab across payers',
  'Does Cigna cover Humira?',
  'What changed in Bevacizumab policies?',
  'Prior auth requirements for biologics',
]

// Parse query to extract drug and intent
export function parseQuery(query: string): { drug: string; action: string; entities: string[] } {
  const queryLower = query.toLowerCase()
  
  let drug = 'Unknown drug'
  let action = 'General inquiry'
  const entities: string[] = []
  
  // Detect drug
  if (queryLower.includes('rituximab')) {
    drug = 'Rituximab'
    entities.push('Rituximab')
  } else if (queryLower.includes('humira') || queryLower.includes('adalimumab')) {
    drug = 'Humira'
    entities.push('Humira')
  } else if (queryLower.includes('bevacizumab')) {
    drug = 'Bevacizumab'
    entities.push('Bevacizumab')
  }
  
  // Detect action/intent
  if (queryLower.includes('compare') || queryLower.includes('across')) {
    action = 'Compare across payers'
    entities.push('Multiple Payers')
  } else if (queryLower.includes('cover') || queryLower.includes('coverage')) {
    action = 'Check coverage'
  } else if (queryLower.includes('change') || queryLower.includes('update')) {
    action = 'Track policy changes'
  } else if (queryLower.includes('prior auth')) {
    action = 'Check prior authorization'
  }
  
  // Detect specific payers mentioned
  if (queryLower.includes('cigna')) entities.push('Cigna')
  if (queryLower.includes('uhc') || queryLower.includes('united')) entities.push('UnitedHealthcare')
  if (queryLower.includes('bcbs') || queryLower.includes('blue cross')) entities.push('BCBS')
  
  if (entities.length === 0) {
    entities.push('All major payers')
  }
  
  return { drug, action, entities }
}

// Get policies for a specific drug
export function getPoliciesForDrug(drugId: string): PayerPolicy[] {
  return payerPolicies.filter(p => p.drugId === drugId)
}

// Get drug by ID
export function getDrugById(drugId: string): Drug | undefined {
  return drugs.find(d => d.id === drugId)
}

// Generate comparison result for a drug
export function generateComparisonResult(drugId: string, startTime: number): import('./types').ComparisonResult {
  const drug = getDrugById(drugId)
  const policies = getPoliciesForDrug(drugId)
  
  if (!drug) {
    throw new Error(`Drug not found: ${drugId}`)
  }
  
  const endTime = Date.now()
  
  return {
    drug,
    policies,
    aiSummary: generateAISummary(drug, policies),
    insights: drugId === 'rituximab' ? rituximabInsights : generateGenericInsights(policies),
    lastUpdated: new Date().toISOString(),
    confidence: 'high',
    stats: {
      policiesAnalyzed: policies.length * 4, // simulating multiple documents per payer
      processingTimeMs: endTime - startTime,
      startTime,
    },
  }
}

function generateAISummary(drug: Drug, policies: PayerPolicy[]): string {
  const stepTherapyPayers = policies.filter(p => p.stepTherapy).map(p => p.payerName)
  const noStepTherapyPayers = policies.filter(p => !p.stepTherapy).map(p => p.payerName)
  
  if (stepTherapyPayers.length > 0 && noStepTherapyPayers.length > 0) {
    return `${stepTherapyPayers.join(' and ')} require${stepTherapyPayers.length === 1 ? 's' : ''} step therapy for ${drug.name}, while ${noStepTherapyPayers.join(' and ')} do${noStepTherapyPayers.length === 1 ? 'es' : ''} not.`
  } else if (stepTherapyPayers.length > 0) {
    return `All compared payers require step therapy for ${drug.name}. ${stepTherapyPayers[0]} has the most restrictive requirements.`
  } else {
    return `None of the compared payers require step therapy for ${drug.name}, though prior authorization is needed for all.`
  }
}

function generateGenericInsights(policies: PayerPolicy[]): Insight[] {
  return [
    {
      id: '1',
      icon: 'info',
      text: `Compared ${policies.length} payer policies`,
      impact: 'medium',
      confidence: 'high',
    },
    {
      id: '2',
      icon: 'tip',
      text: 'Review detailed criteria for your specific indication',
      impact: 'medium',
      confidence: 'high',
    },
  ]
}

// ===== Policy Version History (for Policy Evolution Timeline) =====

export interface PolicyChange {
  id: string
  section: string
  oldValue: string
  newValue: string
  direction: 'restrictive' | 'permissive' | 'neutral'
  impact: 'high' | 'medium' | 'low'
  aiExplanation: string
}

export interface PolicyVersion {
  id: string
  version: string
  date: string
  payerId: string
  payerName: string
  drugId: string
  drugName: string
  summary: string
  changes: PolicyChange[]
  strictnessScore: number // 0-100, higher = more restrictive
}

export const policyVersionHistory: PolicyVersion[] = [
  // Rituximab — Cigna evolution
  {
    id: 'cigna-rit-v4',
    version: 'v4.0',
    date: '2026-03-28',
    payerId: 'cigna',
    payerName: 'Cigna',
    drugId: 'rituximab',
    drugName: 'Rituximab',
    summary: 'Major restriction: step therapy duration increased, infusion center option narrowed',
    strictnessScore: 82,
    changes: [
      {
        id: 'c1',
        section: 'Step Therapy Duration',
        oldValue: 'Must try methotrexate for 8 weeks',
        newValue: 'Must try methotrexate for 12 weeks before approval',
        direction: 'restrictive',
        impact: 'high',
        aiExplanation: 'This 4-week increase means patients wait 50% longer before qualifying. For patients with aggressive disease, this delay could impact outcomes significantly.',
      },
      {
        id: 'c2',
        section: 'Site of Care',
        oldValue: 'Hospital Outpatient, Infusion Center, Ambulatory',
        newValue: 'Hospital Outpatient, Infusion Center',
        direction: 'restrictive',
        impact: 'medium',
        aiExplanation: 'Removal of ambulatory infusion reduces patient flexibility. Patients in rural areas may face longer travel times.',
      },
      {
        id: 'c3',
        section: 'Documentation Requirements',
        oldValue: 'Clinical notes and diagnosis code',
        newValue: 'Clinical notes, diagnosis code, lab results within 30 days, and specialist letter',
        direction: 'restrictive',
        impact: 'medium',
        aiExplanation: 'Additional documentation adds administrative burden. Specialist letter requirement may delay submissions by 1-2 weeks.',
      },
    ],
  },
  {
    id: 'cigna-rit-v3',
    version: 'v3.2',
    date: '2025-11-15',
    payerId: 'cigna',
    payerName: 'Cigna',
    drugId: 'rituximab',
    drugName: 'Rituximab',
    summary: 'Moderate update: biosimilar preference added, PA turnaround improved',
    strictnessScore: 68,
    changes: [
      {
        id: 'c4',
        section: 'Biosimilar Preference',
        oldValue: 'No biosimilar requirement',
        newValue: 'Biosimilar trial preferred before branded Rituximab',
        direction: 'restrictive',
        impact: 'medium',
        aiExplanation: 'Biosimilar preference is becoming industry standard. While it adds a step, biosimilars are clinically equivalent and cost-effective.',
      },
      {
        id: 'c5',
        section: 'PA Turnaround Time',
        oldValue: '10 business days',
        newValue: '5 business days for urgent, 10 for standard',
        direction: 'permissive',
        impact: 'medium',
        aiExplanation: 'New urgent review pathway cuts wait time in half for qualifying cases. Recommend using urgent pathway for active disease.',
      },
    ],
  },
  {
    id: 'cigna-rit-v2',
    version: 'v3.0',
    date: '2025-07-01',
    payerId: 'cigna',
    payerName: 'Cigna',
    drugId: 'rituximab',
    drugName: 'Rituximab',
    summary: 'Policy overhaul: new formulary tier, expanded indications',
    strictnessScore: 62,
    changes: [
      {
        id: 'c6',
        section: 'Formulary Tier',
        oldValue: 'Specialty Tier 5',
        newValue: 'Specialty Tier 4 (lower copay)',
        direction: 'permissive',
        impact: 'high',
        aiExplanation: 'Tier reduction means up to 30% lower patient cost-sharing. Significant financial relief for patients on long-term therapy.',
      },
      {
        id: 'c7',
        section: 'Approved Indications',
        oldValue: 'NHL, CLL, RA only',
        newValue: 'NHL, CLL, RA, GPA, MPA, Pemphigus Vulgaris',
        direction: 'permissive',
        impact: 'high',
        aiExplanation: 'Three new indications added. Patients with rare autoimmune conditions now have a pathway without off-label battles.',
      },
    ],
  },
  {
    id: 'cigna-rit-v1',
    version: 'v2.1',
    date: '2025-01-15',
    payerId: 'cigna',
    payerName: 'Cigna',
    drugId: 'rituximab',
    drugName: 'Rituximab',
    summary: 'Minor update: renewal criteria clarified',
    strictnessScore: 58,
    changes: [
      {
        id: 'c8',
        section: 'Renewal Criteria',
        oldValue: 'Annual re-authorization with full documentation',
        newValue: 'Annual re-authorization; abbreviated review if stable on therapy',
        direction: 'permissive',
        impact: 'low',
        aiExplanation: 'Abbreviated renewal process reduces administrative work for stable patients. Good change for long-term therapy management.',
      },
    ],
  },
  // Rituximab — UHC evolution
  {
    id: 'uhc-rit-v3',
    version: 'v2.5',
    date: '2026-03-15',
    payerId: 'uhc',
    payerName: 'UnitedHealthcare',
    drugId: 'rituximab',
    drugName: 'Rituximab',
    summary: 'Patient-friendly: home infusion expanded, documentation simplified',
    strictnessScore: 35,
    changes: [
      {
        id: 'c9',
        section: 'Home Infusion Coverage',
        oldValue: 'Home infusion after 2 successful hospital infusions',
        newValue: 'Home infusion available from first dose with nurse supervision',
        direction: 'permissive',
        impact: 'high',
        aiExplanation: 'Eliminating the 2-dose hospital requirement is a major win for patients. Reduces facility costs and improves patient convenience from day one.',
      },
      {
        id: 'c10',
        section: 'Documentation',
        oldValue: 'Full clinical workup, 3 physician letters',
        newValue: 'Standardized PA form + 1 physician attestation',
        direction: 'permissive',
        impact: 'medium',
        aiExplanation: 'Streamlined documentation cuts PA submission time from days to hours. UHC is leading the industry in PA simplification.',
      },
    ],
  },
  {
    id: 'uhc-rit-v2',
    version: 'v2.0',
    date: '2025-09-01',
    payerId: 'uhc',
    payerName: 'UnitedHealthcare',
    drugId: 'rituximab',
    drugName: 'Rituximab',
    summary: 'Step therapy removed for oncology indications',
    strictnessScore: 40,
    changes: [
      {
        id: 'c11',
        section: 'Step Therapy',
        oldValue: 'Step therapy required: trial of cyclophosphamide first',
        newValue: 'No step therapy for oncology indications',
        direction: 'permissive',
        impact: 'high',
        aiExplanation: 'Removal of step therapy for oncology is a landmark change. Patients can now access Rituximab directly, saving 8-12 weeks of trial therapy.',
      },
    ],
  },
  // Rituximab — BCBS evolution
  {
    id: 'bcbs-rit-v3',
    version: 'v3.1',
    date: '2026-02-20',
    payerId: 'bcbs',
    payerName: 'Blue Cross Blue Shield',
    drugId: 'rituximab',
    drugName: 'Rituximab',
    summary: 'New requirement: specialist treatment plan mandatory',
    strictnessScore: 65,
    changes: [
      {
        id: 'c12',
        section: 'Treatment Plan',
        oldValue: 'Physician prescription sufficient',
        newValue: 'Specialist treatment plan with milestones required',
        direction: 'restrictive',
        impact: 'medium',
        aiExplanation: 'While this adds a documentation step, milestone-based treatment plans can actually improve outcomes tracking. Recommend incorporating this into standard workflow.',
      },
      {
        id: 'c13',
        section: 'Reauthorization Period',
        oldValue: '12 months',
        newValue: '6 months for first year, then 12 months',
        direction: 'restrictive',
        impact: 'low',
        aiExplanation: 'More frequent reauthorization in year one increases admin work but normalizes after. Front-load the documentation effort.',
      },
    ],
  },
  {
    id: 'bcbs-rit-v2',
    version: 'v2.5',
    date: '2025-08-10',
    payerId: 'bcbs',
    payerName: 'Blue Cross Blue Shield',
    drugId: 'rituximab',
    drugName: 'Rituximab',
    summary: 'Positive update: expanded site-of-care, faster appeals',
    strictnessScore: 55,
    changes: [
      {
        id: 'c14',
        section: 'Appeals Process',
        oldValue: '30-day standard appeal, no expedited option',
        newValue: '30-day standard, 72-hour expedited appeal for urgent cases',
        direction: 'permissive',
        impact: 'high',
        aiExplanation: 'Expedited appeal pathway is critical for patients with rapidly progressing disease. This aligns BCBS with CMS requirements.',
      },
    ],
  },
  // Humira — Cigna evolution
  {
    id: 'cigna-hum-v2',
    version: 'v2.0',
    date: '2026-01-10',
    payerId: 'cigna',
    payerName: 'Cigna',
    drugId: 'humira',
    drugName: 'Humira',
    summary: 'Biosimilar step therapy now required',
    strictnessScore: 75,
    changes: [
      {
        id: 'c15',
        section: 'Biosimilar Requirement',
        oldValue: 'Branded Humira covered directly',
        newValue: 'Must trial biosimilar adalimumab (Hadlima/Hyrimoz) before branded Humira',
        direction: 'restrictive',
        impact: 'high',
        aiExplanation: 'Biosimilar mandates are accelerating industry-wide. While clinically equivalent, some patients may experience nocebo effects during switching.',
      },
      {
        id: 'c16',
        section: 'Prior Auth Submission',
        oldValue: 'Fax or online portal',
        newValue: 'eviCore portal only — fax submissions no longer accepted',
        direction: 'neutral',
        impact: 'low',
        aiExplanation: 'Digital-only submission standardizes the process but may challenge practices without eviCore access. Recommend getting portal credentials now.',
      },
    ],
  },
]

// Policy documents (full policies for the library view)
export interface PolicyDocument {
  id: string
  payerId: string
  payerName: string
  drugId: string
  drugName: string
  title: string
  version: string
  effectiveDate: string
  lastReviewed: string
  status: 'current' | 'superseded' | 'draft'
  pageCount: number
  sections: string[]
  keyChangesFromPrior: string
  strictnessScore: number
  analystNotes: string[]
}

export const policyDocuments: PolicyDocument[] = [
  {
    id: 'doc-cigna-rit',
    payerId: 'cigna',
    payerName: 'Cigna',
    drugId: 'rituximab',
    drugName: 'Rituximab',
    title: 'Rituximab Medical Policy — Prior Authorization & Coverage Criteria',
    version: 'v4.0',
    effectiveDate: '2026-03-28',
    lastReviewed: '2026-04-01',
    status: 'current',
    pageCount: 24,
    sections: ['Indications', 'Prior Authorization', 'Step Therapy', 'Site of Care', 'Dosing', 'Renewals', 'Appeals'],
    keyChangesFromPrior: 'Step therapy duration increased to 12 weeks; ambulatory infusion removed',
    strictnessScore: 82,
    analystNotes: [],
  },
  {
    id: 'doc-uhc-rit',
    payerId: 'uhc',
    payerName: 'UnitedHealthcare',
    drugId: 'rituximab',
    drugName: 'Rituximab',
    title: 'Rituximab Coverage Determination Guideline',
    version: 'v2.5',
    effectiveDate: '2026-03-15',
    lastReviewed: '2026-03-30',
    status: 'current',
    pageCount: 18,
    sections: ['Coverage Criteria', 'Authorization Requirements', 'Site of Care', 'Home Infusion', 'Renewals'],
    keyChangesFromPrior: 'Home infusion from first dose; simplified documentation',
    strictnessScore: 35,
    analystNotes: [],
  },
  {
    id: 'doc-bcbs-rit',
    payerId: 'bcbs',
    payerName: 'Blue Cross Blue Shield',
    drugId: 'rituximab',
    drugName: 'Rituximab',
    title: 'Medical Policy: Rituximab & Biosimilars — Authorization Requirements',
    version: 'v3.1',
    effectiveDate: '2026-02-20',
    lastReviewed: '2026-03-25',
    status: 'current',
    pageCount: 32,
    sections: ['Eligibility', 'Medical Necessity', 'Step Therapy', 'Treatment Plan', 'Appeals', 'Reauthorization', 'Appendices'],
    keyChangesFromPrior: 'Specialist treatment plan now mandatory; 6-month initial reauth',
    strictnessScore: 65,
    analystNotes: [],
  },
  {
    id: 'doc-cigna-hum',
    payerId: 'cigna',
    payerName: 'Cigna',
    drugId: 'humira',
    drugName: 'Humira',
    title: 'Humira / Adalimumab Biosimilars — Coverage Policy',
    version: 'v2.0',
    effectiveDate: '2026-01-10',
    lastReviewed: '2026-02-15',
    status: 'current',
    pageCount: 20,
    sections: ['Coverage', 'Biosimilar Step Therapy', 'Prior Authorization', 'Indications', 'Dosing Guidelines'],
    keyChangesFromPrior: 'Biosimilar step therapy now required before branded Humira',
    strictnessScore: 75,
    analystNotes: [],
  },
  {
    id: 'doc-uhc-hum',
    payerId: 'uhc',
    payerName: 'UnitedHealthcare',
    drugId: 'humira',
    drugName: 'Humira',
    title: 'Humira Prior Authorization & Coverage Guidelines',
    version: 'v1.8',
    effectiveDate: '2025-12-01',
    lastReviewed: '2026-01-20',
    status: 'current',
    pageCount: 15,
    sections: ['Authorization', 'Preferred Status', 'Dosing', 'Renewals', 'Appeals Process'],
    keyChangesFromPrior: 'PA turnaround reduced to 3 business days',
    strictnessScore: 30,
    analystNotes: [],
  },
  {
    id: 'doc-bcbs-hum',
    payerId: 'bcbs',
    payerName: 'Blue Cross Blue Shield',
    drugId: 'humira',
    drugName: 'Humira',
    title: 'Adalimumab Products — Medical Benefit Policy',
    version: 'v2.2',
    effectiveDate: '2025-11-01',
    lastReviewed: '2026-03-10',
    status: 'current',
    pageCount: 28,
    sections: ['Eligibility', 'Biosimilar Requirements', 'Prior Auth', 'Specialist Confirmation', 'Site of Care'],
    keyChangesFromPrior: 'Biosimilar trial required; specialist must confirm diagnosis',
    strictnessScore: 70,
    analystNotes: [],
  },
  {
    id: 'doc-cigna-bev',
    payerId: 'cigna',
    payerName: 'Cigna',
    drugId: 'bevacizumab',
    drugName: 'Bevacizumab',
    title: 'Bevacizumab — Oncology Coverage Criteria',
    version: 'v1.5',
    effectiveDate: '2025-10-01',
    lastReviewed: '2026-02-28',
    status: 'current',
    pageCount: 16,
    sections: ['Oncology Indications', 'Authorization', 'Dosing Protocols', 'Site of Care'],
    keyChangesFromPrior: 'Added NCCN-supported indications',
    strictnessScore: 55,
    analystNotes: [],
  },
  {
    id: 'doc-cigna-rit-old',
    payerId: 'cigna',
    payerName: 'Cigna',
    drugId: 'rituximab',
    drugName: 'Rituximab',
    title: 'Rituximab Medical Policy — Prior Authorization & Coverage Criteria',
    version: 'v3.2',
    effectiveDate: '2025-11-15',
    lastReviewed: '2026-01-10',
    status: 'superseded',
    pageCount: 22,
    sections: ['Indications', 'Prior Authorization', 'Step Therapy', 'Site of Care', 'Dosing', 'Renewals'],
    keyChangesFromPrior: 'Biosimilar preference added; PA turnaround improved',
    strictnessScore: 68,
    analystNotes: [],
  },
]

// Get policy evolution for a specific drug and payer
export function getPolicyEvolution(drugId: string, payerId?: string): PolicyVersion[] {
  let versions = policyVersionHistory.filter(v => v.drugId === drugId)
  if (payerId) versions = versions.filter(v => v.payerId === payerId)
  return versions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

// Get all policy documents with optional filters
export function getFilteredDocuments(filters?: { payerId?: string; drugId?: string; status?: string }): PolicyDocument[] {
  let docs = [...policyDocuments]
  if (filters?.payerId) docs = docs.filter(d => d.payerId === filters.payerId)
  if (filters?.drugId) docs = docs.filter(d => d.drugId === filters.drugId)
  if (filters?.status) docs = docs.filter(d => d.status === filters.status)
  return docs.sort((a, b) => new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime())
}
