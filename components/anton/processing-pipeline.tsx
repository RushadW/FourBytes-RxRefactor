'use client'

import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { ProcessingStep } from './processing-step'
import { ProgressLine } from './progress-line'
import { useAntonStore } from '@/lib/store'
import { Activity } from 'lucide-react'
import { soundEngine } from '@/lib/sounds'

export function ProcessingPipeline() {
  const processingSteps = useAntonStore((state) => state.processingSteps)
  const currentStepIndex = useAntonStore((state) => state.currentStepIndex)
  const prevCompletedRef = useRef(0)
  
  // Calculate progress percentage
  const completedSteps = processingSteps.filter(s => s.status === 'complete').length
  const progress = (completedSteps / processingSteps.length) * 100

  // Play sound on step completion
  useEffect(() => {
    if (completedSteps > prevCompletedRef.current) {
      if (completedSteps === processingSteps.length) {
        soundEngine?.success()
      } else {
        soundEngine?.stepComplete()
      }
    }
    prevCompletedRef.current = completedSteps
  }, [completedSteps, processingSteps.length])

  return (
    <motion.div
      className="glass-card rounded-2xl overflow-hidden"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      {/* Header with gradient */}
      <div className="px-6 py-4 border-b border-border/30 bg-gradient-to-r from-secondary/50 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Activity className="w-4 h-4 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground">Processing Pipeline</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{completedSteps}</span>
            <span className="text-sm text-muted-foreground">/ {processingSteps.length} steps</span>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Progress line */}
        <ProgressLine progress={progress} className="mb-6" />

        {/* Steps */}
        <div className="space-y-2">
          {processingSteps.map((step, index) => (
            <ProcessingStep 
              key={step.id} 
              step={step} 
              index={index}
            />
          ))}
        </div>
      </div>
    </motion.div>
  )
}
