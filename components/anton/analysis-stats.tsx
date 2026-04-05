'use client'

import { motion } from 'framer-motion'
import { Clock, FileText, Shield, Zap } from 'lucide-react'
import type { ProcessingStats, ConfidenceLevel } from '@/lib/types'

interface AnalysisStatsProps {
  stats: ProcessingStats
  lastUpdated: string
  confidence: ConfidenceLevel
}

export function AnalysisStats({ stats, lastUpdated, confidence }: AnalysisStatsProps) {
  const processingTime = (stats.processingTimeMs / 1000).toFixed(1)
  
  const confidenceStyles = {
    high: { dot: 'bg-green-400', text: 'text-green-400' },
    medium: { dot: 'bg-amber-400', text: 'text-amber-400' },
    low: { dot: 'bg-red-400', text: 'text-red-400' },
  }

  // Calculate days ago
  const daysAgo = Math.floor((Date.now() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60 * 24))
  const lastUpdatedText = daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo} days ago`

  const stats_items = [
    {
      icon: Zap,
      label: `${stats.policiesAnalyzed} policies analyzed`,
      highlight: `${processingTime}s`,
      color: 'text-primary',
    },
    {
      icon: Clock,
      label: 'Last updated',
      highlight: lastUpdatedText,
      color: 'text-muted-foreground',
    },
    {
      icon: Shield,
      label: 'Confidence',
      highlight: confidence.charAt(0).toUpperCase() + confidence.slice(1),
      color: confidenceStyles[confidence].text,
      dot: confidenceStyles[confidence].dot,
    },
  ]

  return (
    <motion.div
      className="flex flex-wrap items-center gap-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.3 }}
    >
      {stats_items.map((item, index) => (
        <motion.div
          key={item.label}
          className="flex items-center gap-2"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.35 + index * 0.05 }}
        >
          <item.icon className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{item.label}</span>
          <div className="flex items-center gap-1.5">
            {item.dot && <div className={`w-2 h-2 rounded-full ${item.dot}`} />}
            <span className={`text-sm font-medium ${item.color}`}>{item.highlight}</span>
          </div>
        </motion.div>
      ))}
    </motion.div>
  )
}
