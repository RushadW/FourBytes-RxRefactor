'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell, AlertTriangle, CheckCircle2, Info, TrendingUp, TrendingDown,
  Calendar, Filter, ChevronDown, ExternalLink, Flame,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface PolicyAlert {
  id: string
  payer: string
  drug: string
  change: string
  details: string
  date: string
  severity: 'critical' | 'warning' | 'info' | 'positive'
  category: 'restriction' | 'expansion' | 'new-policy' | 'update'
  trend?: 'up' | 'down' | 'neutral'
}

const alerts: PolicyAlert[] = [
  {
    id: '1',
    payer: 'Cigna',
    drug: 'Rituximab',
    change: 'Step therapy requirement increased to 12 weeks methotrexate',
    details: 'Previous requirement was 8 weeks. This adds ~4 weeks to the treatment timeline for autoimmune indications. Oncology indications unaffected.',
    date: '2026-03-28',
    severity: 'critical',
    category: 'restriction',
    trend: 'down',
  },
  {
    id: '2',
    payer: 'UnitedHealthcare',
    drug: 'Rituximab',
    change: 'Home infusion now covered with nurse supervision',
    details: 'UHC expanded site-of-care options. Home infusion is now covered when supervised by a certified infusion nurse. This is a significant improvement for patient convenience.',
    date: '2026-03-15',
    severity: 'positive',
    category: 'expansion',
    trend: 'up',
  },
  {
    id: '3',
    payer: 'Cigna',
    drug: 'Humira',
    change: 'Biosimilar step therapy now required for new starts',
    details: 'All new Humira starts must try an approved biosimilar first. Existing patients are grandfathered for 6 months. Applies to all indications.',
    date: '2026-03-10',
    severity: 'warning',
    category: 'restriction',
    trend: 'down',
  },
  {
    id: '4',
    payer: 'Blue Cross Blue Shield',
    drug: 'Rituximab',
    change: 'Updated criteria: specialist treatment plan now required',
    details: 'BCBS added requirement for a documented treatment plan from a board-certified specialist. General practitioners can no longer submit PA independently.',
    date: '2026-02-20',
    severity: 'warning',
    category: 'update',
    trend: 'down',
  },
  {
    id: '5',
    payer: 'UnitedHealthcare',
    drug: 'Humira',
    change: 'PA turnaround reduced from 5 to 3 business days',
    details: 'UHC streamlined their prior authorization review process. Digital submissions via CoverMyMeds now have a 3-day guaranteed turnaround.',
    date: '2026-02-01',
    severity: 'positive',
    category: 'expansion',
    trend: 'up',
  },
  {
    id: '6',
    payer: 'Cigna',
    drug: 'Bevacizumab',
    change: 'New off-label coverage for age-related macular degeneration',
    details: 'Cigna now covers Bevacizumab for AMD under a new medical policy. This is significant as it provides a lower-cost alternative to Lucentis/Eylea.',
    date: '2026-01-15',
    severity: 'info',
    category: 'new-policy',
    trend: 'up',
  },
]

/** Count of items on the Alerts page feed (sidebar badge uses this; not API notifications). */
export const SMART_ALERTS_FEED_COUNT = alerts.length

const severityConfig = {
  critical: { icon: <Flame className="w-4 h-4" />, color: 'text-red-600', bg: 'bg-red-500/10 border-red-500/25', badge: 'bg-red-500/15 text-red-700 border border-red-500/20' },
  warning: { icon: <AlertTriangle className="w-4 h-4" />, color: 'text-amber-600', bg: 'bg-amber-500/10 border-amber-500/25', badge: 'bg-amber-500/15 text-amber-800 border border-amber-500/20' },
  info: { icon: <Info className="w-4 h-4" />, color: 'text-primary', bg: 'bg-primary/10 border-primary/20', badge: 'bg-primary/12 text-primary border border-primary/20' },
  positive: { icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-emerald-600', bg: 'bg-emerald-500/10 border-emerald-500/25', badge: 'bg-emerald-500/15 text-emerald-800 border border-emerald-500/20' },
}

export function SmartAlerts() {
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'info' | 'positive'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filtered = filter === 'all' ? alerts : alerts.filter(a => a.severity === filter)

  const stats = {
    critical: alerts.filter(a => a.severity === 'critical').length,
    warning: alerts.filter(a => a.severity === 'warning').length,
    positive: alerts.filter(a => a.severity === 'positive').length,
    total: alerts.length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500/15 to-orange-500/10 ring-1 ring-border flex items-center justify-center">
          <Bell className="w-5 h-5 text-red-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Smart Alerts</h2>
          <p className="text-sm text-muted-foreground">Policy changes across all payers — Q1 2026</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        <motion.div
          className="glass-card rounded-xl p-4 text-center cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all"
          whileHover={{ y: -2 }}
          onClick={() => setFilter('all')}
        >
          <div className="text-2xl font-bold text-foreground">{stats.total}</div>
          <div className="text-[10px] text-muted-foreground uppercase mt-1">Total Changes</div>
        </motion.div>
        <motion.div
          className="glass-card rounded-xl p-4 text-center cursor-pointer hover:ring-1 hover:ring-red-500/30 transition-all"
          whileHover={{ y: -2 }}
          onClick={() => setFilter('critical')}
        >
          <div className="text-2xl font-bold text-red-600 tabular-nums">{stats.critical}</div>
          <div className="text-[10px] text-muted-foreground uppercase mt-1">Critical</div>
        </motion.div>
        <motion.div
          className="glass-card rounded-xl p-4 text-center cursor-pointer hover:ring-1 hover:ring-yellow-500/30 transition-all"
          whileHover={{ y: -2 }}
          onClick={() => setFilter('warning')}
        >
          <div className="text-2xl font-bold text-amber-600 tabular-nums">{stats.warning}</div>
          <div className="text-[10px] text-muted-foreground uppercase mt-1">Warnings</div>
        </motion.div>
        <motion.div
          className="glass-card rounded-xl p-4 text-center cursor-pointer hover:ring-1 hover:ring-green-500/30 transition-all"
          whileHover={{ y: -2 }}
          onClick={() => setFilter('positive')}
        >
          <div className="text-2xl font-bold text-emerald-600 tabular-nums">{stats.positive}</div>
          <div className="text-[10px] text-muted-foreground uppercase mt-1">Positive</div>
        </motion.div>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'critical', 'warning', 'info', 'positive'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
              filter === f
                ? 'bg-primary text-primary-foreground'
                : 'glass-card-light hover:bg-secondary/80 text-muted-foreground'
            )}
          >
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Alert feed */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {filtered.map((alert, i) => {
            const config = severityConfig[alert.severity]
            const isExpanded = expandedId === alert.id
            
            return (
              <motion.div
                key={alert.id}
                layout
                className={cn('glass-card rounded-xl overflow-hidden cursor-pointer', isExpanded && 'ring-1 ring-primary/30')}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => setExpandedId(isExpanded ? null : alert.id)}
              >
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', config.bg)}>
                      {config.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase', config.badge)}>
                          {alert.severity}
                        </span>
                        <span className="text-[10px] text-muted-foreground/60">{alert.date}</span>
                        {alert.trend && (
                          <span className={cn(
                            'flex items-center gap-0.5 text-[10px]',
                            alert.trend === 'up' ? 'text-emerald-600' : alert.trend === 'down' ? 'text-red-600' : 'text-muted-foreground'
                          )}>
                            {alert.trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            Access
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs px-2 py-0.5 rounded-md bg-secondary text-muted-foreground">{alert.payer}</span>
                        <span className="text-xs px-2 py-0.5 rounded-md bg-primary/10 text-primary font-medium">{alert.drug}</span>
                      </div>
                      <p className="text-sm font-medium text-foreground">{alert.change}</p>
                    </div>
                    <ChevronDown className={cn(
                      'w-4 h-4 text-muted-foreground transition-transform flex-shrink-0',
                      isExpanded && 'rotate-180'
                    )} />
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-border/20"
                    >
                      <div className="p-4">
                        <p className="text-sm text-muted-foreground leading-relaxed">{alert.details}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
