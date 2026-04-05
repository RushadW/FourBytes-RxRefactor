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
    if (sortKey !== col) return <ChevronDown className="w-3 h-3 opacity-30" />
    return sortDir === 'asc' ? (
      <ChevronUp className="w-3 h-3 text-indigo-400" />
    ) : (
      <ChevronDown className="w-3 h-3 text-indigo-400" />
    )
  }

  function coverageBadge(covered: boolean | null) {
    if (covered === true)
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
          <ShieldCheck className="w-3 h-3" /> Covered
        </span>
      )
    if (covered === false)
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-500/15 text-red-400 border border-red-500/20">
          <ShieldX className="w-3 h-3" /> Not Covered
        </span>
      )
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-500/15 text-slate-400 border border-slate-500/20">
        <Shield className="w-3 h-3" /> Unknown
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-[#0f1225]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0f1225]/95 backdrop-blur-md border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                Policy Bank
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">
                {policies.length} tracked policies across {payers.length} payers
              </p>
            </div>
            <button
              onClick={loadPolicies}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 border border-indigo-500/20 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
              Refresh
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search drugs, payers, policies..."
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/40"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={payerFilter}
                onChange={e => setPayerFilter(e.target.value)}
                className="px-2.5 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500/40"
              >
                <option value="all">All Payers</option>
                {payers.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <select
              value={coverageFilter}
              onChange={e => setCoverageFilter(e.target.value)}
              className="px-2.5 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500/40"
            >
              <option value="all">All Coverage</option>
              <option value="covered">Covered</option>
              <option value="not_covered">Not Covered</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="max-w-7xl mx-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <RefreshCw className="w-6 h-6 text-indigo-400 animate-spin" />
            <span className="ml-2 text-sm text-slate-400">Loading policies...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 text-slate-500 text-sm">
            No policies found matching your filters.
          </div>
        ) : (
          <div className="rounded-xl border border-white/[0.06] overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_auto] gap-2 px-4 py-2.5 bg-white/[0.03] border-b border-white/[0.06] text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <button onClick={() => toggleSort('drug_name')} className="flex items-center gap-1 hover:text-slate-300 transition-colors text-left">
                <Pill className="w-3 h-3" /> Drug <SortIcon col="drug_name" />
              </button>
              <button onClick={() => toggleSort('payer_name')} className="flex items-center gap-1 hover:text-slate-300 transition-colors text-left">
                <Building2 className="w-3 h-3" /> Payer <SortIcon col="payer_name" />
              </button>
              <span>Coverage</span>
              <button onClick={() => toggleSort('last_updated')} className="flex items-center gap-1 hover:text-slate-300 transition-colors text-left">
                <Clock className="w-3 h-3" /> Updated <SortIcon col="last_updated" />
              </button>
              <button onClick={() => toggleSort('version')} className="flex items-center gap-1 hover:text-slate-300 transition-colors text-left">
                Version <SortIcon col="version" />
              </button>
              <span className="text-center">Actions</span>
            </div>

            {/* Rows */}
            <AnimatePresence initial={false}>
              {filtered.map((p, idx) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15, delay: idx * 0.01 }}
                >
                  <div
                    className={cn(
                      'grid grid-cols-[2fr_1.5fr_1fr_1fr_1fr_auto] gap-2 px-4 py-3 items-center cursor-pointer transition-colors',
                      idx % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.015]',
                      expandedId === p.id ? 'bg-indigo-500/[0.05]' : 'hover:bg-white/[0.03]'
                    )}
                    onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                  >
                    {/* Drug */}
                    <div>
                      <p className="text-sm font-medium text-white">{p.drug_name}</p>
                      <p className="text-[11px] text-slate-500">{p.generic_name || p.drug_category}</p>
                    </div>

                    {/* Payer */}
                    <div className="text-sm text-slate-300">{p.payer_name}</div>

                    {/* Coverage */}
                    <div>{coverageBadge(p.covered)}</div>

                    {/* Updated */}
                    <div className="text-xs text-slate-400">{p.last_updated || p.effective_date || '—'}</div>

                    {/* Version */}
                    <div className="text-xs text-slate-400">v{p.version}</div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5">
                      {p.document_id && (
                        <a
                          href={getDocumentDownloadUrl(p.document_id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="p-1.5 rounded-md hover:bg-white/[0.08] text-slate-400 hover:text-indigo-300 transition-colors"
                          title="Download PDF"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {p.source_url && !p.source_url.startsWith('manual_upload') && (
                        <a
                          href={p.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="p-1.5 rounded-md hover:bg-white/[0.08] text-slate-400 hover:text-indigo-300 transition-colors"
                          title="View source"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Expanded details */}
                  <AnimatePresence>
                    {expandedId === p.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-6 py-4 bg-white/[0.02] border-t border-white/[0.04] grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                          <div>
                            <p className="text-slate-500 font-medium mb-1">Policy Title</p>
                            <p className="text-slate-300">{p.policy_title || '—'}</p>
                          </div>
                          <div>
                            <p className="text-slate-500 font-medium mb-1">Drug Category</p>
                            <p className="text-slate-300">{p.drug_category || '—'}</p>
                          </div>
                          <div>
                            <p className="text-slate-500 font-medium mb-1">Access Status</p>
                            <p className="text-slate-300 capitalize">{p.access_status || '—'}</p>
                          </div>
                          <div>
                            <p className="text-slate-500 font-medium mb-1">Effective Date</p>
                            <p className="text-slate-300">{p.effective_date || '—'}</p>
                          </div>
                          <div>
                            <p className="text-slate-500 font-medium mb-1">Generic Name</p>
                            <p className="text-slate-300">{p.generic_name || '—'}</p>
                          </div>
                          <div>
                            <p className="text-slate-500 font-medium mb-1">Source</p>
                            <p className="text-slate-300 truncate max-w-[300px]">
                              {p.source_url ? (
                                <a href={p.source_url} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">
                                  {(() => { try { return new URL(p.source_url).hostname } catch { return p.source_url } })()}
                                </a>
                              ) : '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-500 font-medium mb-1">Version</p>
                            <p className="text-slate-300">v{p.version} · Last updated {p.last_updated || '—'}</p>
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
