'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Sparkles, ArrowRight, GitCompareArrows, Target, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { VoiceOrb } from './voice-orb'
import { useAntonStore } from '@/lib/store'
import { soundEngine } from '@/lib/sounds'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api'

// Predefined questions for autocomplete — like Google search suggestions
const ALL_SUGGESTIONS = [
  // Drug-specific
  'Compare Rituximab across payers',
  'Rituximab step therapy details',
  'Rituximab prior authorization requirements',
  'Rituximab site of care options',
  'Rituximab coverage criteria',
  'Does Cigna cover Rituximab?',
  'Does UnitedHealthcare cover Rituximab?',
  'Compare Humira across payers',
  'Humira step therapy details',
  'Humira prior authorization requirements',
  'Does Cigna cover Humira?',
  'Does UnitedHealthcare cover Humira?',
  'Compare Bevacizumab across payers',
  'Bevacizumab step therapy details',
  'Bevacizumab prior authorization requirements',
  'Bevacizumab site of care options',
  'Does Cigna cover Bevacizumab?',
  'Infliximab step therapy details',
  'Compare Infliximab across payers',
  'Infliximab prior authorization requirements',
  'Trastuzumab coverage criteria',
  'Compare Trastuzumab across payers',
  'Pembrolizumab prior authorization requirements',
  'Compare Pembrolizumab across payers',
  'Nivolumab step therapy details',
  'Compare Nivolumab across payers',
  'Ocrelizumab step therapy details',
  'Compare Ocrelizumab across payers',
  'Dupilumab prior authorization requirements',
  'Compare Dupilumab across payers',
  'Ustekinumab coverage criteria',
  'Compare Ustekinumab across payers',
  'Vedolizumab step therapy details',
  'Natalizumab prior authorization requirements',
  'Secukinumab coverage criteria',
  'Denosumab step therapy details',
  'Botulinum Toxin prior authorization requirements',
  // Payer-specific
  'What does Cigna cover?',
  'What does UnitedHealthcare cover?',
  'What does Blue Cross Blue Shield cover?',
  'What does Priority Health cover?',
  // General
  'What changed this quarter?',
  'Show all drugs across all payers',
  'Which drugs require step therapy?',
  'Which drugs require prior authorization?',
  'Compare all drugs across payers',
]

interface SearchHeroProps {
  onSearch?: (query: string) => void
}

export function SearchHero({ onSearch }: SearchHeroProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const startProcessing = useAntonStore((state) => state.startProcessing)
  const [stats, setStats] = useState({ payers: 0, policies: 0 })
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)

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
        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card text-xs font-semibold text-primary shadow-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 ring-2 ring-emerald-400/30" />
          </span>
          Live payer policy intelligence
        </span>
      </motion.div>

      {/* Headline */}
      <motion.div
        className="text-center mb-5"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <h1 className="text-4xl sm:text-[2.75rem] font-bold tracking-tight leading-[1.12] mb-5 text-foreground">
          Drug coverage,<br />
          <span className="text-gradient">finally clear.</span>
        </h1>
        <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
          Ask in plain language. Compare step therapy, PA, and sites of care across plans — with answers tied back to real policy documents.
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
            flex items-center bg-white rounded-2xl transition-all duration-300 soft-shadow-lg relative
            ${isFocused ? 'ring-2 ring-primary/30' : 'ring-1 ring-border'}
          `}>
            <div className="pl-5 pr-2">
              <Search className={`w-5 h-5 transition-colors ${isFocused ? 'text-primary' : 'text-muted-foreground'}`} />
            </div>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                const val = e.target.value
                setQuery(val)
                if (val.trim().length >= 1) {
                  const lower = val.toLowerCase()
                  const matches = ALL_SUGGESTIONS.filter(s => s.toLowerCase().includes(lower)).slice(0, 6)
                  setFilteredSuggestions(matches)
                  setShowDropdown(matches.length > 0)
                  setSelectedIdx(-1)
                } else {
                  setFilteredSuggestions([])
                  setShowDropdown(false)
                }
              }}
              onKeyDown={(e) => {
                if (showDropdown && filteredSuggestions.length > 0) {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    setSelectedIdx(prev => (prev + 1) % filteredSuggestions.length)
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    setSelectedIdx(prev => (prev <= 0 ? filteredSuggestions.length - 1 : prev - 1))
                  } else if (e.key === 'Enter' && selectedIdx >= 0) {
                    e.preventDefault()
                    setQuery(filteredSuggestions[selectedIdx])
                    setShowDropdown(false)
                  } else if (e.key === 'Escape') {
                    setShowDropdown(false)
                  }
                }
              }}
              onFocus={() => {
                setIsFocused(true)
                if (query.trim().length >= 1) {
                  const lower = query.toLowerCase()
                  const matches = ALL_SUGGESTIONS.filter(s => s.toLowerCase().includes(lower)).slice(0, 6)
                  setFilteredSuggestions(matches)
                  setShowDropdown(matches.length > 0)
                }
              }}
              onBlur={() => { setIsFocused(false); setTimeout(() => setShowDropdown(false), 150) }}
              placeholder="e.g. Compare Rituximab across payers..."
              className="flex-1 py-4 px-2 text-base bg-transparent outline-none placeholder:text-muted-foreground/50 text-foreground"
              autoComplete="off"
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

            {/* Autocomplete dropdown — Google-style */}
            <AnimatePresence>
              {showDropdown && filteredSuggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute top-full left-0 right-0 mt-1 bg-white border border-border/80 rounded-2xl shadow-2xl overflow-hidden z-[100]"
                >
                  {filteredSuggestions.map((s, i) => {
                    // Highlight the matching part
                    const lower = query.toLowerCase()
                    const idx = s.toLowerCase().indexOf(lower)
                    const before = idx >= 0 ? s.slice(0, idx) : s
                    const match = idx >= 0 ? s.slice(idx, idx + query.length) : ''
                    const after = idx >= 0 ? s.slice(idx + query.length) : ''

                    return (
                      <button
                        key={s}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          setQuery(s)
                          setShowDropdown(false)
                          inputRef.current?.focus()
                        }}
                        className={`
                          w-full text-left px-5 py-3 text-sm flex items-center gap-3 transition-colors
                          ${i === selectedIdx ? 'bg-slate-50' : 'hover:bg-slate-50/70'}
                          ${i < filteredSuggestions.length - 1 ? 'border-b border-slate-100' : ''}
                        `}
                      >
                        <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <span className="truncate">
                          {idx >= 0 ? (
                            <>{before}<strong className="font-semibold text-foreground">{match}</strong>{after}</>
                          ) : s}
                        </span>
                        <ArrowRight className={`w-3 h-3 ml-auto flex-shrink-0 transition-opacity ${i === selectedIdx ? 'text-slate-400 opacity-100' : 'opacity-0'}`} />
                      </button>
                    )
                  })}
                </motion.div>
              )}
            </AnimatePresence>
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
        <div className="inline-flex flex-wrap items-stretch justify-center gap-px rounded-2xl border border-border/80 bg-card/90 backdrop-blur-md soft-shadow-lg overflow-hidden">
          <div className="px-7 sm:px-9 py-4 text-center min-w-[120px] bg-gradient-to-b from-white to-white/90">
            <p className="text-2xl sm:text-3xl font-bold tabular-nums bg-gradient-to-br from-primary to-violet-600 bg-clip-text text-transparent">
              {stats.payers || '—'}
            </p>
            <p className="text-[11px] font-medium text-muted-foreground mt-1">Payers tracked</p>
          </div>
          <div className="px-7 sm:px-9 py-4 text-center min-w-[120px] bg-gradient-to-b from-white to-white/90 border-x border-border/60">
            <p className="text-2xl sm:text-3xl font-bold tabular-nums bg-gradient-to-br from-primary to-violet-600 bg-clip-text text-transparent">
              {stats.policies || '—'}
            </p>
            <p className="text-[11px] font-medium text-muted-foreground mt-1">Policy cells</p>
          </div>
          <div className="px-7 sm:px-9 py-4 text-center min-w-[120px] bg-gradient-to-b from-white to-white/90">
            <p className="text-2xl sm:text-3xl font-bold text-emerald-600 tabular-nums">Live</p>
            <p className="text-[11px] font-medium text-muted-foreground mt-1">Matrix sync</p>
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
              className="group relative bg-card rounded-2xl border border-border/80 p-5 soft-shadow hover-lift hover:border-primary/25 overflow-hidden"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65 + i * 0.08 }}
              whileHover={{ y: -2 }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-transparent to-teal-500/[0.05] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/15 to-teal-500/10 flex items-center justify-center mb-3.5 ring-1 ring-primary/10">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-sm font-bold text-foreground mb-1.5">{f.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            </motion.div>
          )
        })}
      </motion.div>
    </motion.div>
  )
}
