'use client'

import { motion } from 'framer-motion'
import { Check, Loader2 } from 'lucide-react'
import type { ProcessingStep as ProcessingStepType } from '@/lib/types'

interface ProcessingStepProps {
  step: ProcessingStepType
  index: number
}

export function ProcessingStep({ step, index }: ProcessingStepProps) {
  const isActive = step.status === 'active'
  const isComplete = step.status === 'complete'
  const isPending = step.status === 'pending'

  return (
    <motion.div
      className={`
        flex items-center gap-3 p-3 rounded-xl transition-all duration-300
        ${isActive ? 'bg-primary/10 ring-1 ring-primary/30' : ''}
        ${isComplete ? 'bg-green-500/10' : ''}
        ${isPending ? 'opacity-40' : ''}
      `}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: isPending ? 0.4 : 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      {/* Status indicator */}
      <div className="relative flex-shrink-0">
        {isComplete ? (
          <motion.div
            className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
          >
            <Check className="w-4 h-4 text-white" />
          </motion.div>
        ) : isActive ? (
          <motion.div
            className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center"
            animate={{ 
              scale: [1, 1.05, 1],
              boxShadow: ['0 0 0 rgba(59, 130, 246, 0)', '0 0 20px rgba(59, 130, 246, 0.4)', '0 0 0 rgba(59, 130, 246, 0)']
            }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <Loader2 className="w-4 h-4 text-white animate-spin" />
          </motion.div>
        ) : (
          <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center border border-border/30">
            <span className="text-xs text-muted-foreground font-medium">{index + 1}</span>
          </div>
        )}
      </div>

      {/* Label */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${isComplete ? 'text-green-400' : isActive ? 'text-primary' : 'text-muted-foreground'}`}>
          {step.label}
        </p>
      </div>

      {/* Partial result indicator */}
      {step.ghostSection && isComplete && (
        <motion.div
          className="flex-shrink-0"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <span className="text-[10px] px-2 py-1 rounded-md bg-green-500/20 text-green-400 font-medium border border-green-500/30">
            Ready
          </span>
        </motion.div>
      )}
    </motion.div>
  )
}
