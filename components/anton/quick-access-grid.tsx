'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Bell, GitCompareArrows, Upload, TreePine, Network, Mic,
} from 'lucide-react'

const features = [
  {
    href: '/alerts',
    icon: Bell,
    title: 'Smart Alerts',
    description: 'Real-time policy change tracking',
    color: 'from-red-500/20 to-orange-500/20',
    iconColor: 'text-red-400',
    badge: '6 new',
  },
  {
    href: '/diff',
    icon: GitCompareArrows,
    title: 'Policy Diff',
    description: 'Compare versions like GitHub',
    color: 'from-orange-500/20 to-yellow-500/20',
    iconColor: 'text-orange-400',
  },
  {
    href: '/upload',
    icon: Upload,
    title: 'Document Ingest',
    description: 'AI-powered PDF parsing',
    color: 'from-green-500/20 to-emerald-500/20',
    iconColor: 'text-green-400',
  },
  {
    href: '/calculator',
    icon: TreePine,
    title: 'Coverage Calculator',
    description: 'Interactive eligibility check',
    color: 'from-purple-500/20 to-pink-500/20',
    iconColor: 'text-purple-400',
  },
  {
    href: '/graph',
    icon: Network,
    title: 'Knowledge Graph',
    description: 'Visual relationship map',
    color: 'from-cyan-500/20 to-blue-500/20',
    iconColor: 'text-cyan-400',
  },
]

export function QuickAccessGrid() {
  return (
    <motion.div
      className="w-full max-w-3xl mx-auto mt-16"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.6 }}
    >
      <p className="text-center text-sm text-muted-foreground mb-6">Explore tools</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {features.map((feature, i) => {
          const Icon = feature.icon
          return (
            <motion.div
              key={feature.href}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 + i * 0.08 }}
            >
              <Link
                href={feature.href}
                className="group flex flex-col items-center gap-2 p-4 rounded-xl glass-card-light hover:bg-secondary/80 transition-all relative"
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <Icon className={`w-5 h-5 ${feature.iconColor}`} />
                </div>
                <span className="text-xs font-medium text-foreground text-center">{feature.title}</span>
                <span className="text-[10px] text-muted-foreground text-center leading-tight">{feature.description}</span>
                
                {feature.badge && (
                  <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-red-500 text-[9px] font-bold text-white">
                    {feature.badge}
                  </span>
                )}
              </Link>
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}
