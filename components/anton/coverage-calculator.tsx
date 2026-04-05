'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  TreePine, ChevronRight, CheckCircle2, XCircle, AlertTriangle,
  Pill, Building2, Stethoscope, FlaskConical, ArrowRight, RotateCcw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface TreeNode {
  id: string
  question: string
  icon: React.ReactNode
  options: {
    label: string
    nextId: string | null
    result?: 'approved' | 'denied' | 'step-therapy' | 'more-info'
    details?: string
  }[]
}

const decisionTree: TreeNode[] = [
  {
    id: 'drug',
    question: 'Which drug are you checking coverage for?',
    icon: <Pill className="w-5 h-5" />,
    options: [
      { label: 'Rituximab', nextId: 'payer' },
      { label: 'Humira (Adalimumab)', nextId: 'payer' },
      { label: 'Bevacizumab', nextId: 'payer' },
    ],
  },
  {
    id: 'payer',
    question: 'Which health plan is the patient covered by?',
    icon: <Building2 className="w-5 h-5" />,
    options: [
      { label: 'Cigna', nextId: 'indication' },
      { label: 'UnitedHealthcare', nextId: 'indication' },
      { label: 'Blue Cross Blue Shield', nextId: 'indication' },
    ],
  },
  {
    id: 'indication',
    question: 'What is the primary indication?',
    icon: <Stethoscope className="w-5 h-5" />,
    options: [
      { label: 'Oncology (Cancer)', nextId: 'prior-therapy' },
      { label: 'Autoimmune / Rheumatology', nextId: 'prior-therapy-auto' },
      { label: 'Other FDA-approved indication', nextId: 'prior-therapy' },
    ],
  },
  {
    id: 'prior-therapy',
    question: 'Has the patient tried first-line therapy?',
    icon: <FlaskConical className="w-5 h-5" />,
    options: [
      { label: 'Yes — documented failure/intolerance', nextId: null, result: 'approved', details: 'Based on the selected criteria, this drug is **likely to be approved**. Prior authorization will still be required. Estimated PA turnaround: 3-5 business days.' },
      { label: 'No — first-line not yet attempted', nextId: null, result: 'step-therapy', details: 'This payer requires **step therapy** for this indication. The patient must try first-line treatment before this drug will be covered.' },
      { label: 'Not applicable for this indication', nextId: null, result: 'more-info', details: 'Additional clinical documentation may be required. Contact the payer directly to confirm coverage for this specific use case.' },
    ],
  },
  {
    id: 'prior-therapy-auto',
    question: 'Has the patient tried conventional DMARDs?',
    icon: <FlaskConical className="w-5 h-5" />,
    options: [
      { label: 'Yes — tried methotrexate 12+ weeks', nextId: null, result: 'approved', details: 'Coverage is **likely approved**. All documentation of DMARD failure should be included with the PA submission.' },
      { label: 'Yes — tried other DMARDs but not MTX', nextId: null, result: 'step-therapy', details: 'Some payers (Cigna, BCBS) specifically require **methotrexate** trial. Check payer-specific step therapy requirements.' },
      { label: 'No — starting biologic first', nextId: null, result: 'denied', details: 'Most payers **require conventional DMARD trial** before approving biologic therapy for autoimmune indications. Start step therapy process first.' },
    ],
  },
]

export function CoverageCalculator() {
  const [currentNodeId, setCurrentNodeId] = useState('drug')
  const [history, setHistory] = useState<{ nodeId: string; selectedOption: string }[]>([])
  const [result, setResult] = useState<{ type: string; details: string } | null>(null)
  const [selections, setSelections] = useState<Record<string, string>>({})

  const currentNode = decisionTree.find(n => n.id === currentNodeId)

  const handleSelect = (option: typeof decisionTree[0]['options'][0]) => {
    setSelections(prev => ({ ...prev, [currentNodeId]: option.label }))
    setHistory(prev => [...prev, { nodeId: currentNodeId, selectedOption: option.label }])
    
    if (option.result) {
      setResult({ type: option.result, details: option.details || '' })
    } else if (option.nextId) {
      setCurrentNodeId(option.nextId)
    }
  }

  const handleReset = () => {
    setCurrentNodeId('drug')
    setHistory([])
    setResult(null)
    setSelections({})
  }

  const handleBack = () => {
    if (history.length > 0) {
      const prev = history[history.length - 1]
      setHistory(h => h.slice(0, -1))
      setCurrentNodeId(prev.nodeId)
      setResult(null)
      const newSelections = { ...selections }
      delete newSelections[prev.nodeId]
      setSelections(newSelections)
    }
  }

  const progress = result ? 100 : (history.length / (decisionTree.length - 1)) * 100

  const resultConfig = {
    approved: { icon: <CheckCircle2 className="w-8 h-8" />, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30', label: 'Likely Approved' },
    denied: { icon: <XCircle className="w-8 h-8" />, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', label: 'Likely Denied' },
    'step-therapy': { icon: <AlertTriangle className="w-8 h-8" />, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30', label: 'Step Therapy Required' },
    'more-info': { icon: <AlertTriangle className="w-8 h-8" />, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30', label: 'More Information Needed' },
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
            <TreePine className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Coverage Calculator</h2>
            <p className="text-sm text-muted-foreground">Interactive coverage eligibility check</p>
          </div>
        </div>
        {history.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleReset} className="gap-2">
            <RotateCcw className="w-3 h-3" /> Reset
          </Button>
        )}
      </div>

      {/* Progress bar */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">Progress</span>
          <span className="text-xs text-primary font-medium">{Math.round(progress)}%</span>
        </div>
        <div className="h-2 bg-secondary rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>

        {/* Breadcrumb */}
        {history.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 mt-3">
            {history.map((h, i) => (
              <div key={i} className="flex items-center gap-1">
                <span className="text-xs px-2 py-0.5 rounded-md bg-primary/10 text-primary">
                  {h.selectedOption}
                </span>
                {i < history.length - 1 && (
                  <ChevronRight className="w-3 h-3 text-muted-foreground" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Decision tree node */}
      <AnimatePresence mode="wait">
        {!result && currentNode && (
          <motion.div
            key={currentNodeId}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            className="glass-card rounded-xl p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
                {currentNode.icon}
              </div>
              <h3 className="text-lg font-semibold">{currentNode.question}</h3>
            </div>

            <div className="space-y-3">
              {currentNode.options.map((option, i) => (
                <motion.button
                  key={option.label}
                  className="w-full flex items-center justify-between p-4 rounded-xl glass-card-light hover:bg-secondary/80 transition-all group text-left"
                  onClick={() => handleSelect(option)}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  whileHover={{ x: 4 }}
                >
                  <span className="text-sm font-medium">{option.label}</span>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </motion.button>
              ))}
            </div>

            {history.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="mt-4 text-muted-foreground"
              >
                ← Back
              </Button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={cn(
              'rounded-xl p-6 border',
              resultConfig[result.type as keyof typeof resultConfig]?.bg
            )}
          >
            <div className="flex items-center gap-4 mb-4">
              <motion.div
                className={resultConfig[result.type as keyof typeof resultConfig]?.color}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.2 }}
              >
                {resultConfig[result.type as keyof typeof resultConfig]?.icon}
              </motion.div>
              <div>
                <h3 className={cn('text-xl font-bold', resultConfig[result.type as keyof typeof resultConfig]?.color)}>
                  {resultConfig[result.type as keyof typeof resultConfig]?.label}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {selections.drug} • {selections.payer} • {selections.indication}
                </p>
              </div>
            </div>

            <div className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
              {result.details.split(/(\*\*.*?\*\*)/).map((part, i) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                  return <strong key={i}>{part.slice(2, -2)}</strong>
                }
                return <span key={i}>{part}</span>
              })}
            </div>

            <div className="flex gap-3 mt-6">
              <Button onClick={handleReset} variant="outline" size="sm" className="gap-2">
                <RotateCcw className="w-3 h-3" /> Check Another
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Visual decision path */}
      {(history.length > 0 || result) && (
        <motion.div
          className="glass-card rounded-xl p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Decision Path</p>
          <div className="flex items-center gap-2 flex-wrap">
            {history.map((h, i) => {
              const node = decisionTree.find(n => n.id === h.nodeId)
              return (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20">
                    <span className="text-primary">{node?.icon}</span>
                    <span className="text-xs font-medium text-primary">{h.selectedOption}</span>
                  </div>
                  {i < history.length - 1 && (
                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                  )}
                </div>
              )
            })}
            {result && (
              <>
                <ArrowRight className="w-3 h-3 text-muted-foreground" />
                <div className={cn(
                  'px-3 py-1.5 rounded-lg border text-xs font-bold',
                  resultConfig[result.type as keyof typeof resultConfig]?.bg,
                  resultConfig[result.type as keyof typeof resultConfig]?.color,
                )}>
                  {resultConfig[result.type as keyof typeof resultConfig]?.label}
                </div>
              </>
            )}
          </div>
        </motion.div>
      )}
    </div>
  )
}
