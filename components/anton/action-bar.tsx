'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Share2, RotateCcw, Copy, Link, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { useAntonStore } from '@/lib/store'
import { AIThinking } from './ai-thinking'

interface ActionBarProps {
  summary: string
  query: string
}

export function ActionBar({ summary, query }: ActionBarProps) {
  const [isReplayOpen, setIsReplayOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopyText = () => {
    navigator.clipboard.writeText(`RxRefactor Analysis: ${summary}\n\nQuery: ${query}`)
    setCopied(true)
    toast.success('Copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    toast.success('Link copied to clipboard')
  }

  return (
    <>
      <motion.div
        className="flex items-center gap-1"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        {/* Share dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground hover:text-foreground">
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Share2 className="w-3.5 h-3.5" />}
              <span className="text-xs">Share</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="glass-card border-border/50">
            <DropdownMenuItem onClick={handleCopyText} className="cursor-pointer">
              <Copy className="w-4 h-4 mr-2" />
              Copy summary
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCopyLink} className="cursor-pointer">
              <Link className="w-4 h-4 mr-2" />
              Copy link
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Replay button */}
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={() => setIsReplayOpen(true)}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="text-xs">Replay AI</span>
        </Button>
      </motion.div>

      {/* Replay Dialog */}
      <Dialog open={isReplayOpen} onOpenChange={setIsReplayOpen}>
        <DialogContent className="sm:max-w-lg glass-card border-border/50">
          <DialogHeader>
            <DialogTitle>AI Thinking Replay</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <ReplayContent onComplete={() => {}} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function ReplayContent({ onComplete }: { onComplete: () => void }) {
  const [stage, setStage] = useState(0)
  const stages = ['understanding', 'identifying', 'detecting', 'complete'] as const
  
  const updateAIThinking = useAntonStore((state) => state.updateAIThinking)

  useState(() => {
    let currentStage = 0
    const interval = setInterval(() => {
      if (currentStage < stages.length) {
        updateAIThinking(stages[currentStage])
        setStage(currentStage)
        currentStage++
      } else {
        clearInterval(interval)
        onComplete()
      }
    }, 1000)

    return () => clearInterval(interval)
  })

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <AIThinking />
    </motion.div>
  )
}
