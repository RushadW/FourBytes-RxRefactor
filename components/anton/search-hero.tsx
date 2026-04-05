'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Search, Sparkles, ArrowRight, GitCompareArrows, Target, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { VoiceOrb } from './voice-orb'
import { useAntonStore } from '@/lib/store'
import { soundEngine } from '@/lib/sounds'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api'

interface SearchHeroProps {
  onSearch?: (query: string) => void
}

export function SearchHero({ onSearch }: SearchHeroProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const startProcessing = useAntonStore((state) => state.startProcessing)
  const [stats, setStats] = useState({ payers: 0, policies: 0 })

  useEffect(() => {
    fetch(`${API_BASE}/matrix`)
      .then(r => r.json())
      .then(data => {
        setStats({
          payers: data.payers?.length || 0,
          policies: data.rows?.reduce((acc: number, row: { cells: Record<string, { has_data: boolean }> }) => acc + Object.values(row.cells).filter((c) => c.has_data).length, 0) || 0,
        })
      })
      .catch(() => {})
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    soundEngine?.processingStart()
    startProcessing(query)
    if (onSearch) {
      onSearch(query)
    } else {
      router.push(`/results?q=${encodeURIComponent(query)}`)
    }
  }

  const handleVoiceTranscript = (text: string) => {
    setQuery(text)
    soundEngine?.processingStart()
    startProcessing(text)
    router.push(`/results?q=${encodeURIComponent(text)}`)
  }

  const handleQuerySelect = (selectedQuery: string) => {
    setQuery(selectedQuery)
  }

  const suggestions = [
    { icon: GitCompareArrows, text: 'Compare Rituximab across payers' },
    { icon: Target, text: 'Does Cigna cover Humira?' },
    { icon: Bell, text: 'What changed this quarter?' },
    { icon: Sparkles, text: 'Bevacizumab step therapy details' },
  ]

  const features = [
    {
      icon: GitCompareArrows,
      title: 'Cross-payer comparison',
      desc: 'See formulary status, tier placement, and PA requirements side by side across all major plans.',
    },
    {
      icon: Target,
      title: 'Instant coverage answers',
      desc: 'Ask in plain language. Get answers pulled directly from live payer documents — no manual searching.',
    },
    {
      icon: Bell,
      title: 'Policy change alerts',
      desc: 'Know the moment a formulary changes. Track step therapy, quantity limits, and coverage exclusions.',
    },
  ]

  return (
    <motion.div
      className="w-full max-w-3xl mx-auto"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      {/* Badge */}
      <motion.div
        className="flex justify-center mb-6"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Real-time coverage intelligence
        </span>
      </motion.div>

      {/* Headline */}
      <motion.div
        className="text-center mb-5"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.15] mb-4">
          Drug coverage,<br />
          <span className="text-gradient">finally clear.</span>
        </h1>
        <p className="text-base sm:text-lg text-muted-foreground max-w-lg mx-auto leading-relaxed">
          Search, compare, and track formulary decisions across every major payer — powered by AI that reads the fine print for you.
        </p>
      </motion.div>

      {/* Search form */}
      <form onSubmit={handleSubmit}>
        <motion.div
          className={`relative rounded-2xl transition-all duration-300 ${isFocused ? 'glow-primary' : ''}`}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className={`
            flex items-center bg-white rounded-2xl overflow-hidden transition-all duration-300 soft-shadow-lg
            ${isFocused ? 'ring-2 ring-primary/30' : 'ring-1 ring-border'}
          `}>
            <div className="pl-5 pr-2">
              <Search className={`w-5 h-5 transition-colors ${isFocused ? 'text-primary' : 'text-muted-foreground'}`} />
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="e.g. Compare Rituximab across payers..."
              className="flex-1 py-4 px-2 text-base bg-transparent outline-none placeholder:text-muted-foreground/50 text-foreground"
            />
            <div className="pr-2 flex items-center gap-1.5">
              <VoiceOrb onTranscript={handleVoiceTranscript} size="sm" />
              <Button
                type="submit"
                size="default"
                className="rounded-xl px-5 bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity shadow-sm"
                disabled={!query.trim()}
              >
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </motion.div>
      </form>

      {/* Query suggestions */}
      <motion.div
        className="mt-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
      >
        <p className="text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-3">Try asking</p>
        <div className="flex flex-wrap justify-center gap-2">
          {suggestions.map((s, index) => {
            const Icon = s.icon
            return (
              <motion.button
                key={s.text}
                onClick={() => handleQuerySelect(s.text)}
                className={`
                  inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm transition-all duration-200
                  ${query === s.text
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-white text-foreground/70 hover:bg-secondary border border-border hover:border-primary/30'
                  }
                `}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + index * 0.06 }}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.97 }}
              >
                <Icon className="w-3.5 h-3.5 opacity-50" />
                {s.text}
              </motion.button>
            )
          })}
        </div>
      </motion.div>

      {/* Stats bar */}
      <motion.div
        className="mt-10 flex items-center justify-center"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <div className="inline-flex items-center bg-white rounded-2xl border border-border soft-shadow divide-x divide-border">
          <div className="px-8 py-4 text-center">
            <p className="text-2xl font-bold text-primary">{stats.payers || '—'}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Payers tracked</p>
          </div>
          <div className="px-8 py-4 text-center">
            <p className="text-2xl font-bold text-primary">{stats.policies || '—'}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Drug policies</p>
          </div>
          <div className="px-8 py-4 text-center">
            <p className="text-2xl font-bold text-emerald-500">Live</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Coverage updates</p>
          </div>
        </div>
      </motion.div>

      {/* Feature cards */}
      <motion.div
        className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        {features.map((f, i) => {
          const Icon = f.icon
          return (
            <motion.div
              key={f.title}
              className="bg-white rounded-2xl border border-border p-5 soft-shadow hover:border-primary/20 transition-colors"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65 + i * 0.08 }}
              whileHover={{ y: -2 }}
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-sm font-bold text-foreground mb-1">{f.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
            </motion.div>
          )
        })}
      </motion.div>
    </motion.div>
  )
}
