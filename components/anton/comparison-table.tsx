'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, X, AlertTriangle, ChevronDown } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import type { PayerPolicy } from '@/lib/types'

interface ComparisonTableProps {
  policies: PayerPolicy[]
}

type CriteriaKey = 'priorAuth' | 'stepTherapy' | 'siteOfCare'

interface CriteriaRow {
  key: CriteriaKey
  label: string
  getValue: (policy: PayerPolicy) => { value: boolean | string; status: 'yes' | 'no' | 'partial' }
  getDetail?: (policy: PayerPolicy) => string
}

export function ComparisonTable({ policies }: ComparisonTableProps) {
  const [showDifferencesOnly, setShowDifferencesOnly] = useState(false)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const criteria: CriteriaRow[] = [
    {
      key: 'priorAuth',
      label: 'Prior Authorization',
      getValue: (p) => ({ value: p.priorAuth, status: p.priorAuth ? 'yes' : 'no' }),
      getDetail: (p) => p.priorAuthDetails,
    },
    {
      key: 'stepTherapy',
      label: 'Step Therapy',
      getValue: (p) => ({ value: p.stepTherapy, status: p.stepTherapy ? 'yes' : 'no' }),
      getDetail: (p) => p.stepTherapyDetails,
    },
    {
      key: 'siteOfCare',
      label: 'Home Infusion',
      getValue: (p) => ({
        value: p.siteOfCare.includes('Home Infusion'),
        status: p.siteOfCare.includes('Home Infusion') ? 'yes' : 'no',
      }),
      getDetail: (p) => `Available sites: ${p.siteOfCare.join(', ')}`,
    },
  ]

  // Check if a row has differences
  const hasDifferences = (criterion: CriteriaRow) => {
    const values = policies.map(p => criterion.getValue(p).status)
    return new Set(values).size > 1
  }

  const visibleCriteria = showDifferencesOnly
    ? criteria.filter(hasDifferences)
    : criteria

  const toggleRowExpand = (key: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(key)) {
      newExpanded.delete(key)
    } else {
      newExpanded.add(key)
    }
    setExpandedRows(newExpanded)
  }

  return (
    <motion.div
      className="glass-card rounded-2xl border border-border/50 shadow-sm overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <h3 className="font-medium text-foreground">Policy Comparison</h3>
        <div className="flex items-center gap-2">
          <Switch
            id="diff-toggle"
            checked={showDifferencesOnly}
            onCheckedChange={setShowDifferencesOnly}
          />
          <Label htmlFor="diff-toggle" className="text-xs text-muted-foreground cursor-pointer">
            Show differences only
          </Label>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/50 bg-muted/30">
              <th className="text-left p-4 text-sm font-medium text-muted-foreground w-48">
                Criteria
              </th>
              {policies.map((policy) => (
                <th
                  key={policy.payerId}
                  className="text-center p-4 text-sm font-medium text-foreground"
                >
                  <div className="flex flex-col items-center gap-1">
                    <span>{policy.payerName}</span>
                    <ConfidenceBadge confidence={policy.confidence} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleCriteria.map((criterion, index) => {
              const isDifferent = hasDifferences(criterion)
              const isExpanded = expandedRows.has(criterion.key)
              
              return (
                <motion.tr
                  key={criterion.key}
                  className={`border-b border-border/30 ${isDifferent ? 'bg-amber-50/30' : ''}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <td className="p-4">
                    <button
                      className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
                      onClick={() => toggleRowExpand(criterion.key)}
                    >
                      <ChevronDown
                        className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      />
                      {criterion.label}
                      {isDifferent && (
                        <span className="px-1.5 py-0.5 text-[10px] rounded bg-amber-100 text-amber-700">
                          Differs
                        </span>
                      )}
                    </button>
                    {isExpanded && criterion.getDetail && (
                      <motion.div
                        className="mt-2 pl-6 space-y-1"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                      >
                        {policies.map((policy) => (
                          <p key={policy.payerId} className="text-xs text-muted-foreground">
                            <span className="font-medium">{policy.payerName}:</span>{' '}
                            {criterion.getDetail!(policy)}
                          </p>
                        ))}
                      </motion.div>
                    )}
                  </td>
                  {policies.map((policy) => {
                    const { status } = criterion.getValue(policy)
                    return (
                      <td key={policy.payerId} className="p-4 text-center">
                        <StatusIcon status={status} />
                      </td>
                    )
                  })}
                </motion.tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {showDifferencesOnly && visibleCriteria.length === 0 && (
        <div className="p-8 text-center text-muted-foreground">
          No differences found between payers
        </div>
      )}
    </motion.div>
  )
}

function StatusIcon({ status }: { status: 'yes' | 'no' | 'partial' }) {
  if (status === 'yes') {
    return (
      <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-100">
        <Check className="w-4 h-4 text-red-600" />
      </div>
    )
  }
  if (status === 'no') {
    return (
      <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-green-100">
        <X className="w-4 h-4 text-green-600" />
      </div>
    )
  }
  return (
    <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-100">
      <AlertTriangle className="w-4 h-4 text-amber-600" />
    </div>
  )
}

function ConfidenceBadge({ confidence }: { confidence: 'high' | 'medium' | 'low' }) {
  const colors = {
    high: 'bg-green-100 text-green-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-red-100 text-red-700',
  }
  
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded ${colors[confidence]}`}>
      {confidence}
    </span>
  )
}
