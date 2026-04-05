'use client'

import { motion } from 'framer-motion'
import { FileSearch, FileText, Database, GitCompare, Sparkles } from 'lucide-react'

const steps = [
  { icon: FileSearch, label: 'Fetch' },
  { icon: FileText, label: 'Parse' },
  { icon: Database, label: 'Extract' },
  { icon: GitCompare, label: 'Compare' },
  { icon: Sparkles, label: 'Insights' },
]

export function PipelineHint() {
  return (
    <motion.div
      className="flex items-center justify-center gap-3 mt-12"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.7 }}
    >
      {steps.map((step, index) => (
        <motion.div
          key={step.label}
          className="flex items-center"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.8 + index * 0.1 }}
        >
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/40 border border-border/30">
            <step.icon className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium">{step.label}</span>
          </div>
          {index < steps.length - 1 && (
            <div className="w-4 h-px bg-border mx-1" />
          )}
        </motion.div>
      ))}
    </motion.div>
  )
}
