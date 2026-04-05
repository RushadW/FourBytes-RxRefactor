'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Brain, Sparkles, Target, Tags, ArrowRight } from 'lucide-react'
import { useAntonStore } from '@/lib/store'

interface AIThinkingProps {
  compact?: boolean
}

export function AIThinking({ compact = false }: AIThinkingProps) {
  const aiThinking = useAntonStore((state) => state.aiThinking)
  const query = useAntonStore((state) => state.query)

  const stageConfig = {
    understanding: {
      icon: Brain,
      label: 'Understanding your query...',
      color: 'text-primary',
      bg: 'bg-primary/20',
    },
    identifying: {
      icon: Target,
      label: 'Identifying intent...',
      color: 'text-accent',
      bg: 'bg-accent/20',
    },
    detecting: {
      icon: Tags,
      label: 'Detecting entities...',
      color: 'text-amber-400',
      bg: 'bg-amber-400/20',
    },
    complete: {
      icon: Sparkles,
      label: 'Analysis complete',
      color: 'text-green-400',
      bg: 'bg-green-400/20',
    },
  }

  const currentStage = stageConfig[aiThinking.stage]
  const StageIcon = currentStage.icon

  if (compact) {
    return (
      <motion.div
        className="flex items-center gap-2 text-sm text-muted-foreground"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <StageIcon className={`w-4 h-4 ${currentStage.color}`} />
        <span>{currentStage.label}</span>
      </motion.div>
    )
  }

  return (
    <motion.div
      className="glass-card rounded-2xl overflow-hidden"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Gradient top border */}
      <div className="h-1 bg-gradient-to-r from-primary via-accent to-amber-400" />
      
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <motion.div
            className={`w-12 h-12 rounded-xl ${currentStage.bg} flex items-center justify-center`}
            animate={{ 
              scale: aiThinking.stage !== 'complete' ? [1, 1.08, 1] : 1,
              boxShadow: aiThinking.stage !== 'complete' 
                ? ['0 0 0 rgba(59, 130, 246, 0)', '0 0 20px rgba(59, 130, 246, 0.3)', '0 0 0 rgba(59, 130, 246, 0)']
                : '0 0 0 rgba(59, 130, 246, 0)'
            }}
            transition={{ duration: 2, repeat: aiThinking.stage !== 'complete' ? Infinity : 0 }}
          >
            <StageIcon className={`w-6 h-6 ${currentStage.color}`} />
          </motion.div>
          <div>
            <h3 className="font-semibold text-foreground">AI Analysis</h3>
            <p className={`text-sm ${currentStage.color}`}>{currentStage.label}</p>
          </div>
        </div>

        {/* Query display */}
        <div className="mb-5 p-4 rounded-xl bg-secondary/70 border border-border/30">
          <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">Your query</p>
          <p className="text-foreground font-medium text-lg">{query}</p>
        </div>

        {/* Parsed intent - visual breakdown */}
        <AnimatePresence mode="wait">
          {aiThinking.parsedIntent.drug && (
            <motion.div
              className="space-y-4"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              {/* Visual breakdown */}
              <div className="flex items-center gap-3 flex-wrap">
                <motion.div
                  className="flex items-center gap-2"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Drug</span>
                  <span className="px-3 py-1.5 rounded-lg bg-primary/20 text-primary text-sm font-medium border border-primary/30">
                    {aiThinking.parsedIntent.drug}
                  </span>
                </motion.div>
                
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
                
                <motion.div
                  className="flex items-center gap-2"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Action</span>
                  <span className="px-3 py-1.5 rounded-lg bg-accent/20 text-accent text-sm font-medium border border-accent/30">
                    {aiThinking.parsedIntent.action}
                  </span>
                </motion.div>
                
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
                
                <motion.div
                  className="flex items-center gap-2"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Payers</span>
                  <span className="px-3 py-1.5 rounded-lg bg-amber-400/20 text-amber-400 text-sm font-medium border border-amber-400/30">
                    {aiThinking.parsedIntent.entities?.length || 3} targets
                  </span>
                </motion.div>
              </div>

              {/* Thinking messages with progress */}
              <div className="pt-4 border-t border-border/30">
                <div className="space-y-2">
                  {aiThinking.messages.map((message, index) => (
                    <motion.div
                      key={index}
                      className="flex items-center gap-3"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.2 }}
                    >
                      <motion.div
                        className="w-2 h-2 rounded-full bg-green-400"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: index * 0.2 + 0.1 }}
                      />
                      <span className="text-sm text-muted-foreground">{message}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
