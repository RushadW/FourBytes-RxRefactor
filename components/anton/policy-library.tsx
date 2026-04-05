'use client'

import { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, Building2, Pill, Search, Filter, SlidersHorizontal,
  Calendar, Shield, Clock, ChevronRight, ExternalLink, Pin,
  PinOff, Download, MessageSquarePlus, BookOpen, Sparkles,
  CheckCircle2, AlertTriangle, TrendingUp, Eye, Star,
  StickyNote, X, ChevronDown, Hash,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getFilteredDocuments, drugs, policyDocuments } from '@/lib/mock-data'
import type { PolicyDocument } from '@/lib/mock-data'
import { cn } from '@/lib/utils'

// Payer color palette
const payerTheme: Record<string, { bg: string; text: string; border: string; dot: string; gradient: string }> = {
  cigna: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', dot: 'bg-sky-500', gradient: 'from-sky-500 to-sky-400' },
  uhc: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500', gradient: 'from-emerald-500 to-emerald-400' },
  bcbs: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', dot: 'bg-violet-500', gradient: 'from-violet-500 to-violet-400' },
}

function StrictnessBar({ score }: { score: number }) {
  const color = score > 70 ? 'bg-rose-400' : score > 45 ? 'bg-amber-400' : 'bg-emerald-400'
  const textColor = score > 70 ? 'text-rose-600' : score > 45 ? 'text-amber-600' : 'text-emerald-600'
  
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', color)}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      <span className={cn('text-[10px] font-bold tabular-nums', textColor)}>{score}</span>
    </div>
  )
}

interface AnnotationState {
  docId: string
  notes: string[]
}

function PolicyCard({
  doc,
  annotations,
  onAddNote,
  isPinned,
  onTogglePin,
}: {
  doc: PolicyDocument
  annotations: string[]
  onAddNote: (docId: string, note: string) => void
  isPinned: boolean
  onTogglePin: (docId: string) => void
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showNoteInput, setShowNoteInput] = useState(false)
  const [noteText, setNoteText] = useState('')
  const theme = payerTheme[doc.payerId] || payerTheme.cigna
  
  const statusConfig = {
    current: { label: 'Current', bg: 'bg-emerald-100', text: 'text-emerald-700', icon: CheckCircle2 },
    superseded: { label: 'Superseded', bg: 'bg-slate-100', text: 'text-slate-500', icon: Clock },
    draft: { label: 'Draft', bg: 'bg-amber-100', text: 'text-amber-700', icon: AlertTriangle },
  }[doc.status]
  const StatusIcon = statusConfig.icon

  const handleAddNote = () => {
    if (noteText.trim()) {
      onAddNote(doc.id, noteText.trim())
      setNoteText('')
      setShowNoteInput(false)
    }
  }
  
  return (
    <motion.div
      className={cn(
        'bg-white rounded-xl border overflow-hidden transition-all duration-200',
        isPinned ? `${theme.border} ring-2 ring-primary/20` : 'border-border/60',
        'hover:shadow-md'
      )}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Color accent bar */}
      <div className={cn('h-1 bg-gradient-to-r', theme.gradient)} />
      
      <div className="p-4">
        {/* Top row: status + payer + actions */}
        <div className="flex items-center gap-2 mb-3">
          <span className={cn('flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full', statusConfig.bg, statusConfig.text)}>
            <StatusIcon className="w-3 h-3" />
            {statusConfig.label}
          </span>
          <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', theme.bg, theme.text)}>
            {doc.payerName}
          </span>
          <span className="text-[10px] font-mono text-muted-foreground ml-auto">{doc.version}</span>
          
          <button
            onClick={(e) => { e.stopPropagation(); onTogglePin(doc.id) }}
            className={cn(
              'p-1 rounded-md transition-colors',
              isPinned ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
            )}
            title={isPinned ? 'Unpin' : 'Pin for analysis'}
          >
            {isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
          </button>
        </div>
        
        {/* Title */}
        <h3 className="text-sm font-semibold text-foreground leading-snug mb-2 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
          {doc.title}
        </h3>
        
        {/* Drug + metadata row */}
        <div className="flex items-center gap-3 mb-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Pill className="w-3 h-3" />
            {doc.drugName}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {new Date(doc.effectiveDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          <span className="flex items-center gap-1">
            <FileText className="w-3 h-3" />
            {doc.pageCount} pages
          </span>
        </div>
        
        {/* Strictness bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted-foreground">Restrictiveness</span>
          </div>
          <StrictnessBar score={doc.strictnessScore} />
        </div>
        
        {/* Key changes from prior */}
        <div className="bg-secondary/40 rounded-lg px-3 py-2 mb-3">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">Key changes</p>
          <p className="text-xs text-foreground/80">{doc.keyChangesFromPrior}</p>
        </div>
        
        {/* Expandable sections */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              {/* Sections */}
              <div className="mb-3">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Sections</p>
                <div className="flex flex-wrap gap-1">
                  {doc.sections.map(section => (
                    <span key={section} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-foreground/70 border border-border/40">
                      {section}
                    </span>
                  ))}
                </div>
              </div>
              
              {/* Last reviewed */}
              <div className="flex items-center gap-2 mb-3 text-[11px] text-muted-foreground">
                <Eye className="w-3 h-3" />
                <span>Last reviewed: {new Date(doc.lastReviewed).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </div>
              
              {/* Analyst notes */}
              {annotations.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <StickyNote className="w-3 h-3" />
                    Analyst Notes ({annotations.length})
                  </p>
                  <div className="space-y-1">
                    {annotations.map((note, i) => (
                      <div key={i} className="bg-amber-50 rounded-lg px-3 py-1.5 border border-amber-200/60">
                        <p className="text-xs text-amber-800">{note}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Add note */}
              {showNoteInput ? (
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                    placeholder="Add a note..."
                    className="flex-1 text-xs bg-secondary/50 rounded-lg px-3 py-2 outline-none border border-border/30 focus:border-primary/50"
                    autoFocus
                  />
                  <Button size="sm" variant="ghost" onClick={() => setShowNoteInput(false)} className="text-xs px-2">
                    <X className="w-3 h-3" />
                  </Button>
                  <Button size="sm" onClick={handleAddNote} className="text-xs px-3" disabled={!noteText.trim()}>Add</Button>
                </div>
              ) : (
                <button
                  onClick={() => setShowNoteInput(true)}
                  className="flex items-center gap-1.5 text-[11px] text-primary hover:text-primary/80 transition-colors mb-2"
                >
                  <MessageSquarePlus className="w-3 h-3" />
                  Add analyst note
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Footer actions */}
        <div className="flex items-center justify-between pt-2 border-t border-border/30">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronDown className={cn('w-3 h-3 transition-transform', isExpanded && 'rotate-180')} />
            {isExpanded ? 'Less' : 'More'}
          </button>
          <div className="flex items-center gap-1">
            <button className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors" title="Export">
              <Download className="w-3.5 h-3.5" />
            </button>
            <button className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors" title="View full document">
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// Main Policy Library component
export function PolicyLibrary() {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterPayer, setFilterPayer] = useState<string | null>(null)
  const [filterDrug, setFilterDrug] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string | null>(null)
  const [pinnedDocs, setPinnedDocs] = useState<Set<string>>(new Set())
  const [annotations, setAnnotations] = useState<Record<string, string[]>>({})
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  
  const filteredDocs = useMemo(() => {
    let docs = getFilteredDocuments({
      payerId: filterPayer || undefined,
      drugId: filterDrug || undefined,
      status: filterStatus || undefined,
    })
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      docs = docs.filter(d =>
        d.title.toLowerCase().includes(q) ||
        d.drugName.toLowerCase().includes(q) ||
        d.payerName.toLowerCase().includes(q) ||
        d.keyChangesFromPrior.toLowerCase().includes(q)
      )
    }
    
    // Pinned first
    return docs.sort((a, b) => {
      const aPinned = pinnedDocs.has(a.id) ? 1 : 0
      const bPinned = pinnedDocs.has(b.id) ? 1 : 0
      return bPinned - aPinned
    })
  }, [filterPayer, filterDrug, filterStatus, searchQuery, pinnedDocs])

  const handleTogglePin = useCallback((docId: string) => {
    setPinnedDocs(prev => {
      const next = new Set(prev)
      if (next.has(docId)) next.delete(docId)
      else next.add(docId)
      return next
    })
  }, [])

  const handleAddNote = useCallback((docId: string, note: string) => {
    setAnnotations(prev => ({
      ...prev,
      [docId]: [...(prev[docId] || []), note],
    }))
  }, [])
  
  const uniquePayers = useMemo(() => [...new Set(policyDocuments.map(d => d.payerId))], [])
  const uniqueDrugs = useMemo(() => [...new Set(policyDocuments.map(d => d.drugId))], [])
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Policy Library</h1>
        <p className="text-sm text-muted-foreground">Browse, annotate, and analyze all available policy documents.</p>
      </div>
      
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search policies by drug, payer, or keyword..."
          className="w-full pl-9 pr-4 py-2.5 text-sm bg-white rounded-xl border border-border focus:border-primary/50 focus:ring-2 focus:ring-primary/20 outline-none transition-all soft-shadow"
        />
      </div>
      
      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-2">
        <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
        
        {/* Payer filters */}
        <button
          onClick={() => setFilterPayer(null)}
          className={cn(
            'px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all',
            !filterPayer ? 'bg-primary text-white shadow-sm' : 'bg-white text-foreground/70 border border-border hover:border-primary/30'
          )}
        >
          All Payers
        </button>
        {uniquePayers.map(id => {
          const theme = payerTheme[id]
          const name = id === 'cigna' ? 'Cigna' : id === 'uhc' ? 'UHC' : 'BCBS'
          return (
            <button
              key={id}
              onClick={() => setFilterPayer(filterPayer === id ? null : id)}
              className={cn(
                'px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1.5',
                filterPayer === id
                  ? `${theme?.bg} ${theme?.text} border ${theme?.border}`
                  : 'bg-white text-foreground/70 border border-border hover:border-primary/30'
              )}
            >
              <div className={cn('w-1.5 h-1.5 rounded-full', theme?.dot)} />
              {name}
            </button>
          )
        })}
        
        <div className="w-px h-4 bg-border mx-1" />
        
        {/* Drug filters */}
        <button
          onClick={() => setFilterDrug(null)}
          className={cn(
            'px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all',
            !filterDrug ? 'bg-primary text-white shadow-sm' : 'bg-white text-foreground/70 border border-border hover:border-primary/30'
          )}
        >
          All Drugs
        </button>
        {uniqueDrugs.map(id => {
          const drug = drugs.find(d => d.id === id)
          return (
            <button
              key={id}
              onClick={() => setFilterDrug(filterDrug === id ? null : id)}
              className={cn(
                'px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all',
                filterDrug === id
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  : 'bg-white text-foreground/70 border border-border hover:border-primary/30'
              )}
            >
              {drug?.name || id}
            </button>
          )
        })}
        
        <div className="w-px h-4 bg-border mx-1" />
        
        {/* Status */}
        {['current', 'superseded'].map(status => (
          <button
            key={status}
            onClick={() => setFilterStatus(filterStatus === status ? null : status)}
            className={cn(
              'px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all capitalize',
              filterStatus === status
                ? status === 'current' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
                : 'bg-white text-foreground/70 border border-border hover:border-primary/30'
            )}
          >
            {status}
          </button>
        ))}
      </div>
      
      {/* Summary bar */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Showing <span className="font-semibold text-foreground">{filteredDocs.length}</span> document{filteredDocs.length !== 1 ? 's' : ''}
          {pinnedDocs.size > 0 && <span> · <Pin className="w-3 h-3 inline" /> {pinnedDocs.size} pinned</span>}
        </p>
        <button
          onClick={() => {/* placeholder for export */}}
          className="flex items-center gap-1.5 text-[11px] text-primary hover:text-primary/80 font-medium transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Export view
        </button>
      </div>
      
      {/* Document grid */}
      <div className="grid sm:grid-cols-2 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredDocs.map((doc, i) => (
            <motion.div key={doc.id} layout>
              <PolicyCard
                doc={doc}
                annotations={annotations[doc.id] || []}
                onAddNote={handleAddNote}
                isPinned={pinnedDocs.has(doc.id)}
                onTogglePin={handleTogglePin}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      
      {filteredDocs.length === 0 && (
        <div className="text-center py-16">
          <BookOpen className="w-8 h-8 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">No documents match your filters</p>
          <button
            onClick={() => { setFilterPayer(null); setFilterDrug(null); setFilterStatus(null); setSearchQuery('') }}
            className="text-xs text-primary hover:text-primary/80 mt-2"
          >
            Clear all filters
          </button>
        </div>
      )}
    </div>
  )
}
