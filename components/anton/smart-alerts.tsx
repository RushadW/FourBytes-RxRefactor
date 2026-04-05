'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell, AlertTriangle, CheckCircle2, Info, TrendingUp, TrendingDown,
  Calendar, Filter, ChevronDown, ExternalLink, Flame, Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { fetchNotifications, type Notification } from '@/lib/api'

type Severity = 'critical' | 'warning' | 'info' | 'positive'

function classifySeverity(notif: Notification): Severity {
  const msg = notif.message.toLowerCase()
  // Removed coverage / major restrictions → critical
  if (msg.includes('removed') && (msg.includes('covered') || msg.includes('access'))) return 'critical'
  // Step therapy or PA added → warning
  if (msg.includes('changed from "false" to "true"') && (msg.includes('prior auth') || msg.includes('step therapy'))) return 'warning'
  // Coverage expanded / restrictions removed → positive
  if (msg.includes('changed from "true" to "false"') && (msg.includes('prior auth') || msg.includes('step therapy'))) return 'positive'
  if (msg.includes('expansion') || msg.includes('added')) return 'positive'
  // Default to info
  return 'info'
}

function extractChangeSummary(notif: Notification): string {
  // Take the first change from the message (before the first semicolon)
  const first = notif.message.split(';')[0].trim()
  return first.length > 120 ? first.slice(0, 117) + '...' : first
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function extractPayer(notif: Notification): string {
  // Extract payer name from title like "Cigna updated ..."
  const match = notif.title.match(/^(.+?) updated/)
  return match ? match[1] : notif.payer_id || 'Unknown'
}

function extractDrug(notif: Notification): string {
  // Extract drug name from title like "... updated Rituximab (Rituxan) policy"
  const match = notif.title.match(/updated (.+?) policy/)
  return match ? match[1] : notif.drug_id || 'Unknown'
}

/** Count of items on the Alerts page feed (sidebar badge uses this; not API notifications). */
export const SMART_ALERTS_FEED_COUNT = 0 // kept for backward compat, sidebar now uses API

const severityConfig = {
  critical: { icon: <Flame className="w-4 h-4" />, color: 'text-red-600', bg: 'bg-red-500/10 border-red-500/25', badge: 'bg-red-500/15 text-red-700 border border-red-500/20' },
  warning: { icon: <AlertTriangle className="w-4 h-4" />, color: 'text-amber-600', bg: 'bg-amber-500/10 border-amber-500/25', badge: 'bg-amber-500/15 text-amber-800 border border-amber-500/20' },
  info: { icon: <Info className="w-4 h-4" />, color: 'text-primary', bg: 'bg-primary/10 border-primary/20', badge: 'bg-primary/12 text-primary border border-primary/20' },
  positive: { icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-emerald-600', bg: 'bg-emerald-500/10 border-emerald-500/25', badge: 'bg-emerald-500/15 text-emerald-800 border border-emerald-500/20' },
}

export function SmartAlerts() {
  const [filter, setFilter] = useState<'all' | Severity>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchNotifications()
      .then(setNotifications)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const alertItems = notifications.map(n => ({
    id: n.id,
    payer: extractPayer(n),
    drug: extractDrug(n),
    change: extractChangeSummary(n),
    details: n.message,
    date: formatDate(n.created_at),
    severity: classifySeverity(n),
    trend: classifySeverity(n) === 'critical' || classifySeverity(n) === 'warning' ? 'down' as const : classifySeverity(n) === 'positive' ? 'up' as const : undefined,
  }))

  const filtered = filter === 'all' ? alertItems : alertItems.filter(a => a.severity === filter)

  const stats = {
    critical: alertItems.filter(a => a.severity === 'critical').length,
    warning: alertItems.filter(a => a.severity === 'warning').length,
    positive: alertItems.filter(a => a.severity === 'positive').length,
    total: alertItems.length,
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
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading alerts...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Bell className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">No alerts found</p>
            <p className="text-xs mt-1 opacity-60">Policy change alerts will appear here after scraping</p>
          </div>
        ) : (
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
        )}
      </div>
    </div>
  )
}
