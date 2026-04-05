'use client'

import { motion } from 'framer-motion'
import { 
  FileCheck, 
  Clock, 
  MapPin, 
  TrendingUp,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react'
import type { PayerPolicy } from '@/lib/types'

interface SummaryCardsProps {
  policies: PayerPolicy[]
}

export function SummaryCards({ policies }: SummaryCardsProps) {
  const priorAuthRequired = policies.filter(p => p.priorAuth).length
  const stepTherapyRequired = policies.filter(p => p.stepTherapy).length
  const homeInfusionAvailable = policies.filter(p => p.siteOfCare.includes('Home Infusion')).length
  const avgConfidence = policies.filter(p => p.confidence === 'high').length / policies.length * 100

  const cards = [
    {
      icon: FileCheck,
      label: 'Prior Auth Required',
      value: priorAuthRequired,
      total: policies.length,
      trend: priorAuthRequired === policies.length ? 'all' : priorAuthRequired === 0 ? 'none' : 'some',
      color: priorAuthRequired === policies.length ? 'amber' : 'blue',
      gradient: 'from-blue-500/20 to-blue-600/5',
    },
    {
      icon: Clock,
      label: 'Step Therapy',
      value: stepTherapyRequired,
      total: policies.length,
      trend: stepTherapyRequired === 0 ? 'none' : stepTherapyRequired === policies.length ? 'all' : 'some',
      color: stepTherapyRequired > 0 ? 'amber' : 'green',
      gradient: stepTherapyRequired > 0 ? 'from-amber-500/20 to-amber-600/5' : 'from-green-500/20 to-green-600/5',
    },
    {
      icon: MapPin,
      label: 'Home Infusion',
      value: homeInfusionAvailable,
      total: policies.length,
      trend: homeInfusionAvailable === policies.length ? 'all' : homeInfusionAvailable === 0 ? 'none' : 'some',
      color: homeInfusionAvailable > 0 ? 'green' : 'red',
      gradient: homeInfusionAvailable > 0 ? 'from-green-500/20 to-green-600/5' : 'from-red-500/20 to-red-600/5',
    },
    {
      icon: TrendingUp,
      label: 'Data Confidence',
      value: Math.round(avgConfidence),
      total: 100,
      isPercentage: true,
      trend: avgConfidence >= 80 ? 'all' : avgConfidence >= 50 ? 'some' : 'none',
      color: avgConfidence >= 80 ? 'green' : avgConfidence >= 50 ? 'amber' : 'red',
      gradient: avgConfidence >= 80 ? 'from-green-500/20 to-green-600/5' : 'from-amber-500/20 to-amber-600/5',
    },
  ]

  const colorClasses = {
    blue: { icon: 'text-blue-400', bg: 'bg-blue-500/20', ring: 'ring-blue-500/30' },
    green: { icon: 'text-green-400', bg: 'bg-green-500/20', ring: 'ring-green-500/30' },
    amber: { icon: 'text-amber-400', bg: 'bg-amber-500/20', ring: 'ring-amber-500/30' },
    red: { icon: 'text-red-400', bg: 'bg-red-500/20', ring: 'ring-red-500/30' },
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, index) => {
        const colors = colorClasses[card.color as keyof typeof colorClasses]
        const percentage = card.isPercentage ? card.value : (card.value / card.total) * 100
        
        return (
          <motion.div
            key={card.label}
            className={`
              relative glass-card rounded-xl p-5 hover-lift overflow-hidden
            `}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.1 + index * 0.1, duration: 0.4 }}
          >
            {/* Gradient background */}
            <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} pointer-events-none`} />
            
            <div className="relative">
              {/* Icon */}
              <div className={`w-10 h-10 rounded-xl ${colors.bg} ring-1 ${colors.ring} flex items-center justify-center mb-4`}>
                <card.icon className={`w-5 h-5 ${colors.icon}`} />
              </div>
              
              {/* Value */}
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-3xl font-bold text-foreground">
                  {card.value}
                </span>
                {!card.isPercentage && (
                  <span className="text-lg text-muted-foreground">/{card.total}</span>
                )}
                {card.isPercentage && (
                  <span className="text-lg text-muted-foreground">%</span>
                )}
              </div>
              
              <p className="text-xs text-muted-foreground">{card.label}</p>
              
              {/* Mini progress bar */}
              <div className="mt-3 h-1 rounded-full bg-secondary overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${colors.bg.replace('/20', '')}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ delay: 0.3 + index * 0.1, duration: 0.6 }}
                  style={{ background: card.color === 'green' ? '#22c55e' : card.color === 'amber' ? '#f59e0b' : card.color === 'red' ? '#ef4444' : '#3b82f6' }}
                />
              </div>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
