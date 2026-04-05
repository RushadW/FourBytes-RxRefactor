'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  GitCompareArrows, Calendar, ChevronLeft, ChevronRight,
  Plus, Minus, ArrowRight, AlertTriangle, CheckCircle2, Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface PolicyVersion {
  version: string
  date: string
  payer: string
  drug: string
  changes: DiffChange[]
}

interface DiffChange {
  field: string
  oldValue: string
  newValue: string
  type: 'added' | 'removed' | 'modified'
  severity: 'major' | 'minor' | 'info'
}

const policyVersions: PolicyVersion[] = [
  {
    version: 'v2026-Q1',
    date: '2026-01-15',
    payer: 'Cigna',
    drug: 'Rituximab',
    changes: [
      { field: 'Step Therapy', oldValue: 'Methotrexate for 8 weeks', newValue: 'Methotrexate for 12 weeks', type: 'modified', severity: 'major' },
      { field: 'Site of Care', oldValue: 'Hospital Outpatient, Infusion Center', newValue: 'Hospital Outpatient, Infusion Center, Home Infusion (new)', type: 'modified', severity: 'minor' },
      { field: 'Age Restriction', oldValue: '', newValue: 'No age restriction for oncology indications', type: 'added', severity: 'info' },
    ],
  },
  {
    version: 'v2025-Q4',
    date: '2025-10-01',
    payer: 'Cigna',
    drug: 'Rituximab',
    changes: [
      { field: 'Prior Auth Validity', oldValue: '6 months', newValue: '12 months', type: 'modified', severity: 'minor' },
      { field: 'Biosimilar Preference', oldValue: '', newValue: 'Biosimilar preferred for new starts', type: 'added', severity: 'major' },
    ],
  },
  {
    version: 'v2025-Q3',
    date: '2025-07-01',
    payer: 'Cigna',
    drug: 'Rituximab',
    changes: [
      { field: 'Coverage Criteria', oldValue: 'FDA-approved indication', newValue: 'FDA-approved indication or NCCN Category 1', type: 'modified', severity: 'minor' },
      { field: 'Lab Requirements', oldValue: 'CBC within 30 days', newValue: '', type: 'removed', severity: 'info' },
    ],
  },
  {
    version: 'v2025-Q2',
    date: '2025-04-01',
    payer: 'Cigna',
    drug: 'Rituximab',
    changes: [
      { field: 'Step Therapy', oldValue: 'No step therapy', newValue: 'Methotrexate for 8 weeks', type: 'added', severity: 'major' },
      { field: 'Documentation', oldValue: 'Basic clinical notes', newValue: 'Specialist letter + clinical notes + lab results', type: 'modified', severity: 'major' },
    ],
  },
]

const uhcVersions: PolicyVersion[] = [
  {
    version: 'v2026-Q1',
    date: '2026-01-01',
    payer: 'UnitedHealthcare',
    drug: 'Rituximab',
    changes: [
      { field: 'Home Infusion', oldValue: 'Not covered', newValue: 'Covered with nurse supervision', type: 'modified', severity: 'minor' },
      { field: 'PA Turnaround', oldValue: '5 business days', newValue: '3 business days', type: 'modified', severity: 'info' },
    ],
  },
  {
    version: 'v2025-Q4',
    date: '2025-10-15',
    payer: 'UnitedHealthcare',
    drug: 'Rituximab',
    changes: [
      { field: 'Digital Submission', oldValue: 'Fax only', newValue: 'CoverMyMeds portal + Fax', type: 'modified', severity: 'minor' },
    ],
  },
]

export function PolicyDiffView() {
  const [selectedPayer, setSelectedPayer] = useState<'cigna' | 'uhc' | 'bcbs'>('cigna')
  const [selectedVersionIdx, setSelectedVersionIdx] = useState(0)
  const [showSideBySide, setShowSideBySide] = useState(true)

  const versions = selectedPayer === 'cigna' ? policyVersions : uhcVersions

  const payers = [
    { id: 'cigna' as const, name: 'Cigna', color: 'bg-blue-500' },
    { id: 'uhc' as const, name: 'UHC', color: 'bg-green-500' },
    { id: 'bcbs' as const, name: 'BCBS', color: 'bg-purple-500' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/12 to-rose-500/10 ring-1 ring-border flex items-center justify-center">
            <GitCompareArrows className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Policy Diff Viewer</h2>
            <p className="text-sm text-muted-foreground">Track how policies evolve over time</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSideBySide(!showSideBySide)}
          className="text-xs"
        >
          {showSideBySide ? 'Timeline View' : 'Side-by-Side'}
        </Button>
      </div>

      {/* Payer selector */}
      <div className="flex gap-2">
        {payers.map((p) => (
          <button
            key={p.id}
            onClick={() => { setSelectedPayer(p.id); setSelectedVersionIdx(0) }}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-medium transition-all',
              selectedPayer === p.id
                ? 'bg-primary text-primary-foreground'
                : 'glass-card-light hover:bg-secondary/80'
            )}
          >
            <span className={cn('inline-block w-2 h-2 rounded-full mr-2', p.color)} />
            {p.name}
          </button>
        ))}
      </div>

      {/* Timeline slider */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedVersionIdx(Math.min(versions.length - 1, selectedVersionIdx + 1))}
            disabled={selectedVersionIdx >= versions.length - 1}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <div className="flex-1 relative">
            {/* Timeline line */}
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-border -translate-y-1/2" />
            
            <div className="relative flex justify-between">
              {versions.map((v, i) => (
                <button
                  key={v.version}
                  onClick={() => setSelectedVersionIdx(i)}
                  className="relative z-10 flex flex-col items-center gap-2"
                >
                  <motion.div
                    className={cn(
                      'w-4 h-4 rounded-full border-2 transition-all',
                      i === selectedVersionIdx
                        ? 'bg-primary border-primary scale-125'
                        : i < selectedVersionIdx
                        ? 'bg-muted-foreground/50 border-muted-foreground/50'
                        : 'bg-primary/50 border-primary/50'
                    )}
                    whileHover={{ scale: 1.3 }}
                  />
                  <span className={cn(
                    'text-xs whitespace-nowrap',
                    i === selectedVersionIdx ? 'text-primary font-semibold' : 'text-muted-foreground'
                  )}>
                    {v.version}
                  </span>
                  <span className="text-[10px] text-muted-foreground/60">{v.date}</span>
                </button>
              ))}
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedVersionIdx(Math.max(0, selectedVersionIdx - 1))}
            disabled={selectedVersionIdx <= 0}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Diff content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${selectedPayer}-${selectedVersionIdx}`}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="space-y-3"
        >
          {versions[selectedVersionIdx]?.changes.map((change, i) => (
            <motion.div
              key={`${change.field}-${i}`}
              className="glass-card rounded-xl overflow-hidden"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              {/* Change header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/20">
                <div className="flex items-center gap-2">
                  {change.type === 'added' && <Plus className="w-4 h-4 text-green-400" />}
                  {change.type === 'removed' && <Minus className="w-4 h-4 text-red-400" />}
                  {change.type === 'modified' && <GitCompareArrows className="w-4 h-4 text-yellow-400" />}
                  <span className="font-medium text-sm">{change.field}</span>
                </div>
                <span className={cn(
                  'text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase',
                  change.severity === 'major' && 'bg-red-500/20 text-red-400',
                  change.severity === 'minor' && 'bg-yellow-500/20 text-yellow-400',
                  change.severity === 'info' && 'bg-blue-500/20 text-blue-400',
                )}>
                  {change.severity}
                </span>
              </div>

              {/* Diff body */}
              <div className={cn('p-4', showSideBySide ? 'grid grid-cols-2 gap-4' : 'space-y-3')}>
                {change.oldValue && (
                  <div className={cn(
                    'rounded-lg p-3',
                    change.type === 'removed' ? 'bg-red-500/10 border border-red-500/20' : 'bg-secondary/50'
                  )}>
                    <div className="flex items-center gap-1 mb-1">
                      <Minus className="w-3 h-3 text-red-400" />
                      <span className="text-[10px] uppercase text-red-400 font-semibold">Before</span>
                    </div>
                    <p className="text-sm text-rose-800/90 line-through decoration-rose-400/50">
                      {change.oldValue}
                    </p>
                  </div>
                )}
                {change.newValue && (
                  <div className={cn(
                    'rounded-lg p-3',
                    change.type === 'added' ? 'bg-green-500/10 border border-green-500/20' : 'bg-green-500/5 border border-green-500/10'
                  )}>
                    <div className="flex items-center gap-1 mb-1">
                      <Plus className="w-3 h-3 text-green-400" />
                      <span className="text-[10px] uppercase text-green-400 font-semibold">After</span>
                    </div>
                    <p className="text-sm text-emerald-900 font-medium">
                      {change.newValue}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          ))}

          {/* Summary */}
          <div className="glass-card rounded-xl p-4 mt-4">
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Version Summary</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 rounded-lg bg-red-500/10">
                <div className="text-lg font-bold text-red-600 tabular-nums">
                  {versions[selectedVersionIdx]?.changes.filter(c => c.severity === 'major').length || 0}
                </div>
                <div className="text-[10px] text-muted-foreground uppercase">Major</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-yellow-500/10">
                <div className="text-lg font-bold text-amber-600 tabular-nums">
                  {versions[selectedVersionIdx]?.changes.filter(c => c.severity === 'minor').length || 0}
                </div>
                <div className="text-[10px] text-muted-foreground uppercase">Minor</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-blue-500/10">
                <div className="text-lg font-bold text-primary tabular-nums">
                  {versions[selectedVersionIdx]?.changes.filter(c => c.severity === 'info').length || 0}
                </div>
                <div className="text-[10px] text-muted-foreground uppercase">Info</div>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
