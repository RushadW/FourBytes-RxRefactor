'use client'

import { motion } from 'framer-motion'

interface ProgressLineProps {
  progress: number // 0-100
  className?: string
}

export function ProgressLine({ progress, className = '' }: ProgressLineProps) {
  return (
    <div className={`relative h-2 bg-secondary rounded-full overflow-hidden ${className}`}>
      <motion.div
        className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary via-accent to-primary rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        style={{
          backgroundSize: '200% 100%',
        }}
      />
      
      {/* Shimmer effect */}
      {progress > 0 && progress < 100 && (
        <motion.div
          className="absolute inset-y-0 w-16 bg-gradient-to-r from-transparent via-white/30 to-transparent"
          animate={{ 
            left: ['-10%', '110%'],
          }}
          transition={{ 
            duration: 1.5, 
            repeat: Infinity,
            ease: 'easeInOut'
          }}
        />
      )}
      
      {/* Glow at end */}
      {progress > 0 && progress < 100 && (
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-primary blur-sm"
          style={{ left: `calc(${progress}% - 8px)` }}
          animate={{ 
            opacity: [0.5, 1, 0.5],
            scale: [0.8, 1, 0.8]
          }}
          transition={{ duration: 1, repeat: Infinity }}
        />
      )}
    </div>
  )
}
