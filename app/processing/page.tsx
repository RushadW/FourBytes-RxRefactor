'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { AnimatedBackground } from '@/components/anton/animated-background'
import { AIThinking } from '@/components/anton/ai-thinking'
import { ProcessingPipeline } from '@/components/anton/processing-pipeline'
import { GhostResultsPreview } from '@/components/anton/ghost-results-preview'
import { useAntonStore } from '@/lib/store'

function ProcessingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const query = searchParams.get('q') || ''
  
  const {
    isProcessing,
    processingSteps,
    currentStepIndex,
    startProcessing,
    advanceStep,
    updateAIThinking,
    result,
  } = useAntonStore()

  // Start processing on mount
  useEffect(() => {
    if (query && !isProcessing && currentStepIndex === -1) {
      startProcessing(query)
    }
  }, [query, isProcessing, currentStepIndex, startProcessing])

  // Advance AI thinking stages
  useEffect(() => {
    if (!isProcessing) return

    const stages: Array<'understanding' | 'identifying' | 'detecting' | 'complete'> = [
      'understanding',
      'identifying',
      'detecting',
      'complete',
    ]

    let currentStageIndex = 0
    const interval = setInterval(() => {
      if (currentStageIndex < stages.length) {
        updateAIThinking(stages[currentStageIndex])
        currentStageIndex++
      }
    }, 800)

    return () => clearInterval(interval)
  }, [isProcessing, updateAIThinking])

  // Advance processing steps
  useEffect(() => {
    if (!isProcessing || currentStepIndex < 0) return

    const currentStep = processingSteps[currentStepIndex]
    if (!currentStep || currentStep.status === 'complete') return

    const timer = setTimeout(() => {
      advanceStep()
    }, currentStep.duration)

    return () => clearTimeout(timer)
  }, [isProcessing, currentStepIndex, processingSteps, advanceStep])

  // Navigate to results when complete
  useEffect(() => {
    if (result && !isProcessing) {
      const timer = setTimeout(() => {
        router.push(`/results?q=${encodeURIComponent(query)}`)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [result, isProcessing, router, query])

  // Start first step
  useEffect(() => {
    if (isProcessing && currentStepIndex === 0 && processingSteps[0]?.status === 'pending') {
      advanceStep()
    }
  }, [isProcessing, currentStepIndex, processingSteps, advanceStep])

  if (!query) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">No query provided</p>
      </div>
    )
  }

  return (
    <AnimatedBackground>
      <main className="min-h-screen py-12 px-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <motion.div
            className="text-center mb-10"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <motion.div 
              className="inline-flex items-center justify-center gap-2 mb-4 px-4 py-2 rounded-full bg-primary/10 border border-primary/20"
              animate={{ 
                boxShadow: ['0 0 0 rgba(59, 130, 246, 0)', '0 0 30px rgba(59, 130, 246, 0.2)', '0 0 0 rgba(59, 130, 246, 0)']
              }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">AI Processing</span>
            </motion.div>
            <h1 className="text-3xl font-bold text-foreground mb-3">
              Analyzing your query
            </h1>
            <p className="text-muted-foreground text-lg max-w-md mx-auto">
              Our AI is processing your request in real-time
            </p>
          </motion.div>

          {/* Main content grid */}
          <div className="grid lg:grid-cols-[1fr,420px] gap-8">
            {/* Left: Ghost preview */}
            <div className="order-2 lg:order-1">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    Live Preview
                  </h2>
                </div>
                <GhostResultsPreview />
              </motion.div>
            </div>

            {/* Right: AI thinking + pipeline */}
            <div className="order-1 lg:order-2 space-y-6">
              <AIThinking />
              <ProcessingPipeline />
            </div>
          </div>
        </div>
      </main>
    </AnimatedBackground>
  )
}

export default function ProcessingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <ProcessingContent />
    </Suspense>
  )
}
