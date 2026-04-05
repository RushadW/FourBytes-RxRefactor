'use client'

import { motion } from 'framer-motion'

export function AnimatedBackground({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-transparent overflow-hidden">
      {/* Grid pattern */}
      <div className="fixed inset-0 grid-bg pointer-events-none z-0" />
      <div className="noise-overlay" aria-hidden />
      
      {/* Animated orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <motion.div
          className="orb orb-blue w-[600px] h-[600px] -top-40 -left-40"
          animate={{
            x: [0, 100, 50, 0],
            y: [0, 50, 100, 0],
            scale: [1, 1.1, 0.95, 1],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="orb orb-purple w-[500px] h-[500px] top-1/2 -right-40"
          animate={{
            x: [0, -80, -40, 0],
            y: [0, -60, 30, 0],
            scale: [1, 0.9, 1.05, 1],
          }}
          transition={{
            duration: 30,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="orb orb-blue w-[400px] h-[400px] bottom-20 left-1/3 opacity-50"
          animate={{
            x: [0, 60, -30, 0],
            y: [0, -40, 20, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </div>
      
      {/* Content */}
      <div className="relative z-10 isolate">
        {children}
      </div>
    </div>
  )
}
