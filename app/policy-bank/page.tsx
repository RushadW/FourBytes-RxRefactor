'use client'

import { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Download, ExternalLink, Filter, ChevronDown, ChevronUp,
  Shield, ShieldCheck, ShieldX, FileText, Clock, Building2, Pill,
  RefreshCw,
} from 'lucide-react'
import {
  fetchPolicyBank,
  getDocumentDownloadUrl,
  type PolicyBankItem,
} from '@/lib/api'
import { cn } from '@/lib/utils'

type SortKey = 'drug_name' | 'payer_name' | 'last_updated' | 'version'
type SortDir = 'asc' | 'desc'

export default function PolicyBankPage() {
  const [policies, setPolicies] = useState<PolicyBankItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [payerFilter, setPayerFilter] = useState<string>('all')
  const [coverageFilter, setCoverageFilter] = useState<string>('all')
  const [sortKey, setSortKey] = useState<SortKey>('drug_name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    loadPolicies()
  }, [])

  async function loadPolicies() {
    setLoading(true)
    try {
      const data = await fetchPolicyBank()
      setPolicies(data)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  const payers = useMemo(() => {
    const set = new Set(policies.map(p => p.payer_name))
    return Array.from(set).sort()
  }, [policies])

  const filtered = useMemo(() => {
    let list = [...policies]

    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        p =>
          p.drug_name.toLowerCase().includes(q) ||
          p.payer_name.toLowerCase().includes(q) ||
          p.policy_title.toLowerCase().includes(q) ||
          p.generic_name.toLowerCase().includes(q) ||
          p.drug_category.toLowerCase().includes(q)
      )
    }

    if (payerFilter !== 'all') {
      list = list.filter(p => p.payer_name === payerFilter)
    }

    if (coverageFilter !== 'all') {
      if (coverageFilter === 'covered') list = list.filter(p => p.covered === true)
      else if (coverageFilter === 'not_covered') list = list.filter(p => p.covered === false)
    }

    list.sort((a, b) => {
      const aVal = (a[sortKey] ?? '').toString().toLowerCase()
      const bVal = (b[sortKey] ?? '').toString().toLowerCase()
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })

    return list
  }, [policies, search, payerFilter, coverageFilter, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronDown className="w-3 h-3 opacity-25" />
    return sortDir === 'asc' ? (
      <ChevronUp className="w-3 h-3 text-primary" />
    ) : (
      <ChevronDown className="w-3 h-3 text-primary" />
    )
  }

  function coverageBadge(covered: boolean | null) {
    if (covered === true)
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/12 text-emerald-700 border border-emerald-500/25">
          <ShieldCheck className="w-3 h-3" /> Covered
        </span>
      )
    if (covered === false)
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-700 border border-rose-500/25">
          <ShieldX className="w-3 h-3" /> Not covered
        </span>
      )
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-muted text-muted-foreground border border-border">
        <Shield className="w-3 h-3" /> Unknown
      </span>
    )
  }

  return (
    <div className="min-h-screen pb-12">
      <div className="sticky top-0 z-20 border-b border-border/80 bg-card/85 backdrop-blur-xl supports-[backdrop-filter]:bg-card/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight flex items-center gap-2.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-teal-500/10 ring-1 ring-border">
                  <FileText className="w-5 h-5 text-primary" />
                </span>
                Policy Bank
              </h1>
              <p className="text-sm text-muted-foreground mt-2">
                <span className="font-medium text-foreground tabular-nums">{policies.length}</span>
                {' '}policies ·{' '}
                <span className="font-medium text-foreground tabular-nums">{payers.length}</span>
                {' '}payers
              </p>
            </div>
            <button
              type="button"
              onClick={loadPolicies}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90 transition-colors disabled:opacity-50 self-start sm:self-center"
            >
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
              Refresh
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search drugs, payers, policies…"
                className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-muted/40 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-shadow"
              />
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-2 py-1 shadow-sm">
              <Filter className="w-4 h-4 text-muted-foreground ml-1" />
              <select
                value={payerFilter}
                onChange={e => setPayerFilter(e.target.value)}
                className="py-2 pl-1 pr-8 text-sm bg-transparent text-foreground font-medium focus:outline-none cursor-pointer"
              >
                <option value="all">All payers</option>
                {payers.map(payerName => (
                  <option key={payerName} value={payerName}>{payerName}</option>
                ))}
              </select>
            </div>

            <select
              value={coverageFilter}
              onChange={e => setCoverageFilter(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-border bg-card text-sm font-medium text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">All coverage</option>
              <option value="covered">Covered</option>
              <option value="not_covered">Not covered</option>
            </select>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-28 gap-3">
            <RefreshCw className="w-8 h-8 text-primary animate-spin" />
            <span className="text-sm text-muted-foreground">Loading policies…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 py-20 text-center">
            <p className="text-sm text-muted-foreground">No policies match your filters.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border/90 bg-card soft-shadow-lg overflow-hidden">
            <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_auto] gap-2 px-4 py-3 bg-muted/35 border-b border-border text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              <button type="button" onClick={() => toggleSort('drug_name')} className="flex items-center gap-1.5 hover:text-foreground transition-colors text-left">
                <Pill className="w-3.5 h-3.5 opacity-70" /> Drug <SortIcon col="drug_name" />
              </button>
              <button type="button" onClick={() => toggleSort('payer_name')} className="flex items-center gap-1.5 hover:text-foreground transition-colors text-left">
                <Building2 className="w-3.5 h-3.5 opacity-70" /> Payer <SortIcon col="payer_name" />
              </button>
              <span className="self-center">Coverage</span>
              <button type="button" onClick={() => toggleSort('last_updated')} className="flex items-center gap-1.5 hover:text-foreground transition-colors text-left">
                <Clock className="w-3.5 h-3.5 opacity-70" /> Updated <SortIcon col="last_updated" />
              </button>
              <button type="button" onClick={() => toggleSort('version')} className="flex items-center gap-1.5 hover:text-foreground transition-colors text-left">
                Version <SortIcon col="version" />
              </button>
              <span className="text-center self-center">Actions</span>
            </div>

            <AnimatePresence initial={false}>
              {filtered.map((p, idx) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15, delay: Math.min(idx * 0.012, 0.2) }}
                >
                  <div
                    className={cn(
                      'grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_auto] gap-2 px-4 py-3.5 items-center cursor-pointer transition-colors border-b border-border/50 last:border-b-0',
                      idx % 2 === 1 && 'bg-muted/20',
                      expandedId === p.id ? 'bg-primary/[0.04] ring-inset ring-1 ring-primary/15' : 'hover:bg-muted/35'
                    )}
                    onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                  >
                    <div>
                      <p className="text-sm font-semibold text-foreground">{p.drug_name}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{p.generic_name || p.drug_category}</p>
                    </div>

                    <div className="text-sm text-foreground/85">{p.payer_name}</div>

                    <div>{coverageBadge(p.covered)}</div>

                    <div className="text-xs text-muted-foreground tabular-nums">{p.last_updated || p.effective_date || '—'}</div>

                    <div className="text-xs text-muted-foreground font-medium tabular-nums">v{p.version}</div>

                    <div className="flex items-center justify-end gap-0.5">
                      {p.document_id && (
                        <a
                          href={getDocumentDownloadUrl(p.document_id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                          title="Download PDF"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      )}
                      {p.source_url && !p.source_url.startsWith('manual_upload') && (
                        <a
                          href={p.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                          title="View source"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>

                  <AnimatePresence>
                    {expandedId === p.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden bg-muted/25"
                      >
                        <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs border-t border-border/60">
                          <div>
                            <p className="text-muted-foreground font-semibold mb-1 uppercase tracking-wide text-[10px]">Policy title</p>
                            <p className="text-foreground leading-relaxed">{p.policy_title || '—'}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground font-semibold mb-1 uppercase tracking-wide text-[10px]">Drug category</p>
                            <p className="text-foreground">{p.drug_category || '—'}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground font-semibold mb-1 uppercase tracking-wide text-[10px]">Access status</p>
                            <p className="text-foreground capitalize">{p.access_status || '—'}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground font-semibold mb-1 uppercase tracking-wide text-[10px]">Effective date</p>
                            <p className="text-foreground">{p.effective_date || '—'}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground font-semibold mb-1 uppercase tracking-wide text-[10px]">Generic name</p>
                            <p className="text-foreground">{p.generic_name || '—'}</p>
                          </div>
                          <div className="sm:col-span-2">
                            <p className="text-muted-foreground font-semibold mb-1 uppercase tracking-wide text-[10px]">Source</p>
                            <p className="text-foreground truncate max-w-full">
                              {p.source_url ? (
                                <a href={p.source_url} target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline">
                                  {(() => { try { return new URL(p.source_url).hostname } catch { return p.source_url } })()}
                                </a>
                              ) : '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground font-semibold mb-1 uppercase tracking-wide text-[10px]">Version</p>
                            <p className="text-foreground">v{p.version} · {p.last_updated || '—'}</p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}
