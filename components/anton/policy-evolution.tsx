'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowUpRight, ArrowDownRight, Minus, Clock, Shield,
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  Sparkles, ChevronDown, ChevronRight, Pin, PinOff,
  MessageSquarePlus, FileText, Building2, Pill,
  Filter, SlidersHorizontal,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getPolicyEvolution, drugs } from '@/lib/mock-data'
import type { PolicyVersion, PolicyChange } from '@/lib/mock-data'
import { cn } from '@/lib/utils'

// Payer color map
const payerColors: Record<string, { bg: string; text: string; border: string; ring: string; dot: string; light: string }> = {
  cigna: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', ring: 'ring-indigo-200', dot: 'bg-indigo-700', light: 'bg-indigo-100' },
  uhc: { bg: 'bg-indigo-50', text: 'text-indigo-500', border: 'border-indigo-200', ring: 'ring-indigo-200', dot: 'bg-indigo-500', light: 'bg-indigo-100' },
  bcbs: { bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-200', ring: 'ring-violet-200', dot: 'bg-violet-500', light: 'bg-violet-100' },
}

// Direction config
const directionConfig = {
  restrictive: {
    icon: ArrowUpRight,
    label: 'More Restrictive',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    accent: 'bg-rose-500',
    glow: 'from-rose-100 to-rose-50',
    badge: 'bg-rose-100 text-rose-700 border-rose-200',
  },
  permissive: {
    icon: ArrowDownRight,
    label: 'More Permissive',
    bg: 'bg-teal-50',
    text: 'text-teal-700',
    border: 'border-teal-200',
    accent: 'bg-teal-500',
    glow: 'from-teal-100 to-teal-50',
    badge: 'bg-teal-100 text-teal-700 border-teal-200',
  },
  neutral: {
    icon: Minus,
    label: 'Neutral Change',
    bg: 'bg-slate-50',
    text: 'text-slate-600',
    border: 'border-slate-200',
    accent: 'bg-slate-400',
    glow: 'from-slate-100 to-slate-50',
    badge: 'bg-slate-100 text-slate-600 border-slate-200',
  },
}

// Impact meter
function ImpactMeter({ level }: { level: 'high' | 'medium' | 'low' }) {
  const bars = level === 'high' ? 3 : level === 'medium' ? 2 : 1
  const color = level === 'high' ? 'bg-rose-400' : level === 'medium' ? 'bg-amber-400' : 'bg-slate-300'
  
  return (
    <div className="flex items-center gap-1" title={`${level} impact`}>
      {[1, 2, 3].map(i => (
        <motion.div
          key={i}
          className={cn('w-1.5 rounded-full', i <= bars ? color : 'bg-slate-200')}
          style={{ height: 6 + i * 3 }}
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ delay: i * 0.1 }}
        />
      ))}
    </div>
  )
}

// Strictness gauge (not a bar — a radial "health" indicator)
function StrictnessGauge({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' }) {
  const circumference = 2 * Math.PI * 18
  const offset = circumference - (score / 100) * circumference
  const color = score > 70 ? '#f43f5e' : score > 45 ? '#f59e0b' : '#10b981'
  const label = score > 70 ? 'High' : score > 45 ? 'Moderate' : 'Low'
  const sizePx = size === 'sm' ? 36 : 48
  
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: sizePx, height: sizePx }}>
      <svg width={sizePx} height={sizePx} className="-rotate-90">
        <circle cx={sizePx/2} cy={sizePx/2} r={18} fill="none" stroke="#e2e8f0" strokeWidth={3} />
        <motion.circle
          cx={sizePx/2} cy={sizePx/2} r={18} fill="none" stroke={color} strokeWidth={3}
          strokeDasharray={circumference}
          strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      <span className="absolute text-[9px] font-bold" style={{ color }}>{score}</span>
    </div>
  )
}

// Single change "transformation card"
function ChangeCard({ change, index }: { change: PolicyChange; index: number }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const cfg = directionConfig[change.direction]
  const DirIcon = cfg.icon
  
  return (
    <motion.div
      className="relative"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.1 + index * 0.08 }}
    >
      <div
        className={cn(
          'rounded-xl border overflow-hidden cursor-pointer transition-all duration-300',
          cfg.border,
          isExpanded ? 'shadow-md' : 'hover:shadow-sm'
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Watercolor gradient top accent */}
        <div className={cn('h-1 bg-gradient-to-r', cfg.glow)} />
        
        <div className="p-4">
          {/* Header with section name and direction badge */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <DirIcon className={cn('w-4 h-4 flex-shrink-0', cfg.text)} />
              <span className="text-sm font-semibold text-foreground">{change.section}</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <ImpactMeter level={change.impact} />
              <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full border', cfg.badge)}>
                {cfg.label}
              </span>
            </div>
          </div>
          
          {/* Value transformation — the key visual */}
          <div className="relative">
            {/* Old value */}
            <div className="flex items-start gap-2 mb-2">
              <div className="w-5 h-5 rounded-md bg-rose-100/80 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-[10px] font-bold text-rose-500">–</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed line-through decoration-rose-300/60">
                {change.oldValue}
              </p>
            </div>
            
            {/* Animated transition arrow */}
            <div className="flex items-center ml-2 mb-2">
              <motion.div
                className="flex items-center gap-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 + index * 0.08 }}
              >
                <div className={cn('w-px h-4', change.direction === 'restrictive' ? 'bg-rose-200' : change.direction === 'permissive' ? 'bg-teal-200' : 'bg-slate-200')} />
                <ChevronDown className={cn('w-3 h-3', cfg.text)} />
              </motion.div>
            </div>
            
            {/* New value */}
            <div className="flex items-start gap-2">
              <div className={cn('w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5',
                change.direction === 'permissive' ? 'bg-teal-100/80' : change.direction === 'restrictive' ? 'bg-rose-100/80' : 'bg-slate-100/80'
              )}>
                <span className={cn('text-[10px] font-bold',
                  change.direction === 'permissive' ? 'text-teal-500' : change.direction === 'restrictive' ? 'text-rose-500' : 'text-slate-500'
                )}>+</span>
              </div>
              <p className={cn('text-xs font-medium leading-relaxed',
                change.direction === 'permissive' ? 'text-teal-800' : change.direction === 'restrictive' ? 'text-rose-800' : 'text-foreground'
              )}>
                {change.newValue}
              </p>
            </div>
          </div>
        </div>
        
        {/* AI Explanation — expandable */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 pt-2 border-t border-dashed border-border/40">
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Sparkles className="w-3 h-3 text-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-primary uppercase tracking-wider mb-1">AI Analysis</p>
                    <p className="text-xs text-foreground/80 leading-relaxed">{change.aiExplanation}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// Version "moment" on the timeline
function VersionMoment({ version, index, isLast }: { version: PolicyVersion; index: number; isLast: boolean }) {
  const [isOpen, setIsOpen] = useState(index === 0) // Latest version open by default
  const [isPinned, setIsPinned] = useState(false)
  const payer = payerColors[version.payerId] || payerColors.cigna
  
  const restrictiveCount = version.changes.filter(c => c.direction === 'restrictive').length
  const permissiveCount = version.changes.filter(c => c.direction === 'permissive').length
  
  return (
    <motion.div
      className="relative"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.12 }}
    >
      <div className="flex gap-4">
        {/* Timeline spine */}
        <div className="flex flex-col items-center">
          {/* Dot */}
          <motion.div
            className={cn(
              'w-4 h-4 rounded-full border-[3px] border-white shadow-sm z-10',
              payer.dot
            )}
            whileHover={{ scale: 1.3 }}
          />
          {/* Line */}
          {!isLast && (
            <div className="w-px flex-1 bg-gradient-to-b from-border to-transparent min-h-[24px]" />
          )}
        </div>
        
        {/* Content */}
        <div className="flex-1 pb-6 -mt-1">
          {/* Header bar */}
          <div
            className={cn(
              'rounded-xl border overflow-hidden cursor-pointer transition-all duration-200',
              isPinned ? `${payer.border} ring-2 ${payer.ring}` : 'border-border/60',
              'bg-white hover:shadow-sm'
            )}
            onClick={() => setIsOpen(!isOpen)}
          >
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* Date & version */}
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', payer.bg, payer.text)}>
                      {version.payerName}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground">{version.version}</span>
                    <span className="text-[10px] text-muted-foreground">·</span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(version.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  
                  {/* Summary */}
                  <p className="text-sm text-foreground leading-relaxed">{version.summary}</p>
                  
                  {/* Quick counts */}
                  <div className="flex items-center gap-3 mt-2">
                    {restrictiveCount > 0 && (
                      <span className="text-[10px] font-medium text-rose-600 flex items-center gap-1">
                        <ArrowUpRight className="w-3 h-3" />
                        {restrictiveCount} restrictive
                      </span>
                    )}
                    {permissiveCount > 0 && (
                      <span className="text-[10px] font-medium text-teal-600 flex items-center gap-1">
                        <ArrowDownRight className="w-3 h-3" />
                        {permissiveCount} permissive
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {version.changes.length} change{version.changes.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 flex-shrink-0">
                  <StrictnessGauge score={version.strictnessScore} size="sm" />
                  <button
                    onClick={(e) => { e.stopPropagation(); setIsPinned(!isPinned) }}
                    className={cn(
                      'p-1 rounded-md transition-colors',
                      isPinned ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                    )}
                    title={isPinned ? 'Unpin' : 'Pin for analysis'}
                  >
                    {isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                  </button>
                  <ChevronRight className={cn(
                    'w-4 h-4 text-muted-foreground transition-transform',
                    isOpen && 'rotate-90'
                  )} />
                </div>
              </div>
            </div>
          </div>
          
          {/* Expanded change cards */}
          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="pt-3 pl-3 space-y-2.5">
                  {version.changes.map((change, ci) => (
                    <ChangeCard key={change.id} change={change} index={ci} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}

// Strictness trend line
function StrictnessTrend({ versions }: { versions: PolicyVersion[] }) {
  const sorted = [...versions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const maxScore = Math.max(...sorted.map(v => v.strictnessScore), 100)
  const width = 100
  const height = 40
  const padding = 4
  
  const points = sorted.map((v, i) => ({
    x: padding + (i / Math.max(sorted.length - 1, 1)) * (width - padding * 2),
    y: height - padding - ((v.strictnessScore / maxScore) * (height - padding * 2)),
    score: v.strictnessScore,
    version: v,
  }))
  
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaD = `${pathD} L ${points[points.length - 1]?.x ?? padding} ${height - padding} L ${padding} ${height - padding} Z`
  
  return (
    <div className="bg-white rounded-xl border border-border/60 p-4 soft-shadow">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4 text-primary" />
        <span className="text-xs font-semibold text-foreground">Strictness Trend</span>
        <span className="text-[10px] text-muted-foreground ml-auto">Lower is better for patients</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-16">
        {/* Grid lines */}
        {[25, 50, 75].map(v => (
          <line key={v} x1={padding} x2={width - padding} y1={height - padding - ((v / maxScore) * (height - padding * 2))} y2={height - padding - ((v / maxScore) * (height - padding * 2))} stroke="#e2e8f0" strokeWidth={0.3} strokeDasharray="2 2" />
        ))}
        {/* Area fill */}
        <motion.path
          d={areaD}
          fill="url(#trendGradient)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        />
        {/* Line */}
        <motion.path
          d={pathD}
          fill="none"
          stroke="#6366f1"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
        {/* Dots */}
        {points.map((p, i) => (
          <motion.circle
            key={i}
            cx={p.x} cy={p.y} r={2.5}
            fill="white" stroke="#6366f1" strokeWidth={1.5}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3 + i * 0.1 }}
          >
            <title>{`${p.version.payerName} ${p.version.version}: ${p.score}`}</title>
          </motion.circle>
        ))}
        <defs>
          <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.15} />
            <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
          </linearGradient>
        </defs>
      </svg>
      {/* Labels */}
      <div className="flex justify-between mt-1">
        {points.length > 0 && (
          <>
            <span className="text-[9px] text-muted-foreground">
              {new Date(sorted[0].date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
            </span>
            <span className="text-[9px] text-muted-foreground">
              {new Date(sorted[sorted.length - 1].date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
            </span>
          </>
        )}
      </div>
    </div>
  )
}

// Main Policy Evolution component
export function PolicyEvolution() {
  const [selectedDrug, setSelectedDrug] = useState('rituximab')
  const [selectedPayer, setSelectedPayer] = useState<string | null>(null)
  
  const versions = useMemo(
    () => getPolicyEvolution(selectedDrug, selectedPayer || undefined),
    [selectedDrug, selectedPayer]
  )

  const allPayerIds = useMemo(() => {
    const ids = new Set(getPolicyEvolution(selectedDrug).map(v => v.payerId))
    return Array.from(ids)
  }, [selectedDrug])
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Policy Evolution</h1>
        <p className="text-sm text-muted-foreground">Track how drug coverage policies change over time. Click any version to see detailed changes.</p>
      </div>
      
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Drug selector */}
        <div className="flex items-center gap-2">
          <Pill className="w-4 h-4 text-muted-foreground" />
          <div className="flex gap-1">
            {drugs.map(drug => (
              <button
                key={drug.id}
                onClick={() => setSelectedDrug(drug.id)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  selectedDrug === drug.id
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-white text-foreground/70 border border-border hover:border-primary/30'
                )}
              >
                {drug.name}
              </button>
            ))}
          </div>
        </div>
        
        {/* Payer filter */}
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-muted-foreground" />
          <div className="flex gap-1">
            <button
              onClick={() => setSelectedPayer(null)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                !selectedPayer
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-white text-foreground/70 border border-border hover:border-primary/30'
              )}
            >
              All Payers
            </button>
            {allPayerIds.map(id => {
              const colors = payerColors[id]
              return (
                <button
                  key={id}
                  onClick={() => setSelectedPayer(id)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5',
                    selectedPayer === id
                      ? `${colors?.bg} ${colors?.text} border ${colors?.border}`
                      : 'bg-white text-foreground/70 border border-border hover:border-primary/30'
                  )}
                >
                  <div className={cn('w-2 h-2 rounded-full', colors?.dot)} />
                  {id === 'cigna' ? 'Cigna' : id === 'uhc' ? 'UHC' : 'BCBS'}
                </button>
              )
            })}
          </div>
        </div>
      </div>
      
      {/* Stats & trend */}
      {versions.length > 1 && <StrictnessTrend versions={versions} />}
      
      {/* Timeline */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Version History</span>
          <span className="text-[10px] text-muted-foreground">· {versions.length} version{versions.length !== 1 ? 's' : ''}</span>
        </div>
        
        {versions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No policy versions found for this selection</p>
          </div>
        ) : (
          <div className="ml-1">
            {versions.map((version, i) => (
              <VersionMoment
                key={version.id}
                version={version}
                index={i}
                isLast={i === versions.length - 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
