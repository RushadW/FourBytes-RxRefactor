'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Search, Sparkles, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { VoiceOrb } from './voice-orb'
import { useAntonStore } from '@/lib/store'
import { soundEngine } from '@/lib/sounds'

interface SearchHeroProps {
  onSearch?: (query: string) => void
}

export function SearchHero({ onSearch }: SearchHeroProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const startProcessing = useAntonStore((state) => state.startProcessing)

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

  return (
    <motion.div
      className="w-full max-w-2xl mx-auto"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      {/* Logo and tagline */}
      <motion.div
        className="text-center mb-10"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <motion.div className="inline-flex items-center justify-center mb-5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
        </motion.div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-3">
          <span className="text-gradient">Anton Rx</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-sm mx-auto leading-relaxed">
          Ask anything about drug coverage. <br className="hidden sm:block" />AI does the rest.
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
        className="mt-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <p className="text-center text-xs text-muted-foreground mb-3">Try asking</p>
        <div className="flex flex-wrap justify-center gap-2">
          {[
            'Compare Rituximab across payers',
            'Does Cigna cover Humira?',
            'What changed in policies this quarter?',
          ].map((suggestion, index) => (
            <motion.button
              key={suggestion}
              onClick={() => handleQuerySelect(suggestion)}
              className={`
                px-4 py-2 rounded-full text-sm transition-all duration-200
                ${query === suggestion
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-white text-foreground/70 hover:bg-secondary border border-border hover:border-primary/30'
                }
              `}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + index * 0.08 }}
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.97 }}
            >
              {suggestion}
            </motion.button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}
