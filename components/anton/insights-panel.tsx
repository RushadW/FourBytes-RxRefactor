'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Info, Lightbulb, ChevronRight, Zap, TrendingUp, Shield } from 'lucide-react'
import type { Insight } from '@/lib/types'

interface InsightsPanelProps {
  insights: Insight[]
}

export function InsightsPanel({ insights }: InsightsPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Group insights by impact
  const highImpact = insights.filter(i => i.impact === 'high')
  const otherInsights = insights.filter(i => i.impact !== 'high')

  return (
    <motion.div
      className="glass-card rounded-2xl overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
    >
      {/* Header */}
      <div className="p-6 border-b border-border/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 flex items-center justify-center">
            <Zap className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Key Insights</h3>
            <p className="text-xs text-muted-foreground">AI-generated analysis of policy differences</p>
          </div>
        </div>
      </div>

      {/* High impact insights - Featured */}
      {highImpact.length > 0 && (
        <div className="p-4 bg-gradient-to-r from-amber-500/10 to-transparent border-b border-border/30">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-medium text-amber-400 uppercase tracking-wider">High Impact</span>
          </div>
          <div className="space-y-2">
            {highImpact.map((insight) => (
              <InsightCard 
                key={insight.id} 
                insight={insight} 
                isExpanded={expandedId === insight.id}
                onToggle={() => setExpandedId(expandedId === insight.id ? null : insight.id)}
                featured
              />
            ))}
          </div>
        </div>
      )}

      {/* Other insights */}
      <div className="p-4">
        <div className="space-y-2">
          {otherInsights.map((insight) => (
            <InsightCard 
              key={insight.id} 
              insight={insight}
              isExpanded={expandedId === insight.id}
              onToggle={() => setExpandedId(expandedId === insight.id ? null : insight.id)}
            />
          ))}
        </div>
      </div>
    </motion.div>
  )
}

interface InsightCardProps {
  insight: Insight
  isExpanded: boolean
  onToggle: () => void
  featured?: boolean
}

function InsightCard({ insight, isExpanded, onToggle, featured }: InsightCardProps) {
  const icons = {
    warning: AlertTriangle,
    info: Info,
    tip: Lightbulb,
  }

  const iconStyles = {
    warning: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' },
    info: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
    tip: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },
  }

  const impactColors = {
    high: 'bg-red-500/20 text-red-400 border-red-500/30',
    medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    low: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  }

  const confidenceColors = {
    high: 'bg-green-500/20 text-green-400 border-green-500/30',
    medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    low: 'bg-red-500/20 text-red-400 border-red-500/30',
  }

  const Icon = icons[insight.icon]
  const style = iconStyles[insight.icon]

  return (
    <motion.div
      className={`
        rounded-xl transition-all duration-200
        ${featured ? 'bg-secondary/80' : 'bg-secondary/50 hover:bg-secondary/70'}
        ${insight.whyItMatters ? 'cursor-pointer' : ''}
      `}
      onClick={insight.whyItMatters ? onToggle : undefined}
      layout
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={`w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center ${style.bg} border ${style.border}`}>
            <Icon className={`w-4 h-4 ${style.text}`} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground leading-relaxed">{insight.text}</p>
            
            {/* Tags */}
            <div className="flex items-center gap-2 mt-3">
              <span className={`text-[10px] px-2 py-1 rounded-md border font-medium ${impactColors[insight.impact]}`}>
                Impact: {insight.impact}
              </span>
              <span className={`text-[10px] px-2 py-1 rounded-md border font-medium ${confidenceColors[insight.confidence]}`}>
                Confidence: {insight.confidence}
              </span>
              {insight.whyItMatters && (
                <ChevronRight
                  className={`w-4 h-4 text-muted-foreground transition-transform ml-auto ${isExpanded ? 'rotate-90' : ''}`}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Expandable "Why it matters" section */}
      <AnimatePresence>
        {isExpanded && insight.whyItMatters && (
          <motion.div
            className="px-4 pb-4"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 ml-12">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-medium text-primary">Why this matters</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {insight.whyItMatters}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
