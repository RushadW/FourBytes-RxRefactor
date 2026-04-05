'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, TrendingUp, TrendingDown, Shield, Clock, Building2,
  CheckCircle2, AlertTriangle, XCircle, GitCompareArrows, Pill,
  BarChart3, FileText, Lightbulb, ArrowRight, ExternalLink,
  Globe, BookOpen, Zap, BadgeCheck, ChevronDown, Send, Copy, History, Download,
} from 'lucide-react'
import { SpeakButton } from './voice-orb'
import { parseQuery, getPoliciesForDrug, getDrugById, drugs, payerPolicies } from '@/lib/mock-data'
import { fetchComparison, askQuestion, fetchPolicyVersions, type ApiAskResponse, type PolicyVersionRecord } from '@/lib/api'
import type { PayerPolicy, Drug, Insight } from '@/lib/types'
import { cn } from '@/lib/utils'
import { PolicyMatrix } from './policy-matrix'

// Widget types the AI can choose to render
type WidgetType =
  | 'ai-answer'
  | 'comparison-cards'
  | 'payer-breakdown'
  | 'step-therapy-visual'
  | 'site-of-care'
  | 'quick-stats'
  | 'key-insight'
  | 'policy-changes'
  | 'coverage-verdict'
  | 'full-matrix'

interface Widget {
  type: WidgetType
  data: Record<string, unknown>
  priority: number
}

// The AI "decides" what widgets to show based on the query
function generateDashboard(query: string, policies: PayerPolicy[], drug: Drug | undefined, allPolicies: PayerPolicy[]): { summary: string; widgets: Widget[] } {
  const q = query.toLowerCase()
  
  const stPayers = policies.filter(p => p.stepTherapy)
  const noStPayers = policies.filter(p => !p.stepTherapy)
  
  let summary = ''
  const widgets: Widget[] = []

  // Always show quick stats
  widgets.push({
    type: 'quick-stats',
    data: { policies, drug },
    priority: 0,
  })

  if (q.includes('compare') || q.includes('across') || q.includes('difference')) {
    summary = `I analyzed ${policies.length} payer policies for **${drug?.name}**. ${stPayers.length > 0 ? `${stPayers.map(p => p.payerName).join(' and ')} require step therapy` : 'No payers require step therapy'}${noStPayers.length > 0 ? `, while ${noStPayers.map(p => p.payerName).join(' and ')} do not` : ''}. ${policies.filter(p => p.priorAuth).length > 0 ? `${policies.filter(p => p.priorAuth).length} of ${policies.length} require prior authorization.` : 'None require prior authorization.'}`
    
    widgets.push({ type: 'full-matrix', data: {}, priority: 1 })
    widgets.push({ type: 'comparison-cards', data: { policies, drug }, priority: 2 })
    widgets.push({ type: 'step-therapy-visual', data: { policies, drug }, priority: 3 })
    widgets.push({ type: 'site-of-care', data: { policies, drug }, priority: 4 })
    widgets.push({ type: 'key-insight', data: { text: noStPayers.length > 0 ? `${noStPayers[0].payerName} offers the fastest path to approval — no step therapy required.` : 'All payers require step therapy. Start the process early.', type: 'tip' }, priority: 5 })
  } else if (q.includes('cover') && (q.includes('cigna') || q.includes('uhc') || q.includes('united') || q.includes('bcbs') || q.includes('blue'))) {
    let payerId = 'cigna'
    if (q.includes('uhc') || q.includes('united')) payerId = 'uhc'
    if (q.includes('bcbs') || q.includes('blue')) payerId = 'bcbs'
    
    const payerPols = allPolicies.filter(p => p.payerId === payerId)
    const payerName = payerPols[0]?.payerName || payerId
    
    summary = `**${payerName}** covers **${payerPols.length} drugs** in our database. ${payerPols.every(p => p.priorAuth) ? 'All require prior authorization.' : 'Coverage varies by drug.'}`
    
    widgets.push({ type: 'coverage-verdict', data: { policies: payerPols, payerName }, priority: 1 })
    widgets.push({ type: 'payer-breakdown', data: { policies: payerPols, payerName }, priority: 2 })
  } else if (q.includes('change') || q.includes('update') || q.includes('quarter')) {
    summary = `I found **8 policy changes** across 3 payers in Q1 2026. The most significant: Cigna increased step therapy duration for Rituximab, and UHC expanded home infusion coverage.`
    
    widgets.push({ type: 'policy-changes', data: {}, priority: 1 })
    widgets.push({ type: 'key-insight', data: { text: 'Cigna has become more restrictive this quarter while UHC is trending more patient-friendly.', type: 'warning' }, priority: 2 })
  } else if (q.includes('step therapy') || q.includes('prior auth')) {
    summary = `Across all tracked drugs: **${allPolicies.filter(p => p.stepTherapy).length}** of **${allPolicies.length}** policies require step therapy. UnitedHealthcare is generally the most lenient.`
    
    widgets.push({ type: 'full-matrix', data: {}, priority: 1 })
    widgets.push({ type: 'step-therapy-visual', data: { policies: allPolicies, drug: null }, priority: 2 })
  } else {
    summary = `I found **${policies.length} policies** for **${drug?.name}** across ${policies.map(p => p.payerName).join(', ')}. ${policies.filter(p => p.priorAuth).length > 0 ? `${policies.filter(p => p.priorAuth).length} require prior authorization.` : 'None require prior authorization.'} Here's the full coverage matrix.`
    
    widgets.push({ type: 'full-matrix', data: {}, priority: 1 })
    widgets.push({ type: 'comparison-cards', data: { policies, drug }, priority: 2 })
  }
  
  return { summary, widgets: widgets.sort((a, b) => a.priority - b.priority) }
}

// ============= WIDGET COMPONENTS =============

function QuickStatsWidget({ policies, drug }: { policies: PayerPolicy[]; drug: Drug | undefined }) {
  const stats = [
    { label: 'Policies Analyzed', value: policies.length * 4, icon: FileText, color: 'text-primary' },
    { label: 'Payers Compared', value: policies.length, icon: Building2, color: 'text-primary' },
    { label: 'Prior Auth Required', value: policies.filter(p => p.priorAuth).length, icon: Shield, color: 'text-amber-500' },
    { label: 'Step Therapy', value: policies.filter(p => p.stepTherapy).length, icon: Clock, color: 'text-primary' },
  ]
  
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map((stat, i) => {
        const Icon = stat.icon
        return (
          <motion.div
            key={stat.label}
            className="bg-white rounded-xl p-4 border border-border/60 soft-shadow text-center"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <Icon className={cn('w-5 h-5 mx-auto mb-2', stat.color)} />
            <div className="text-2xl font-bold text-foreground">{stat.value}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{stat.label}</div>
          </motion.div>
        )
      })}
    </div>
  )
}

function ComparisonCardsWidget({ policies, drug }: { policies: PayerPolicy[]; drug: Drug | undefined }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-primary" />
        Payer Comparison — {drug?.name}
      </h3>
      <div className="grid sm:grid-cols-3 gap-3">
        {policies.map((policy, i) => (
          <motion.div
            key={policy.payerId}
            className="bg-white rounded-xl p-4 border border-border/60 soft-shadow"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.1 }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className={cn(
                'w-2 h-2 rounded-full',
                policy.payerId === 'cigna' ? 'bg-indigo-700' : policy.payerId === 'uhc' ? 'bg-indigo-500' : 'bg-violet-500'
              )} />
              <span className="font-semibold text-sm">{policy.payerName}</span>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Prior Auth</span>
                {policy.priorAuth
                  ? <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Required</span>
                  : <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Not required</span>
                }
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Step Therapy</span>
                {policy.stepTherapy
                  ? <span className="text-xs font-medium text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">Required</span>
                  : <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">None</span>
                }
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Sites</span>
                <span className="text-xs text-foreground">{policy.siteOfCare.length} options</span>
              </div>
            </div>
            
            <div className="mt-3 pt-3 border-t border-border/50">
              <p className="text-[11px] text-muted-foreground leading-relaxed">{policy.stepTherapyDetails}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function StepTherapyVisualWidget({ policies, drug }: { policies: PayerPolicy[]; drug: Drug | null | undefined }) {
  return (
    <div className="bg-white rounded-xl p-5 border border-border/60 soft-shadow">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
        <Clock className="w-4 h-4 text-rose-400" />
        Step Therapy Overview {drug ? `— ${drug.name}` : ''}
      </h3>
      <div className="space-y-3">
        {policies.map((policy, i) => (
          <motion.div
            key={`${policy.payerId}-${policy.drugId}`}
            className="flex items-center gap-3"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <div className="w-28 text-xs font-medium text-foreground truncate">{policy.payerName}</div>
            <div className="flex-1 h-8 bg-secondary rounded-lg overflow-hidden relative">
              <motion.div
                className={cn(
                  'h-full rounded-lg flex items-center px-3',
                  policy.stepTherapy ? 'bg-rose-100' : 'bg-emerald-100'
                )}
                initial={{ width: 0 }}
                animate={{ width: policy.stepTherapy ? '70%' : '100%' }}
                transition={{ delay: 0.2 + i * 0.1, duration: 0.5 }}
              >
                <span className={cn(
                  'text-[11px] font-medium whitespace-nowrap',
                  policy.stepTherapy ? 'text-rose-700' : 'text-emerald-700'
                )}>
                  {policy.stepTherapy ? 'Required' : 'Direct Access'}
                </span>
              </motion.div>
            </div>
            {policy.stepTherapy
              ? <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              : <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            }
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function SiteOfCareWidget({ policies, drug }: { policies: PayerPolicy[]; drug: Drug | undefined }) {
  const allSites = new Set(policies.flatMap(p => p.siteOfCare))
  
  return (
    <div className="bg-white rounded-xl p-5 border border-border/60 soft-shadow">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
        <Building2 className="w-4 h-4 text-primary" />
        Site of Care Availability — {drug?.name}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-left py-2 pr-4 text-muted-foreground font-medium">Site</th>
              {policies.map(p => (
                <th key={p.payerId} className="text-center py-2 px-3 text-muted-foreground font-medium">{p.payerName.split(' ')[0]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from(allSites).map(site => (
              <tr key={site} className="border-b border-border/30">
                <td className="py-2.5 pr-4 text-foreground font-medium">{site}</td>
                {policies.map(p => (
                  <td key={p.payerId} className="text-center py-2.5 px-3">
                    {p.siteOfCare.includes(site)
                      ? <CheckCircle2 className="w-4 h-4 text-primary mx-auto" />
                      : <XCircle className="w-4 h-4 text-red-300 mx-auto" />
                    }
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function KeyInsightWidget({ text, type }: { text: string; type: string }) {
  const config = {
    tip: { icon: Lightbulb, bg: 'bg-emerald-50 border-emerald-200', color: 'text-emerald-700', iconColor: 'text-emerald-500' },
    warning: { icon: AlertTriangle, bg: 'bg-amber-50 border-amber-200', color: 'text-amber-700', iconColor: 'text-amber-500' },
    info: { icon: Sparkles, bg: 'bg-indigo-50 border-indigo-200', color: 'text-indigo-700', iconColor: 'text-indigo-500' },
  }[type] || { icon: Sparkles, bg: 'bg-indigo-50 border-indigo-200', color: 'text-indigo-700', iconColor: 'text-indigo-500' }
  
  const Icon = config.icon
  
  return (
    <motion.div
      className={cn('rounded-xl p-4 border flex items-start gap-3', config.bg)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Icon className={cn('w-5 h-5 flex-shrink-0 mt-0.5', config.iconColor)} />
      <p className={cn('text-sm leading-relaxed', config.color)}>{text}</p>
    </motion.div>
  )
}

function CoverageVerdictWidget({ policies, payerName }: { policies: PayerPolicy[]; payerName: string }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Shield className="w-4 h-4 text-primary" />
        {payerName} — Drug Coverage
      </h3>
      {policies.map((policy, i) => {
        const drugInfo = getDrugById(policy.drugId)
        return (
          <motion.div
            key={policy.drugId}
            className="bg-white rounded-xl p-4 border border-border/60 soft-shadow flex items-center gap-4"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Pill className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{drugInfo?.name || policy.drugId}</p>
              <p className="text-xs text-muted-foreground">{drugInfo?.therapeuticArea}</p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {policy.priorAuth && <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full border border-amber-200">Prior Auth</span>}
              {policy.stepTherapy && <span className="text-[10px] font-medium text-rose-600 bg-rose-50 px-2 py-1 rounded-full border border-rose-200">Step Therapy</span>}
              <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-200">Covered</span>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

function PayerBreakdownWidget({ policies, payerName }: { policies: PayerPolicy[]; payerName: string }) {
  return (
    <div className="bg-white rounded-xl p-5 border border-border/60 soft-shadow">
      <h3 className="text-sm font-semibold text-foreground mb-3">{payerName} Details</h3>
      <div className="space-y-3">
        {policies.map(policy => {
          const drug = getDrugById(policy.drugId)
          return (
            <div key={policy.drugId} className="p-3 rounded-lg bg-secondary/50">
              <p className="text-xs font-semibold text-foreground mb-1">{drug?.name}</p>
              <p className="text-[11px] text-muted-foreground">{policy.priorAuthDetails}</p>
              {policy.stepTherapy && (
                <p className="text-[11px] text-rose-600 mt-1">Step therapy: {policy.stepTherapyDetails}</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PolicyChangesWidget() {
  const [changes, setChanges] = useState<Array<{
    payer: string; drug: string; change: string; severity: 'critical' | 'warning' | 'positive'; date: string
  }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch real version diffs from the API
    fetch('http://localhost:8080/api/matrix')
      .then(r => r.json())
      .then(async (matrix) => {
        const allChanges: typeof changes = []
        for (const row of matrix.rows) {
          for (const payerEntry of matrix.payers) {
            const cell = row.cells[payerEntry.payer_id]
            if (!cell?.has_data || !cell.policy) continue
            const policyId = cell.policy.id
            if (!policyId) continue
            try {
              const vers = await fetchPolicyVersions(policyId)
              if (vers.length > 1) {
                const latest = vers[vers.length - 1]
                if (latest.change_summary) {
                  const summaryParts = latest.change_summary.split(';').slice(0, 2).map(s => s.trim()).filter(Boolean)
                  const changeText = summaryParts.join('; ')
                  const isCritical = changeText.toLowerCase().includes('not covered') || changeText.toLowerCase().includes('step_therapy')
                  const isPositive = changeText.toLowerCase().includes('removed') || changeText.toLowerCase().includes('added') || changeText.toLowerCase().includes('home')
                  allChanges.push({
                    payer: payerEntry.payer_name,
                    drug: row.drug.drug_name,
                    change: changeText,
                    severity: isCritical ? 'critical' : isPositive ? 'positive' : 'warning',
                    date: latest.created_at ? new Date(latest.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '',
                  })
                }
              }
            } catch {}
          }
        }
        setChanges(allChanges.slice(0, 8))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const sevConfig = {
    critical: { bg: 'bg-rose-50', color: 'text-rose-600', label: '🔴' },
    warning: { bg: 'bg-amber-50', color: 'text-amber-600', label: '🟡' },
    positive: { bg: 'bg-emerald-50', color: 'text-emerald-600', label: '🟢' },
  }

  return (
    <div className="bg-white rounded-xl p-5 border border-border/60 soft-shadow">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
        <GitCompareArrows className="w-4 h-4 text-primary" />
        Recent Policy Changes
      </h3>
      {loading ? (
        <div className="text-xs text-slate-400 py-4 text-center">Loading changes from version history...</div>
      ) : changes.length === 0 ? (
        <div className="text-xs text-slate-400 py-4 text-center">No recent policy changes detected</div>
      ) : (
        <div className="space-y-2">
          {changes.map((c, i) => {
            const cfg = sevConfig[c.severity]
            return (
              <motion.div
                key={i}
                className={cn('flex items-start gap-3 p-3 rounded-lg', cfg.bg)}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <span className="text-xs mt-0.5">{cfg.label}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold text-foreground">{c.payer}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/80 text-muted-foreground">{c.drug}</span>
                  </div>
                  <p className={cn('text-xs', cfg.color)}>{c.change}</p>
                </div>
                {c.date && <span className="text-[10px] text-muted-foreground flex-shrink-0">{c.date}</span>}
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ============= PAYER COLORS =============

const PAYER_COLORS: Record<string, { bg: string; border: string; text: string; dot: string; gradient: string }> = {
  uhc: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', dot: 'bg-blue-500', gradient: 'from-blue-500 to-blue-600' },
  cigna: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', dot: 'bg-orange-500', gradient: 'from-orange-500 to-orange-600' },
  bcbs: { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-700', dot: 'bg-sky-500', gradient: 'from-sky-500 to-sky-600' },
  priority_health: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500', gradient: 'from-emerald-500 to-emerald-600' },
  upmc: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', dot: 'bg-purple-500', gradient: 'from-purple-500 to-purple-600' },
  emblem: { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700', dot: 'bg-teal-500', gradient: 'from-teal-500 to-teal-600' },
  florida_blue: { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700', dot: 'bg-cyan-500', gradient: 'from-cyan-500 to-cyan-600' },
}

function getPayerColor(payerId: string) {
  return PAYER_COLORS[payerId] || { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700', dot: 'bg-slate-500', gradient: 'from-slate-500 to-slate-600' }
}

function formatPayerName(id: string) {
  const names: Record<string, string> = {
    uhc: 'UnitedHealthcare', cigna: 'Cigna', bcbs: 'BCBS',
    priority_health: 'Priority Health', upmc: 'UPMC',
    emblem: 'EmblemHealth', florida_blue: 'Florida Blue',
  }
  return names[id] || id.charAt(0).toUpperCase() + id.slice(1)
}

// ============= AI ANSWER RENDERER =============

function RenderedMarkdown({ text }: { text: string }) {
  // Parse markdown-like text into React elements
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let listBuffer: string[] = []

  const flushList = () => {
    if (listBuffer.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="space-y-1.5 my-2">
          {listBuffer.map((item, j) => (
            <li key={j} className="flex items-start gap-2 text-[15px] leading-relaxed text-slate-700">
              <span className="mt-2 w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      )
      listBuffer = []
    }
  }

  const renderInline = (line: string): React.ReactNode[] => {
    return line.split(/(\*\*.*?\*\*)/).map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>
      }
      return <span key={i}>{part}</span>
    })
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    if (!line) {
      flushList()
      continue
    }

    // Headings
    if (line.startsWith('## ')) {
      flushList()
      elements.push(
        <h3 key={`h-${i}`} className="text-sm font-bold text-slate-900 mt-4 mb-1.5 flex items-center gap-2">
          <span className="w-1 h-4 rounded-full bg-gradient-to-b from-indigo-500 to-violet-500" />
          {renderInline(line.slice(3))}
        </h3>
      )
      continue
    }

    if (line.startsWith('# ')) {
      flushList()
      elements.push(
        <h2 key={`h-${i}`} className="text-base font-bold text-slate-900 mt-3 mb-2">
          {renderInline(line.slice(2))}
        </h2>
      )
      continue
    }

    // Bullet points
    if (line.startsWith('- ') || line.startsWith('• ') || line.startsWith('* ')) {
      listBuffer.push(line.slice(2))
      continue
    }

    // Horizontal rule / separator
    if (line.startsWith('---')) {
      flushList()
      elements.push(<hr key={`hr-${i}`} className="border-slate-200 my-3" />)
      continue
    }

    // Normal paragraph
    flushList()
    elements.push(
      <p key={`p-${i}`} className="text-[15px] leading-relaxed text-slate-700 my-1.5">
        {renderInline(line)}
      </p>
    )
  }
  flushList()

  return <div>{elements}</div>
}

// ============= INLINE COMPARISON TABLE (shown in chat for comparison queries) =============

function isComparisonQuery(q: string): boolean {
  const lower = q.toLowerCase()
  return (
    lower.includes('compare') || lower.includes('comparison') ||
    lower.includes('across payers') || lower.includes('across plans') ||
    lower.includes('difference between') || lower.includes('all plans') ||
    lower.includes('all drugs') || lower.includes('coverage grid')
  )
}

function DrugComparisonTable({ policies, drug }: {
  policies: ApiAskResponse['relevant_policies']
  drug?: { name: string; generic_name?: string; drug_category?: string; therapeutic_area?: string }
}) {
  // Group policies by drug
  const byDrug = useMemo(() => {
    const map = new Map<string, typeof policies>()
    for (const p of policies) {
      const key = p.drug_name || p.drug_id
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(p)
    }
    return map
  }, [policies])

  // Get unique payers
  const payers = useMemo(() => {
    const seen = new Map<string, string>()
    for (const p of policies) {
      if (!seen.has(p.payer_id)) seen.set(p.payer_id, p.payer_name)
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }))
  }, [policies])

  // Single drug comparison (column per payer)
  if (byDrug.size <= 1 && payers.length > 1) {
    const drugName = drug?.name || policies[0]?.drug_name || 'Drug'
    const genericName = drug?.generic_name || policies[0]?.generic_name || ''
    const category = drug?.drug_category || policies[0]?.drug_category || ''
    const subtitle = [genericName, category].filter(Boolean).join(' · ')

    // Build sections — all 8 key criteria
    const sections = [
      {
        label: 'COVERAGE & ACCESS',
        color: 'text-indigo-600',
        rows: [
          { field: 'Coverage Status', key: 'status' },
          { field: 'Access Status', key: 'access' },
          { field: 'Preferred Count', key: 'preferred_count' },
          { field: 'Drug Category', key: 'drug_category' },
        ],
      },
      {
        label: 'COVERED INDICATIONS',
        color: 'text-emerald-600',
        rows: [
          { field: 'Approved Indications', key: 'indications' },
        ],
      },
      {
        label: 'PRIOR AUTHORIZATION',
        color: 'text-amber-600',
        rows: [
          { field: 'Prior Authorization Required', key: 'pa' },
          { field: 'Prior Authorization Criteria', key: 'pa_details' },
        ],
      },
      {
        label: 'STEP THERAPY',
        color: 'text-violet-600',
        rows: [
          { field: 'Step Therapy Required', key: 'st' },
          { field: 'Required Prior Agents', key: 'st_details' },
        ],
      },
      {
        label: 'ADMINISTRATION',
        color: 'text-blue-600',
        rows: [
          { field: 'Site of Care', key: 'soc' },
          { field: 'Dosing / Quantity Limits', key: 'dosing' },
        ],
      },
      {
        label: 'POLICY INFO',
        color: 'text-slate-500',
        rows: [
          { field: 'Effective Date', key: 'effective_date' },
          { field: 'Data Confidence', key: 'confidence' },
        ],
      },
    ]

    const getCellValue = (pol: (typeof policies)[0] | undefined, key: string) => {
      if (!pol) return { text: '—', style: 'text-slate-300' }
      switch (key) {
        case 'status': {
          if (pol.covered === null) return { text: 'Unknown', style: 'text-slate-400' }
          if (!pol.covered) return { text: 'Not Covered', badge: 'text-red-700 bg-red-50 border-red-200' }
          if (pol.access_status === 'preferred') return { text: 'Covered — Preferred', badge: 'text-emerald-700 bg-emerald-50 border-emerald-200' }
          return { text: 'Covered — Restricted', badge: 'text-amber-700 bg-amber-50 border-amber-200' }
        }
        case 'access': {
          const label = pol.access_status ? pol.access_status.charAt(0).toUpperCase() + pol.access_status.slice(1) : '—'
          const color = pol.access_status === 'preferred' ? 'text-emerald-700 font-semibold' : pol.access_status === 'non-preferred' ? 'text-amber-700 font-semibold' : 'text-slate-600'
          return { text: label, style: color }
        }
        case 'preferred_count': {
          const ct = pol.preferred_count
          if (!ct) return { text: '—', style: 'text-slate-400' }
          return { text: `${ct} drug${ct > 1 ? 's' : ''} share preferred status in this class`, style: 'text-slate-600 text-[11px]' }
        }
        case 'drug_category': return { text: pol.drug_category || category || '—', style: 'text-slate-600' }
        case 'indications': {
          const ind = pol.covered_indications
          if (!ind || ind.length === 0) return { text: 'Not specified', style: 'text-slate-400 italic' }
          return { text: ind.join(' · '), style: 'text-slate-700 text-[11px] leading-snug' }
        }
        case 'confidence': {
          const c = pol.confidence
          const cfg = c === 'high'
            ? { dot: 'bg-emerald-400', label: 'High' }
            : c === 'medium' ? { dot: 'bg-amber-400', label: 'Medium' } : { dot: 'bg-red-400', label: 'Low' }
          return { text: cfg.label, dot: cfg.dot }
        }
        case 'pa':
          return pol.prior_auth
            ? { text: '✓ Required', badge: 'text-amber-700 bg-amber-50 border-amber-200' }
            : { text: '✗ Not Required', style: 'text-slate-400' }
        case 'pa_details':
          if (!pol.prior_auth) return { text: 'N/A — No prior authorization required', style: 'text-slate-400 italic text-[11px]' }
          return { text: pol.prior_auth_details || 'Details not available', style: 'text-slate-700 text-[11px] leading-snug' }
        case 'st':
          return pol.step_therapy
            ? { text: '✓ Required', badge: 'text-violet-700 bg-violet-50 border-violet-200' }
            : { text: '✗ Not Required', style: 'text-slate-400' }
        case 'st_details':
          if (!pol.step_therapy) return { text: 'N/A — No step therapy required', style: 'text-slate-400 italic text-[11px]' }
          return { text: pol.step_therapy_details || 'Details not available', style: 'text-slate-700 text-[11px] leading-snug' }
        case 'soc': {
          const sites = pol.site_of_care
          if (!sites || sites.length === 0) return { text: 'No restrictions', style: 'text-slate-400 italic' }
          return { text: sites.join(', '), style: 'text-slate-700 text-[11px]' }
        }
        case 'dosing': return { text: pol.dosing_limits || 'No specific limits', style: pol.dosing_limits ? 'text-slate-700 text-[11px] leading-snug' : 'text-slate-400 italic text-[11px]' }
        case 'effective_date': {
          const d = pol.effective_date
          if (!d) return { text: '—', style: 'text-slate-400' }
          return { text: new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), style: 'text-slate-700' }
        }
        default: return { text: '—', style: 'text-slate-300' }
      }
    }

    const renderCell = (val: ReturnType<typeof getCellValue>) => {
      if ('badge' in val && val.badge) {
        return <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border inline-block', val.badge)}>{val.text}</span>
      }
      if ('dot' in val && val.dot) {
        return (
          <div className="flex items-center gap-1.5">
            <span className={cn('w-2 h-2 rounded-full', val.dot)} />
            <span className="text-slate-600 text-xs">{val.text}</span>
          </div>
        )
      }
      return <span className={cn('text-xs', val.style)}>{val.text}</span>
    }

    // Sort payers by policy match
    const policyByPayer = new Map(policies.map(p => [p.payer_id, p]))

    const coveredCount = policies.filter(p => p.covered).length
    const restrictedCount = policies.filter(p => p.covered && p.access_status !== 'preferred').length

    // ── Export helpers ──
    const exportCSV = () => {
      const headers = ['Field', ...payers.map(p => p.name)]
      const rows: string[][] = []
      for (const section of sections) {
        rows.push([`--- ${section.label} ---`, ...payers.map(() => '')])
        for (const row of section.rows) {
          const cells = payers.map(p => {
            const val = getCellValue(policyByPayer.get(p.id), row.key)
            return val.text
          })
          rows.push([row.field, ...cells])
        }
      }
      const csvContent = [headers, ...rows].map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${drugName.replace(/\s+/g, '_')}_comparison.csv`
      a.click()
      URL.revokeObjectURL(url)
    }

    const exportPDF = () => {
      const printWindow = window.open('', '_blank')
      if (!printWindow) return
      const tableRows = sections.flatMap(section => [
        `<tr style="background:#f8fafc"><td colspan="${payers.length + 1}" style="padding:8px 12px;font-weight:bold;font-size:11px;text-transform:uppercase;color:#6366f1;letter-spacing:1px">${section.label}</td></tr>`,
        ...section.rows.map(row => {
          const cells = payers.map(p => {
            const val = getCellValue(policyByPayer.get(p.id), row.key)
            return `<td style="padding:8px 12px;font-size:12px;border-bottom:1px solid #f1f5f9">${val.text}</td>`
          })
          return `<tr><td style="padding:8px 12px;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;border-bottom:1px solid #f1f5f9">${row.field}</td>${cells.join('')}</tr>`
        }),
      ])
      const html = `<!DOCTYPE html><html><head><title>${drugName} — Payer Comparison</title><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;margin:40px;color:#1e293b}table{width:100%;border-collapse:collapse;border:1px solid #e2e8f0}th{text-align:left;padding:10px 12px;background:#f8fafc;font-size:12px;font-weight:700;border-bottom:2px solid #e2e8f0}h1{font-size:20px;margin-bottom:4px}p{color:#64748b;font-size:13px;margin-top:0}.footer{margin-top:20px;font-size:11px;color:#94a3b8}@media print{body{margin:20px}}</style></head><body><h1>${drugName}</h1><p>${subtitle || ''}</p><table><thead><tr><th>Field</th>${payers.map(p => `<th>${p.name}</th>`).join('')}</tr></thead><tbody>${tableRows.join('')}</tbody></table><p class="footer">Exported from AntonRx · ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p></body></html>`
      printWindow.document.write(html)
      printWindow.document.close()
      printWindow.onload = () => { printWindow.print() }
    }

    return (
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">{drugName}</h3>
              {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
            </div>
            <div className="flex items-center gap-2">
              {coveredCount > 0 && (
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  {coveredCount} Covered
                </span>
              )}
              {restrictedCount > 0 && (
                <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  {restrictedCount} Restricted
                </span>
              )}
              <span className="w-px h-4 bg-slate-200" />
              <button
                onClick={exportCSV}
                className="flex items-center gap-1 text-[10px] font-semibold text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors"
              >
                <Download className="w-3 h-3" /> CSV
              </button>
              <button
                onClick={exportPDF}
                className="flex items-center gap-1 text-[10px] font-semibold text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors"
              >
                <Download className="w-3 h-3" /> PDF
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            {/* Column headers */}
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-4 py-3 w-[180px]">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Field</span>
                </th>
                {payers.map(payer => {
                  const pol = policyByPayer.get(payer.id)
                  const date = pol?.effective_date || pol?.last_updated || ''
                  const planType = pol?.therapeutic_area ? 'Commercial' : ''
                  return (
                    <th key={payer.id} className="text-left px-3 py-3 min-w-[180px]">
                      <p className="text-sm font-bold text-slate-800">{payer.name}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {planType}{planType && date ? ' · ' : ''}{date ? new Date(date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : ''}
                      </p>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {sections.map(section => (
                <>
                  {/* Section header */}
                  <tr key={`sh-${section.label}`} className="bg-slate-50/60">
                    <td colSpan={payers.length + 1} className="px-4 py-2">
                      <span className={cn('text-[10px] font-bold uppercase tracking-wider', section.color)}>
                        {section.label}
                      </span>
                    </td>
                  </tr>
                  {/* Section rows */}
                  {section.rows.map(row => (
                    <tr key={row.key} className="border-b border-slate-50 hover:bg-slate-50/30 transition-colors">
                      <td className="px-4 py-2.5">
                        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{row.field}</span>
                      </td>
                      {payers.map(payer => (
                        <td key={payer.id} className="px-3 py-2.5">
                          {renderCell(getCellValue(policyByPayer.get(payer.id), row.key))}
                        </td>
                      ))}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-slate-50/50 border-t border-slate-100">
          <p className="text-[10px] text-slate-400">
            Data sourced from payer policy documents · {policies.length} plans compared · Last updated {new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </p>
        </div>
      </div>
    )
  }

  // Multi-drug comparison — render one DrugComparisonCard per drug
  const drugEntries = Array.from(byDrug.entries())
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900">Drug Coverage Comparison</h3>
          <p className="text-xs text-slate-500 mt-0.5">{byDrug.size} drugs × {payers.length} plans · All 8 criteria</p>
        </div>
      </div>
      {drugEntries.map(([name, drugPolicies]) => (
        <DrugComparisonTable
          key={name}
          policies={drugPolicies}
          drug={{
            name: drugPolicies[0]?.drug_name || name,
            generic_name: drugPolicies[0]?.generic_name,
            drug_category: drugPolicies[0]?.drug_category,
            therapeutic_area: drugPolicies[0]?.therapeutic_area,
          }}
        />
      ))}
    </div>
  )
}

// ============= POLICY DETAIL CARDS (right panel) =============

function PolicyDetailCards({ policies }: { policies: ApiAskResponse['relevant_policies'] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (policies.length === 0) return null

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800">Policy Details</h3>
        <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
          {policies.length} {policies.length === 1 ? 'policy' : 'policies'}
        </span>
      </div>
      <div className="divide-y divide-slate-100">
        {policies.map(pol => {
          const isOpen = expandedId === pol.id
          const coverageBadge = pol.covered
            ? (pol.access_status === 'preferred'
              ? { text: 'Preferred', cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' }
              : { text: 'Non-Preferred', cls: 'text-amber-700 bg-amber-50 border-amber-200' })
            : { text: 'Not Covered', cls: 'text-red-700 bg-red-50 border-red-200' }

          return (
            <div key={pol.id}>
              {/* Collapsed row */}
              <button
                onClick={() => setExpandedId(isOpen ? null : pol.id)}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50/50 transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800">{formatPayerName(pol.payer_id)}</span>
                    <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded-full border', coverageBadge.cls)}>
                      {coverageBadge.text}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                    {pol.drug_name}{pol.generic_name ? ` (${pol.generic_name})` : ''} · {pol.drug_category || 'Specialty'}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {pol.prior_auth && <span className="text-[8px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">Prior Auth</span>}
                  {pol.step_therapy && <span className="text-[8px] font-semibold text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded border border-violet-200">Step Therapy</span>}
                  <ChevronDown className={cn('w-3.5 h-3.5 text-slate-400 transition-transform', isOpen && 'rotate-180')} />
                </div>
              </button>

              {/* Expanded details — all 8 criteria */}
              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-3 space-y-2">
                      <div className="bg-slate-50 rounded-lg p-3 space-y-2.5 text-xs">
                        {/* 1. Drug Name */}
                        <DetailRow label="Drug" value={`${pol.drug_name}${pol.generic_name ? ` (${pol.generic_name})` : ''}`} />
                        {/* 2. Drug Category */}
                        <DetailRow label="Category" value={pol.drug_category || '—'} />
                        {/* 3. Access Status */}
                        <DetailRow label="Access Status">
                          <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border', coverageBadge.cls)}>
                            {coverageBadge.text}
                          </span>
                          {pol.preferred_count > 0 && (
                            <span className="text-[10px] text-slate-500 ml-1.5">
                              ({pol.preferred_count} preferred in class)
                            </span>
                          )}
                        </DetailRow>
                        {/* 4. Covered Indications */}
                        <DetailRow label="Indications" value={
                          pol.covered_indications?.length > 0
                            ? pol.covered_indications.join(', ')
                            : 'Not specified'
                        } muted={!pol.covered_indications?.length} />
                        {/* 5. Prior Authorization */}
                        <DetailRow label="Prior Auth" value={pol.prior_auth ? `Required — ${pol.prior_auth_details || 'See policy'}` : 'Not required'} muted={!pol.prior_auth} />
                        {/* 6. Step Therapy */}
                        <DetailRow label="Step Therapy" value={pol.step_therapy ? `Required — ${pol.step_therapy_details || 'See policy'}` : 'Not required'} muted={!pol.step_therapy} />
                        {/* 7. Site of Care */}
                        <DetailRow label="Site of Care" value={pol.site_of_care?.length > 0 ? pol.site_of_care.join(', ') : 'No restrictions'} muted={!pol.site_of_care?.length} />
                        {/* 8. Dosing Limits */}
                        <DetailRow label="Dosing Limits" value={pol.dosing_limits || 'No specific limits'} muted={!pol.dosing_limits} />
                        {/* Effective Date */}
                        <DetailRow label="Effective" value={pol.effective_date ? new Date(pol.effective_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'} />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DetailRow({ label, value, muted, children }: {
  label: string
  value?: string
  muted?: boolean
  children?: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider w-[90px] shrink-0 pt-0.5">{label}</span>
      {children || (
        <span className={cn('text-[11px] leading-snug flex-1', muted ? 'text-slate-400 italic' : 'text-slate-700')}>
          {value}
        </span>
      )}
    </div>
  )
}

// ============= SOURCE EVIDENCE WITH EVOLUTION =============

function SourceEvidenceItem({ source, policyId }: {
  source: ApiAskResponse['sources'][0]
  policyId?: string
}) {
  const [expanded, setExpanded] = useState(false)
  const [versions, setVersions] = useState<PolicyVersionRecord[]>([])
  const [loadingVersions, setLoadingVersions] = useState(false)

  const handleToggle = () => {
    const next = !expanded
    setExpanded(next)
    if (next && policyId && versions.length === 0 && !loadingVersions) {
      setLoadingVersions(true)
      fetchPolicyVersions(policyId)
        .then(v => setVersions(v))
        .finally(() => setLoadingVersions(false))
    }
  }

  const color = getPayerColor(source.payer_id || '')
  const pct = Math.round((source.score || 0) * 100)
  const excerpt = source.text.length > 120 ? source.text.slice(0, 120) + '...' : source.text

  return (
    <div className={cn('rounded-lg border overflow-hidden transition-all', color.bg, color.border)}>
      {/* Source header & excerpt */}
      <div className="p-3 space-y-1.5">
        <div className="flex items-start gap-2">
          <div className={cn('w-6 h-6 rounded flex items-center justify-center flex-shrink-0 mt-0.5 bg-gradient-to-br', color.gradient)}>
            <FileText className="w-3 h-3 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-slate-800">
              {formatPayerName(source.payer_id || '')}_{source.drug_id || 'policy'}.pdf
            </p>
            <p className="text-[10px] text-slate-500">
              {formatPayerName(source.payer_id || '')} · Clinical Policy · {pct}% match
            </p>
          </div>
        </div>
        <p className="text-[11px] italic text-slate-600 leading-relaxed pl-8">
          &ldquo;{excerpt}&rdquo;
        </p>
      </div>

      {/* Evolution toggle */}
      {policyId && (
        <button
          onClick={handleToggle}
          className="w-full flex items-center gap-1.5 px-3 py-2 border-t border-slate-200/60 text-[10px] font-semibold text-indigo-600 hover:bg-white/50 transition-colors"
        >
          <History className="w-3 h-3" />
          Policy Evolution
          <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }} className="ml-auto">
            <ChevronDown className="w-3 h-3" />
          </motion.div>
        </button>
      )}

      {/* Expanded evolution timeline */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1">
              {loadingVersions ? (
                <div className="flex items-center gap-2 py-2">
                  <div className="w-3 h-3 border border-indigo-300 border-t-transparent rounded-full animate-spin" />
                  <span className="text-[10px] text-slate-400">Loading history...</span>
                </div>
              ) : versions.length > 0 ? (
                <div className="relative ml-1">
                  <div className="absolute left-[4px] top-1 bottom-1 w-px bg-gradient-to-b from-indigo-300 via-violet-300 to-slate-200" />
                  <div className="space-y-2">
                    {versions.slice().reverse().map((v, idx) => {
                      const isLatest = idx === 0
                      const date = v.created_at ? new Date(v.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
                      const changes: string[] = []
                      if (v.change_summary) {
                        v.change_summary.split(';').slice(0, 4).forEach(c => {
                          const clean = c.trim()
                          if (clean) changes.push(clean)
                        })
                      }
                      return (
                        <div key={v.id} className="flex items-start gap-2.5 relative">
                          <div className={cn(
                            'w-[9px] h-[9px] rounded-full border-2 flex-shrink-0 mt-0.5 z-10',
                            isLatest ? 'bg-indigo-500 border-indigo-500' : 'bg-white border-slate-300'
                          )} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className={cn('text-[10px] font-bold', isLatest ? 'text-indigo-600' : 'text-slate-600')}>
                                v{v.version}
                              </span>
                              {isLatest && <span className="text-[8px] font-bold text-white bg-indigo-500 px-1 py-px rounded">CURRENT</span>}
                              {date && <span className="text-[9px] text-slate-400">{date}</span>}
                            </div>
                            {changes.length > 0 ? (
                              <div className="mt-0.5 space-y-0.5">
                                {changes.map((c, j) => (
                                  <p key={j} className="text-[9px] text-slate-500 leading-snug">{c}</p>
                                ))}
                              </div>
                            ) : idx === versions.length - 1 ? (
                              <p className="text-[9px] text-slate-400 mt-0.5">Initial policy record</p>
                            ) : null}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-[10px] text-slate-400">No version history available</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function SourceEvidence({ sources, policies }: {
  sources: ApiAskResponse['sources']
  policies: ApiAskResponse['relevant_policies']
}) {
  // Deduplicate by payer_id + drug_id
  const uniqueSources = useMemo(() => {
    const seen = new Set<string>()
    return sources.filter(s => {
      const key = `${s.payer_id || ''}-${s.drug_id || ''}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [sources])

  // Build policy_id lookup from sources
  const policyIdMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const s of sources) {
      if (s.policy_id && s.payer_id && s.drug_id) {
        map[`${s.payer_id}-${s.drug_id}`] = s.policy_id
      }
    }
    // Also try matching from policies array
    for (const p of policies) {
      const key = `${p.payer_id}-${p.drug_id}`
      if (!map[key]) map[key] = p.id
    }
    return map
  }, [sources, policies])

  if (uniqueSources.length === 0) return null

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800">Source Evidence</h3>
        <span className="text-[11px] text-indigo-600 font-medium cursor-pointer hover:underline">Page citations</span>
      </div>
      <div className="p-3 space-y-2">
        <div className="flex items-center gap-1.5 px-1 mb-1">
          <FileText className="w-3.5 h-3.5 text-indigo-500" />
          <span className="text-[11px] font-semibold text-slate-700">Documents referenced</span>
        </div>
        {uniqueSources.map((s, i) => {
          const key = `${s.payer_id || ''}-${s.drug_id || ''}`
          return (
            <SourceEvidenceItem
              key={i}
              source={s}
              policyId={policyIdMap[key]}
            />
          )
        })}
      </div>
    </div>
  )
}

// ============= QUICK ACTIONS =============

function QuickActions() {
  return (
    <div className="px-1">
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Quick Actions</p>
      <div className="flex flex-wrap gap-2">
        <button className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-700 bg-white border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors">
          <GitCompareArrows className="w-3 h-3" /> Compare all plans
        </button>
        <button className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-700 bg-white border border-rose-200 px-3 py-1.5 rounded-lg hover:bg-rose-50 transition-colors">
          <Copy className="w-3 h-3" /> Export answer
        </button>
        <button className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 bg-white border border-amber-200 px-3 py-1.5 rounded-lg hover:bg-amber-50 transition-colors">
          <Sparkles className="w-3 h-3" /> Rate this answer
        </button>
      </div>
    </div>
  )
}

// ============= MAIN COMPONENT =============

interface AIDashboardProps {
  query: string
}

export function AIDashboard({ query }: AIDashboardProps) {
  const [apiData, setApiData] = useState<{ drug: Drug; policies: PayerPolicy[]; allPolicies: PayerPolicy[] } | null>(null)
  const [aiResponse, setAiResponse] = useState<ApiAskResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [followUp, setFollowUp] = useState('')

  // Fetch from API on mount
  useEffect(() => {
    const q = query.toLowerCase()
    let drugId = 'rituximab'
    if (q.includes('humira')) drugId = 'humira'
    if (q.includes('adalimumab')) drugId = 'adalimumab'
    if (q.includes('bevacizumab')) drugId = 'bevacizumab'
    if (q.includes('botulinum') || q.includes('botox')) drugId = 'botulinum'
    if (q.includes('denosumab') || q.includes('prolia') || q.includes('xgeva')) drugId = 'denosumab'
    if (q.includes('rituximab') || q.includes('rituxan')) drugId = 'rituximab'

    // Fetch structured data + AI answer in parallel
    Promise.allSettled([
      fetchComparison(drugId, Date.now()),
      askQuestion(query),
    ]).then(([compResult, aiResult]) => {
      if (compResult.status === 'fulfilled') {
        setApiData({ drug: compResult.value.drug, policies: compResult.value.policies, allPolicies: compResult.value.policies })
      } else {
        const drug = getDrugById(drugId)
        const policies = getPoliciesForDrug(drugId)
        if (drug) {
          setApiData({ drug, policies, allPolicies: payerPolicies })
        }
      }

      if (aiResult.status === 'fulfilled') {
        setAiResponse(aiResult.value)
      }
    }).finally(() => setLoading(false))
  }, [query])

  const dashboard = useMemo(() => {
    if (!apiData) {
      const drug = getDrugById('rituximab')
      const policies = getPoliciesForDrug('rituximab')
      return generateDashboard(query, policies, drug, payerPolicies)
    }
    return generateDashboard(query, apiData.policies, apiData.drug, apiData.allPolicies)
  }, [query, apiData])

  const renderWidget = (widget: Widget, i: number) => {
    const delay = 0.4 + i * 0.12
    return (
      <motion.div
        key={`${widget.type}-${i}`}
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay }}
      >
        {widget.type === 'quick-stats' && <QuickStatsWidget policies={widget.data.policies as PayerPolicy[]} drug={widget.data.drug as Drug | undefined} />}
        {widget.type === 'full-matrix' && <PolicyMatrix />}
        {widget.type === 'comparison-cards' && <ComparisonCardsWidget policies={widget.data.policies as PayerPolicy[]} drug={widget.data.drug as Drug | undefined} />}
        {widget.type === 'step-therapy-visual' && <StepTherapyVisualWidget policies={widget.data.policies as PayerPolicy[]} drug={widget.data.drug as Drug | null | undefined} />}
        {widget.type === 'site-of-care' && <SiteOfCareWidget policies={widget.data.policies as PayerPolicy[]} drug={widget.data.drug as Drug | undefined} />}
        {widget.type === 'key-insight' && <KeyInsightWidget text={widget.data.text as string} type={widget.data.type as string} />}
        {widget.type === 'coverage-verdict' && <CoverageVerdictWidget policies={widget.data.policies as PayerPolicy[]} payerName={widget.data.payerName as string} />}
        {widget.type === 'payer-breakdown' && <PayerBreakdownWidget policies={widget.data.policies as PayerPolicy[]} payerName={widget.data.payerName as string} />}
        {widget.type === 'policy-changes' && <PolicyChangesWidget />}
      </motion.div>
    )
  }

  const answerText = aiResponse?.answer || dashboard.summary
  const plainAnswer = answerText.replace(/\*\*/g, '').replace(/#/g, '')

  const handleFollowUp = (e: React.FormEvent) => {
    e.preventDefault()
    if (!followUp.trim()) return
    window.location.href = `/results?q=${encodeURIComponent(followUp)}`
  }

  // ── Loading state ──
  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-start gap-3 mb-6">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-white">Rx</span>
          </div>
          <div className="flex-1 space-y-3 pt-1">
            <p className="text-sm font-semibold text-slate-700">Analyzing policy documents...</p>
            <div className="space-y-2.5 max-w-md">
              {[1, 2, 3].map(i => (
                <motion.div
                  key={i}
                  className="h-3 rounded-full bg-slate-100"
                  initial={{ width: '30%' }}
                  animate={{ width: ['30%', '80%', '60%'] }}
                  transition={{ duration: 1.5, delay: i * 0.2, repeat: Infinity, repeatType: 'reverse' }}
                />
              ))}
            </div>
            <p className="text-xs text-slate-400">Searching across payer databases with Claude AI</p>
          </div>
        </div>
      </div>
    )
  }

  // ── Main render ──
  return (
    <div className="flex h-full">
      {/* ═══════ LEFT: Chat-style Q&A + Widgets ═══════ */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-slate-200">
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* User question bubble */}
          <motion.div
            className="flex items-start gap-3 justify-end"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white rounded-2xl rounded-tr-sm px-5 py-3 max-w-lg shadow-sm">
              <p className="text-sm leading-relaxed">{query}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
              JD
            </div>
          </motion.div>

          {/* AI Response */}
          <motion.div
            className="flex items-start gap-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center flex-shrink-0 shadow-sm">
              <span className="text-xs font-bold text-white">Rx</span>
            </div>
            <div className="flex-1 min-w-0 space-y-2.5">
              {/* Comparison table (if comparison query with structured data) */}
              {isComparisonQuery(query) && aiResponse?.relevant_policies && aiResponse.relevant_policies.length > 1 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <DrugComparisonTable
                    policies={aiResponse.relevant_policies}
                    drug={apiData?.drug ? { name: apiData.drug.name, generic_name: apiData.drug.genericName, drug_category: apiData.drug.drugCategory, therapeutic_area: apiData.drug.therapeuticArea } : undefined}
                  />
                </motion.div>
              )}

              {/* Answer card (text summary — shown below table for comparisons, or alone for non-comparisons) */}
              {(!isComparisonQuery(query) || !aiResponse?.relevant_policies || aiResponse.relevant_policies.length <= 1) && (
                <div className="bg-white rounded-2xl rounded-tl-sm border border-slate-200 p-5 shadow-sm">
                  {aiResponse ? (
                    <RenderedMarkdown text={answerText} />
                  ) : (
                    <p className="text-sm leading-relaxed text-slate-700">
                      {dashboard.summary.split(/(\*\*.*?\*\*)/).map((part, i) => {
                        if (part.startsWith('**') && part.endsWith('**')) {
                          return <strong key={i} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>
                        }
                        return <span key={i}>{part}</span>
                      })}
                    </p>
                  )}
                </div>
              )}

              {/* Tier / cost badge */}
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  {aiResponse ? 'Tier 2 — Claude AI RAG · ~$0.01' : 'Tier 1 — Structured DB · No LLM call · $0.00'}
                </span>
              </div>
            </div>
          </motion.div>

          {/* Quick Stats */}
          {apiData && apiData.policies.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <QuickStatsWidget policies={apiData.policies} drug={apiData.drug} />
            </motion.div>
          )}

          {/* Widgets — hide redundant ones when comparison table is already shown */}
          {dashboard.widgets
            .filter(w => w.type !== 'quick-stats')
            .filter(w => {
              if (isComparisonQuery(query) && aiResponse?.relevant_policies && aiResponse.relevant_policies.length > 1) {
                // Comparison table already covers these
                return !['full-matrix', 'comparison-cards', 'step-therapy-visual', 'site-of-care', 'key-insight'].includes(w.type)
              }
              return true
            })
            .map((widget, i) => renderWidget(widget, i))}
        </div>

        {/* Follow-up input (sticky bottom) */}
        <div className="border-t border-slate-200 bg-white px-6 py-3">
          <form onSubmit={handleFollowUp} className="flex items-center gap-2">
            <input
              type="text"
              value={followUp}
              onChange={e => setFollowUp(e.target.value)}
              placeholder="Ask a follow-up question..."
              className="flex-1 px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all placeholder:text-slate-400"
            />
            <button
              type="submit"
              disabled={!followUp.trim()}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              Send <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>

      {/* ═══════ RIGHT: Policy Matches + Sources + Actions ═══════ */}
      <div className="w-[500px] shrink-0 overflow-y-auto bg-slate-50/50 p-4 space-y-4 hidden lg:block">
        {/* Policy Details */}
        {aiResponse && aiResponse.relevant_policies.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <PolicyDetailCards policies={aiResponse.relevant_policies} />
          </motion.div>
        )}

        {/* Source Evidence */}
        {aiResponse && aiResponse.sources.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <SourceEvidence sources={aiResponse.sources} policies={aiResponse.relevant_policies} />
          </motion.div>
        )}

      </div>
    </div>
  )
}
