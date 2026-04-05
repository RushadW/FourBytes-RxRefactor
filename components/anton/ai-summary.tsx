'use client'

import { motion } from 'framer-motion'
import { Sparkles, ArrowRight, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { SpeakButton } from './voice-orb'

interface AISummaryProps {
  summary: string
  queryBreakdown?: {
    drug: string
    action: string
    payers: string[]
  }
}

export function AISummary({ summary, queryBreakdown }: AISummaryProps) {
  // Parse the summary to extract key points for visual display
  const hasStepTherapy = summary.toLowerCase().includes('step therapy')
  const hasPriorAuth = summary.toLowerCase().includes('prior auth')
  
  return (
    <motion.div
      className="relative glass-card rounded-2xl overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Gradient border effect */}
      <div className="absolute inset-0 rounded-2xl p-[1px] bg-gradient-to-br from-primary/50 via-accent/30 to-transparent pointer-events-none" />
      
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/5 pointer-events-none" />
      
      <div className="relative p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <motion.div 
            className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center"
            animate={{ 
              boxShadow: ['0 0 20px rgba(59, 130, 246, 0.3)', '0 0 40px rgba(59, 130, 246, 0.5)', '0 0 20px rgba(59, 130, 246, 0.3)']
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Sparkles className="w-5 h-5 text-white" />
          </motion.div>
          <div>
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">
              AI Answer
            </span>
            <p className="text-xs text-muted-foreground">Instant analysis</p>
          </div>
          <div className="ml-auto">
            <SpeakButton text={summary} />
          </div>
        </div>
        
        {/* Main answer */}
        <motion.p
          className="text-2xl font-medium text-foreground leading-relaxed mb-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {summary}
        </motion.p>
        
        {/* Visual breakdown */}
        {queryBreakdown && (
          <motion.div
            className="flex flex-wrap items-center gap-2 pt-4 border-t border-border/50"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <span className="text-xs text-muted-foreground">Your query:</span>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 rounded-full bg-primary/20 text-primary text-xs font-medium">
                {queryBreakdown.drug}
              </span>
              <ArrowRight className="w-3 h-3 text-muted-foreground" />
              <span className="px-3 py-1.5 rounded-full bg-accent/20 text-accent text-xs font-medium">
                {queryBreakdown.action}
              </span>
              <ArrowRight className="w-3 h-3 text-muted-foreground" />
              <div className="flex items-center gap-1">
                {queryBreakdown.payers.map((payer, i) => (
                  <span 
                    key={payer}
                    className="px-3 py-1.5 rounded-full bg-secondary text-foreground text-xs font-medium"
                  >
                    {payer}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
