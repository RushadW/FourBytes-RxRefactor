'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield, Clock, Building2, Pill, CheckCircle2, XCircle,
  ChevronDown, FileText, Sparkles, MapPin, Filter, Eye, Syringe,
  Calendar, Star, Activity, Check, X, Minus, Loader2,
} from 'lucide-react'
import { fetchMatrix, type MatrixResponse, type MatrixCell } from '@/lib/api'
import type { PayerPolicy, Drug } from '@/lib/types'
import { cn } from '@/lib/utils'

// Dynamic payer color palette
const PAYER_COLORS = [
  'text-indigo-700', 'text-indigo-500', 'text-violet-600',
  'text-emerald-700', 'text-sky-600', 'text-rose-600', 'text-amber-700',
]

function getPayerStyle(payerId: string, payerName: string, index: number) {
  const label = (payerName || payerId).trim() || payerId
  return {
    label,
    /** Same as label — full payer names for clarity (no initials). */
    short: label,
    color: PAYER_COLORS[index % PAYER_COLORS.length],
  }
}

// Convert an API policy cell to a PayerPolicy for display
function cellToPayerPolicy(cell: MatrixCell, drugId: string): PayerPolicy | null {
  const p = cell.policy
  if (!p) return null
  return {
    payerId: p.payer_id,
    payerName: p.payer_name,
    drugId,
    covered: p.covered ?? true,
    accessStatus: (p.access_status as PayerPolicy['accessStatus']) || 'specialty',
    preferredCount: p.preferred_count ?? 0,
    coveredIndications: p.covered_indications ?? [],
    priorAuth: p.prior_auth ?? false,
    priorAuthDetails: p.prior_auth_details ?? '',
    stepTherapy: p.step_therapy ?? false,
    stepTherapyDetails: p.step_therapy_details ?? '',
    siteOfCare: p.site_of_care ?? [],
    dosingLimits: p.dosing_limits ?? '',
    coverageCriteria: p.coverage_criteria ?? [],
    effectiveDate: p.effective_date ?? '',
    lastUpdated: p.last_updated ?? '',
    confidence: (p.confidence as PayerPolicy['confidence']) || 'medium',
  }
}

// ===== Simple checkmark like the reference image =====
function Checkmark() {
  return <Check className="w-5 h-5 text-emerald-500 mx-auto" strokeWidth={2.5} />
}
function CrossMark() {
  return <Minus className="w-4 h-4 text-slate-300 mx-auto" />
}

// ===== Clean matrix table =====
function ComparisonTable({ drug, policies, activePayers, payerStyles }: {
  drug: Drug; policies: PayerPolicy[]; activePayers: string[];
  payerStyles: Record<string, { label: string; short: string; color: string }>
}) {
  // Build columns for ALL active payers — null if no policy exists for this drug
  const cols = activePayers.map(pid => ({
    payerId: pid,
    policy: policies.find(p => p.payerId === pid) ?? null,
  }))

  if (cols.length === 0) return null

  // Find "best" payer among covered policies only
  const coveredCols = cols.filter(c => c.policy?.covered)
  const bestPayerId = coveredCols.length > 1
    ? coveredCols.reduce((best, c) => {
        const p = c.policy!
        const bp = best.policy!
        const score = (p.accessStatus === 'preferred' ? 3 : p.accessStatus === 'specialty' ? 2 : 1)
          + (p.stepTherapy ? 0 : 2) + p.siteOfCare.length + p.coveredIndications.length
        const bestScore = (bp.accessStatus === 'preferred' ? 3 : bp.accessStatus === 'specialty' ? 2 : 1)
          + (bp.stepTherapy ? 0 : 2) + bp.siteOfCare.length + bp.coveredIndications.length
        return score > bestScore ? c : best
      }).payerId
    : null

  const noData = <span className="text-slate-300">—</span>

  type Row = {
    label: string
    cells: (policy: PayerPolicy | null) => React.ReactNode
  }

  const rows: Row[] = [
    { label: 'Covered',
      cells: p => {
        if (!p) return <span className="text-[11px] text-slate-400 italic">No Policy Found</span>
        return p.covered ? <Checkmark /> : <span className="text-[11px] font-medium text-red-500">Not Covered</span>
      }},
    { label: 'Access Status',
      cells: p => {
        if (!p || !p.covered) return noData
        return (
          <span className={cn('text-xs font-medium capitalize',
            p.accessStatus === 'preferred' ? 'text-emerald-600' : p.accessStatus === 'non-preferred' ? 'text-amber-600' : 'text-indigo-600'
          )}>{p.accessStatus.replace('-', ' ')}</span>
        )
      }},
    { label: 'Indications Covered',
      cells: p => {
        if (!p || !p.covered) return noData
        return <span className="text-xs text-foreground">{p.coveredIndications.length}</span>
      }},
    { label: 'Prior Authorization',
      cells: p => {
        if (!p || !p.covered) return noData
        return p.priorAuth ? <Checkmark /> : <CrossMark />
      }},
    { label: 'Step Therapy',
      cells: p => {
        if (!p || !p.covered) return noData
        return p.stepTherapy ? <Checkmark /> : <CrossMark />
      }},
    { label: 'Sites of Care',
      cells: p => {
        if (!p || !p.covered) return noData
        return <span className="text-xs text-foreground">{p.siteOfCare.length} sites</span>
      }},
    { label: 'Dosing / Qty Limits',
      cells: p => {
        if (!p || !p.covered) return noData
        return <span className="text-[11px] text-foreground/70 leading-snug max-w-[150px] inline-block">{p.dosingLimits}</span>
      }},
    { label: 'Effective Date',
      cells: p => {
        if (!p) return noData
        return <span className="text-xs text-foreground/70">{new Date(p.effectiveDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
      }},
    { label: 'Confidence',
      cells: p => {
        if (!p) return noData
        return (
          <span className={cn('text-xs font-medium capitalize',
            p.confidence === 'high' ? 'text-emerald-600' : p.confidence === 'medium' ? 'text-amber-600' : 'text-red-500'
          )}>{p.confidence}</span>
        )
      }},
  ]

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr>
            <th className="w-52" />
            {cols.map(c => {
              const s = payerStyles[c.payerId]
              const isBest = c.payerId === bestPayerId
              return (
                <th key={c.payerId}
                  className={cn(
                    'text-center px-3 pt-5 pb-4 min-w-[100px] max-w-[200px]',
                    isBest && 'bg-primary/[0.02] border-x border-t border-primary/10 rounded-t-xl'
                  )}
                >
                  <div className={cn('text-xs font-bold leading-snug break-words hyphens-auto', s?.color)} title={s?.label}>
                    {s?.label ?? c.payerId}
                  </div>
                  <div className="h-5 flex items-center justify-center mt-1">
                    {isBest && (
                      <span className="text-[9px] font-bold uppercase tracking-widest text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                        Best Access
                      </span>
                    )}
                  </div>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
              <tr key={row.label} className={ri % 2 === 1 ? 'bg-secondary/20' : ''}>
                <td className="py-3.5 pr-6 text-[13px] text-foreground/80 font-medium border-b border-border/30">
                  {row.label}
                </td>
                {cols.map(c => (
                  <td key={c.payerId}
                    className={cn(
                      'text-center py-3.5 px-5 border-b border-border/30',
                      c.payerId === bestPayerId && 'bg-primary/[0.02] border-x border-primary/10'
                    )}
                  >
                    {row.cells(c.policy)}
                  </td>
                ))}
              </tr>
          ))}
          <tr>
            <td />
            {cols.map(c => (
              <td key={c.payerId} className={cn(c.payerId === bestPayerId && 'bg-primary/[0.02] border-x border-b border-primary/10 rounded-b-xl h-2')} />
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ===== Detailed policy card =====
function PolicyCard({ policy, payerId, payerStyles }: {
  policy: PayerPolicy; payerId: string;
  payerStyles: Record<string, { label: string; short: string; color: string }>
}) {
  const style = payerStyles[payerId] || { label: payerId, short: payerId, color: 'text-indigo-600' }
  return (
    <div className="bg-card rounded-xl border border-border/70 overflow-hidden">
      <div className="px-5 py-4 border-b border-border/30">
        <div className="flex items-center justify-between">
          <div>
            <span className={cn('text-sm font-bold', style.color)}>{style.label}</span>
            <div className="flex items-center gap-2 mt-1">
              {policy.covered
                ? <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Covered</span>
                : <span className="text-[10px] font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Not Covered</span>
              }
              <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full capitalize',
                policy.accessStatus === 'preferred' ? 'text-emerald-600 bg-emerald-50' : policy.accessStatus === 'non-preferred' ? 'text-amber-600 bg-amber-50' : 'text-indigo-600 bg-indigo-50'
              )}>{policy.accessStatus.replace('-', ' ')}</span>
            </div>
          </div>
          <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full',
            policy.confidence === 'high' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
          )}>{policy.confidence} confidence</span>
        </div>
      </div>
      <div className="p-5 space-y-4">
        {/* Quick status row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2.5">
            <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', policy.priorAuth ? 'bg-red-50' : 'bg-emerald-50')}>
              <Shield className={cn('w-3.5 h-3.5', policy.priorAuth ? 'text-red-500' : 'text-emerald-500')} />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Prior Auth</p>
              <p className={cn('text-xs font-semibold', policy.priorAuth ? 'text-red-600' : 'text-emerald-600')}>
                {policy.priorAuth ? 'Required' : 'Not Required'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', policy.stepTherapy ? 'bg-red-50' : 'bg-emerald-50')}>
              <Clock className={cn('w-3.5 h-3.5', policy.stepTherapy ? 'text-red-500' : 'text-emerald-500')} />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Step Therapy</p>
              <p className={cn('text-xs font-semibold', policy.stepTherapy ? 'text-red-600' : 'text-emerald-600')}>
                {policy.stepTherapy ? 'Required' : 'Not Required'}
              </p>
            </div>
          </div>
        </div>

        {/* Details sections */}
        {policy.priorAuth && (
          <div className="bg-secondary/40 rounded-lg p-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Prior Auth Details</p>
            <p className="text-[11px] text-foreground/80 leading-relaxed">{policy.priorAuthDetails}</p>
          </div>
        )}
        {policy.stepTherapy && (
          <div className="bg-secondary/40 rounded-lg p-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Step Therapy Details</p>
            <p className="text-[11px] text-foreground/80 leading-relaxed">{policy.stepTherapyDetails}</p>
          </div>
        )}
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Dosing / Quantity Limits</p>
          <p className="text-[11px] text-foreground/80">{policy.dosingLimits}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Covered Indications</p>
          <div className="flex flex-wrap gap-1">
            {policy.coveredIndications.map(ind => (
              <span key={ind} className="text-[10px] px-2 py-0.5 bg-primary/5 rounded-full text-primary/80 border border-primary/10">{ind}</span>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Sites of Care</p>
          <div className="flex flex-wrap gap-1">
            {policy.siteOfCare.map(site => (
              <span key={site} className="text-[10px] px-2 py-0.5 bg-secondary rounded-full text-foreground/60">{site}</span>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Coverage Criteria</p>
          <ul className="space-y-1">
            {policy.coverageCriteria.map((c, ci) => (
              <li key={ci} className="flex items-start gap-1.5 text-[11px] text-foreground/70">
                <Check className="w-3 h-3 text-primary/40 mt-0.5 flex-shrink-0" strokeWidth={2} />{c}
              </li>
            ))}
          </ul>
        </div>
        <div className="pt-3 border-t border-border/30 text-[10px] text-muted-foreground">
          Effective {new Date(policy.effectiveDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          {' · '}Updated {new Date(policy.lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
      </div>
    </div>
  )
}

// ===== Main =====
export function PolicyCompare() {
  const [matrix, setMatrix] = useState<MatrixResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPayers, setSelectedPayers] = useState<string[]>([])
  const [selectedDrugs, setSelectedDrugs] = useState<string[]>([])
  const [detailDrug, setDetailDrug] = useState<string | null>(null)

  // Fetch data from API
  useEffect(() => {
    fetchMatrix()
      .then((data) => {
        setMatrix(data)
        setSelectedPayers(data.payers.map(p => p.payer_id))
        setSelectedDrugs(data.drugs.map(d => d.drug_id))
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  // Build payer styles dynamically
  const payerStyles = useMemo(() => {
    if (!matrix) return {}
    const styles: Record<string, { label: string; short: string; color: string }> = {}
    matrix.payers.forEach((p, i) => {
      styles[p.payer_id] = getPayerStyle(p.payer_id, p.payer_name, i)
    })
    return styles
  }, [matrix])

  // Build Drug objects from matrix + first real policy per row (generic/category/area)
  const drugObjects = useMemo(() => {
    if (!matrix) return new Map<string, Drug>()
    const m = new Map<string, Drug>()
    for (const d of matrix.drugs) {
      const row = matrix.rows.find(r => r.drug.drug_id === d.drug_id)
      const rowDrug = row?.drug
      const firstPolicy =
        row &&
        (Object.values(row.cells)
          .map(c => c.policy)
          .find(p => p != null) ?? null)

      const genericName =
        rowDrug?.generic_name?.trim() ||
        firstPolicy?.generic_name?.trim() ||
        ''
      const drugCategory =
        rowDrug?.drug_category?.trim() ||
        firstPolicy?.drug_category?.trim() ||
        ''
      const therapeuticArea =
        rowDrug?.therapeutic_area?.trim() ||
        firstPolicy?.therapeutic_area?.trim() ||
        ''

      m.set(d.drug_id, {
        id: d.drug_id,
        name: d.drug_name,
        genericName,
        therapeuticArea,
        drugCategory,
      })
    }
    return m
  }, [matrix])

  // Build PayerPolicy[] from matrix rows
  const allPolicies = useMemo(() => {
    if (!matrix) return [] as PayerPolicy[]
    const result: PayerPolicy[] = []
    for (const row of matrix.rows) {
      for (const [payerId, cell] of Object.entries(row.cells)) {
        if (cell.has_data) {
          const pp = cellToPayerPolicy(cell, row.drug.drug_id)
          if (pp) result.push(pp)
        }
      }
    }
    return result
  }, [matrix])

  const togglePayer = (id: string) => {
    setSelectedPayers(prev => prev.includes(id) ? (prev.length > 1 ? prev.filter(p => p !== id) : prev) : [...prev, id])
  }
  const toggleDrug = (id: string) => {
    setSelectedDrugs(prev => prev.includes(id) ? (prev.length > 1 ? prev.filter(d => d !== id) : prev) : [...prev, id])
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-primary mr-3" />
        <span className="text-sm text-muted-foreground">Loading policy data from scraped PDFs...</span>
      </div>
    )
  }

  if (error || !matrix) {
    return (
      <div className="text-center py-24 text-muted-foreground">
        <FileText className="w-8 h-8 mx-auto mb-3 opacity-30" />
        <p className="text-sm">Could not load policy data. Is the backend running on port 8080?</p>
        {error && <p className="text-xs mt-2 text-red-400">{error}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Policy Comparison</h1>
        <p className="text-sm text-muted-foreground">
          {matrix.drugs.length} drugs × {matrix.payers.length} payers — {matrix.total_policies} policies extracted from real payer PDFs.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-xl border border-border/70 p-4 space-y-3 soft-shadow">
        <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
          <Filter className="w-3.5 h-3.5" /> Filters
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium">Payer:</span>
            <div className="flex gap-1.5 flex-wrap">
              {matrix.payers.map(p => {
                const s = payerStyles[p.payer_id]
                return (
                  <button key={p.payer_id} onClick={() => togglePayer(p.payer_id)}
                    className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                      selectedPayers.includes(p.payer_id)
                        ? 'bg-primary text-white border-primary'
                        : 'bg-card text-foreground/70 border-border hover:border-primary/30'
                    )}>
                    {p.payer_name}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="w-px h-6 bg-border hidden sm:block" />
          <div className="flex items-center gap-2">
            <Pill className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium">Drug:</span>
            <div className="flex gap-1.5 flex-wrap">
              {matrix.drugs.map(d => (
                <button key={d.drug_id} onClick={() => toggleDrug(d.drug_id)}
                  className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                    selectedDrugs.includes(d.drug_id)
                      ? 'bg-primary text-white border-primary'
                      : 'bg-card text-foreground/70 border-border hover:border-primary/30'
                  )}>{d.drug_name}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Per-drug comparison cards */}
      {selectedDrugs.map(drugId => {
        const drug = drugObjects.get(drugId)
        if (!drug) return null
        const drugPolicies = allPolicies.filter(p => p.drugId === drugId)
        const existingPolicies = drugPolicies.filter(p => selectedPayers.includes(p.payerId))
        const isDetailOpen = detailDrug === drugId

        return (
          <motion.div key={drugId}
            className="bg-card rounded-2xl border border-border/70 overflow-hidden soft-shadow"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          >
            {/* Drug header bar */}
            <div className="px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center">
                  <Pill className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <h2 className="text-base font-bold text-foreground">{drug.name}</h2>
                    {drug.genericName &&
                      drug.genericName.toLowerCase() !== drug.name.toLowerCase() && (
                        <span className="text-xs text-muted-foreground">({drug.genericName})</span>
                      )}
                  </div>
                  {(drug.drugCategory || drug.therapeuticArea) && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {[drug.drugCategory, drug.therapeuticArea].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setDetailDrug(isDetailOpen ? null : drugId)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all border',
                  isDetailOpen
                    ? 'bg-primary text-white border-primary'
                    : 'bg-card text-foreground/60 border-border hover:border-primary/30 hover:text-foreground'
                )}
              >
                <Eye className="w-3.5 h-3.5" />
                {isDetailOpen ? 'Hide Details' : 'View Details'}
              </button>
            </div>

            {/* Clean comparison table */}
            <div className="px-6 pb-6">
              <ComparisonTable drug={drug} policies={drugPolicies} activePayers={selectedPayers} payerStyles={payerStyles} />
            </div>

            {/* Expandable detail cards */}
            <AnimatePresence>
              {isDetailOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="px-6 pb-6 space-y-4 border-t border-border/30 pt-5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Full Policy Details</p>
                    <div className={cn('grid gap-4',
                      existingPolicies.length >= 3 ? 'grid-cols-3' : existingPolicies.length === 2 ? 'grid-cols-2' : 'grid-cols-1 max-w-md'
                    )}>
                      {existingPolicies.map(p => <PolicyCard key={p.payerId} policy={p} payerId={p.payerId} payerStyles={payerStyles} />)}
                    </div>

                    {/* AI insight */}
                    <div className="bg-primary/[0.03] rounded-xl border border-primary/10 p-4 flex items-start gap-3">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Sparkles className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">AI Insight</p>
                        <p className="text-xs text-foreground/80 leading-relaxed">
                          {(() => {
                            const covered = existingPolicies.filter(p => p.covered)
                            const notCovered = existingPolicies.filter(p => !p.covered)
                            const payerLabel = (pid: string) => payerStyles[pid]?.label || existingPolicies.find(x => x.payerId === pid)?.payerName || pid
                            const noPolicyPayers = selectedPayers.filter(pid => !existingPolicies.find(p => p.payerId === pid)).map(payerLabel)
                            if (covered.length === 0) return <>No selected payers currently cover {drug.name}.{notCovered.length > 0 && <> {notCovered.map(p => payerLabel(p.payerId)).join(' and ')} explicitly exclude it.</>}{noPolicyPayers.length > 0 && <> {noPolicyPayers.join(' and ')}: no policy found.</>}</>
                            const best = covered.reduce((a, b) => {
                              const aS = (a.accessStatus === 'preferred' ? 3 : 1) + (a.stepTherapy ? 0 : 2) + a.siteOfCare.length
                              const bS = (b.accessStatus === 'preferred' ? 3 : 1) + (b.stepTherapy ? 0 : 2) + b.siteOfCare.length
                              return aS >= bS ? a : b
                            })
                            const pref = covered.filter(p => p.accessStatus === 'preferred').map(p => payerLabel(p.payerId))
                            const st = covered.filter(p => p.stepTherapy).map(p => payerLabel(p.payerId))
                            return <>
                              <strong>{payerLabel(best.payerId)}</strong> offers the best access path for {drug.name}
                              {best.accessStatus === 'preferred' && ' with preferred status'}.
                              {pref.length > 0 && pref.length < covered.length && <> {pref.join(' and ')} list it as preferred.</>}
                              {st.length > 0 && <> {st.join(' and ')} require step therapy.</>}
                              {notCovered.length > 0 && <> {notCovered.map(p => payerLabel(p.payerId)).join(' and ')} do not cover this drug.</>}
                              {noPolicyPayers.length > 0 && <> {noPolicyPayers.join(' and ')}: no policy found.</>}
                              {' '}{covered.length} of {selectedPayers.length} selected payers cover this drug.
                            </>
                          })()}
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )
      })}

      {selectedDrugs.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <FileText className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Select at least one drug to compare.</p>
        </div>
      )}
    </div>
  )
}
