'use client'

import { motion } from 'framer-motion'
import { useAntonStore } from '@/lib/store'
import { Skeleton } from '@/components/ui/skeleton'

export function GhostResultsPreview() {
  const ghostState = useAntonStore((state) => state.ghostState)

  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Ghost AI Summary */}
      <GhostSection revealed={ghostState.summary} className="p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${ghostState.summary ? 'bg-gradient-to-br from-primary to-accent' : 'bg-secondary'}`}>
            <div className="w-5 h-5 rounded-md bg-white/30" />
          </div>
          <div className="flex-1">
            <Skeleton className="h-3 w-20 mb-2" />
            <Skeleton className="h-2 w-16" />
          </div>
        </div>
        <Skeleton className="h-7 w-full max-w-lg mb-2" />
        <Skeleton className="h-5 w-3/4" />
      </GhostSection>

      {/* Ghost Summary Cards */}
      <GhostSection revealed={ghostState.cards}>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <motion.div 
              key={i} 
              className={`p-4 rounded-xl ${ghostState.cards ? 'bg-secondary/50' : 'bg-secondary/30'} border border-border/30`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
            >
              <div className={`w-8 h-8 rounded-lg mb-3 ${i === 1 ? 'bg-blue-500/20' : i === 2 ? 'bg-amber-500/20' : i === 3 ? 'bg-green-500/20' : 'bg-purple-500/20'}`} />
              <Skeleton className="h-6 w-12 mb-1" />
              <Skeleton className="h-3 w-20" />
            </motion.div>
          ))}
        </div>
      </GhostSection>

      {/* Ghost Payer Chips */}
      <GhostSection revealed={ghostState.payers} className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="flex gap-2">
          {['Cigna', 'UHC', 'BCBS'].map((payer, i) => (
            <motion.div
              key={payer}
              className={`
                px-4 py-2 rounded-xl text-sm font-medium
                ${ghostState.payers 
                  ? 'bg-primary/20 text-primary border border-primary/30' 
                  : 'bg-secondary/70 border border-border/30'
                }
              `}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: ghostState.payers ? i * 0.1 : 0.3 + i * 0.1 }}
            >
              {ghostState.payers ? payer : <Skeleton className="h-4 w-14" />}
            </motion.div>
          ))}
        </div>
      </GhostSection>

      {/* Ghost Chart Preview */}
      <GhostSection revealed={ghostState.comparison} className="p-5">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
        {/* Bar chart preview */}
        <div className="space-y-3">
          {[85, 60, 45].map((width, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-4 w-16 flex-shrink-0" />
              <div className="flex-1 h-6 rounded-md bg-secondary/50 overflow-hidden">
                <motion.div
                  className={`h-full rounded-md ${ghostState.comparison ? (width >= 70 ? 'bg-green-500/70' : width >= 50 ? 'bg-amber-500/70' : 'bg-red-500/70') : 'bg-secondary shimmer'}`}
                  initial={{ width: 0 }}
                  animate={{ width: ghostState.comparison ? `${width}%` : '60%' }}
                  transition={{ delay: 0.2 + i * 0.1, duration: 0.6 }}
                />
              </div>
              <span className={`text-sm font-medium w-10 text-right ${ghostState.comparison ? 'text-foreground' : 'text-transparent'}`}>
                {width}%
              </span>
            </div>
          ))}
        </div>
      </GhostSection>

      {/* Ghost Insights */}
      <GhostSection revealed={ghostState.insights} className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className={`w-8 h-8 rounded-lg ${ghostState.insights ? 'bg-amber-500/20' : 'bg-secondary'}`} />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className={`p-3 rounded-xl ${ghostState.insights ? 'bg-secondary/70' : 'bg-secondary/30'}`}>
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg flex-shrink-0 ${i === 1 ? 'bg-amber-500/20' : 'bg-blue-500/20'}`} />
                <div className="flex-1">
                  <Skeleton className="h-4 w-full max-w-sm mb-2" />
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-16 rounded-md" />
                    <Skeleton className="h-5 w-20 rounded-md" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </GhostSection>
    </motion.div>
  )
}

interface GhostSectionProps {
  revealed: boolean
  children: React.ReactNode
  className?: string
}

function GhostSection({ revealed, children, className = '' }: GhostSectionProps) {
  return (
    <motion.div
      className={`
        rounded-2xl border transition-all duration-700
        ${revealed 
          ? 'glass-card border-border/50' 
          : 'bg-secondary/20 border-border/20'
        }
        ${className}
      `}
      animate={{
        filter: revealed ? 'blur(0px)' : 'blur(4px)',
        opacity: revealed ? 1 : 0.6,
      }}
      transition={{ duration: 0.7, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}
