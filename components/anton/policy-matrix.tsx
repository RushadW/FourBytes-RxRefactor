'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Check, X, Minus, Shield, Clock, Pill, Building2, Loader2 } from 'lucide-react'
import { fetchMatrix, type MatrixResponse } from '@/lib/api'
import { cn } from '@/lib/utils'

function CellBadge({ value, label }: { value: boolean | null; label: string }) {
  if (value === null || value === undefined) return null
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full',
        value
          ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
          : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
      )}
    >
      {value ? <Check className="w-2.5 h-2.5" /> : <X className="w-2.5 h-2.5" />}
      {label}
    </span>
  )
}

export function PolicyMatrix() {
  const [data, setData] = useState<MatrixResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hoveredDrug, setHoveredDrug] = useState<string | null>(null)
  const [hoveredPayer, setHoveredPayer] = useState<string | null>(null)

  useEffect(() => {
    fetchMatrix()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-border/60 p-12 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary mr-3" />
        <span className="text-sm text-muted-foreground">Loading policy matrix from scraped data...</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="bg-white rounded-2xl border border-border/60 p-8 text-center">
        <p className="text-sm text-muted-foreground">Could not load policy matrix. Is the backend running?</p>
      </div>
    )
  }

  const { payers, rows, total_policies } = data

  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Pill className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">
            Policy Coverage Matrix
          </h2>
          <span className="text-xs text-muted-foreground">
            {rows.length} drugs × {payers.length} payers — {total_policies} policies from scraped PDFs
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400" /> Covered
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-400" /> Not Covered
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-gray-300" /> No Data
          </span>
        </div>
      </div>

      {/* Matrix Table */}
      <div className="bg-white rounded-2xl border border-border/60 soft-shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left px-4 py-3 bg-secondary/40 border-b border-border/40 w-40">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Drug</span>
                </th>
                {payers.map((payer, i) => (
                  <th
                    key={payer.payer_id}
                    className={cn(
                      'text-center px-3 py-3 bg-secondary/40 border-b border-border/40 min-w-[160px]',
                      hoveredPayer === payer.payer_id && 'bg-primary/[0.06]'
                    )}
                    onMouseEnter={() => setHoveredPayer(payer.payer_id)}
                    onMouseLeave={() => setHoveredPayer(null)}
                  >
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-primary/60" />
                        <span className="text-xs font-semibold text-foreground">{payer.payer_name}</span>
                      </div>
                    </motion.div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIdx) => (
                <motion.tr
                  key={row.drug.drug_id}
                  className={cn(
                    'border-b border-border/30 transition-colors',
                    hoveredDrug === row.drug.drug_id && 'bg-primary/[0.03]',
                    rowIdx % 2 === 0 ? 'bg-white' : 'bg-secondary/20'
                  )}
                  onMouseEnter={() => setHoveredDrug(row.drug.drug_id)}
                  onMouseLeave={() => setHoveredDrug(null)}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 + rowIdx * 0.04 }}
                >
                  {/* Drug name */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Pill className="w-3.5 h-3.5 text-primary/50 flex-shrink-0" />
                      <span className="text-sm font-semibold text-foreground">{row.drug.drug_name}</span>
                    </div>
                  </td>

                  {/* Payer cells */}
                  {payers.map((payer) => {
                    const cell = row.cells[payer.payer_id]
                    const pol = cell?.policy

                    if (!cell?.has_data) {
                      return (
                        <td
                          key={payer.payer_id}
                          className={cn(
                            'text-center px-3 py-3',
                            hoveredPayer === payer.payer_id && 'bg-primary/[0.03]'
                          )}
                        >
                          <div className="flex items-center justify-center">
                            <Minus className="w-4 h-4 text-gray-300" />
                          </div>
                          <span className="text-[10px] text-muted-foreground/50">No data</span>
                        </td>
                      )
                    }

                    const covered = pol?.covered ?? true
                    const pa = pol?.prior_auth ?? false
                    const st = pol?.step_therapy ?? false

                    return (
                      <td
                        key={payer.payer_id}
                        className={cn(
                          'text-center px-3 py-3',
                          hoveredPayer === payer.payer_id && 'bg-primary/[0.03]'
                        )}
                      >
                        <div className="space-y-1.5">
                          {/* Coverage indicator */}
                          <div className="flex items-center justify-center">
                            {covered ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                                <Check className="w-3 h-3" />
                                Covered
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200/60">
                                <X className="w-3 h-3" />
                                Not Covered
                              </span>
                            )}
                          </div>
                          {/* PA / ST badges */}
                          {covered && (
                            <div className="flex items-center justify-center gap-1 flex-wrap">
                              {pa && (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/50">
                                  <Shield className="w-2.5 h-2.5" />
                                  PA
                                </span>
                              )}
                              {st && (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-medium text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded border border-violet-200/50">
                                  <Clock className="w-2.5 h-2.5" />
                                  ST
                                </span>
                              )}
                              {!pa && !st && (
                                <span className="text-[9px] text-emerald-600 font-medium">No barriers</span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    )
                  })}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-5 text-[10px] text-muted-foreground pt-1">
        <span className="flex items-center gap-1">
          <Shield className="w-3 h-3 text-amber-500" /> PA = Prior Authorization
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-violet-500" /> ST = Step Therapy
        </span>
        <span>Data extracted from real payer policy PDFs</span>
      </div>
    </motion.div>
  )
}
