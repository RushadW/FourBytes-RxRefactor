'use client'

import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { ArrowRight, Filter, HelpCircle, Download, MessageSquare, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'

interface FollowUpActionsProps {
  drugName: string
}

export function FollowUpActions({ drugName }: FollowUpActionsProps) {
  const router = useRouter()

  const handleCompareAnother = () => {
    router.push('/')
  }

  const handleFilter = () => {
    toast.info('Filter feature coming soon')
  }

  const handleExplain = () => {
    toast.info('Step therapy explanation coming soon')
  }

  const handleAskFollowUp = () => {
    toast.info('Follow-up questions coming soon')
  }

  const handleDownload = (format: 'pdf' | 'csv') => {
    toast.success(`Downloading ${format.toUpperCase()}...`)
  }

  const suggestions = [
    { label: 'Compare another drug', icon: ArrowRight, action: handleCompareAnother, primary: true },
    { label: 'Filter payers', icon: Filter, action: handleFilter },
    { label: 'Explain step therapy', icon: HelpCircle, action: handleExplain },
  ]

  return (
    <motion.div
      className="glass-card rounded-2xl p-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
          <MessageSquare className="w-4 h-4 text-accent" />
        </div>
        <div>
          <h3 className="font-medium text-foreground text-sm">What would you like to do next?</h3>
          <p className="text-xs text-muted-foreground">Quick actions based on your results</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion, index) => (
          <motion.button
            key={suggestion.label}
            onClick={suggestion.action}
            className={`
              inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all
              ${suggestion.primary 
                ? 'bg-gradient-to-r from-primary to-accent text-white hover:opacity-90' 
                : 'bg-secondary/70 text-foreground hover:bg-secondary'
              }
            `}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6 + index * 0.05 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <suggestion.icon className="w-4 h-4" />
            {suggestion.label}
          </motion.button>
        ))}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <motion.button
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-secondary/70 text-foreground hover:bg-secondary transition-all"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.75 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Download className="w-4 h-4" />
              Download
            </motion.button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="glass-card border-border/50">
            <DropdownMenuItem onClick={() => handleDownload('pdf')}>
              Download as PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDownload('csv')}>
              Download as CSV
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* AI suggestion */}
      <motion.div
        className="mt-4 pt-4 border-t border-border/30"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        <button 
          onClick={handleAskFollowUp}
          className="w-full flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20 hover:bg-primary/10 transition-colors text-left"
        >
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm text-foreground font-medium">Ask a follow-up question</p>
            <p className="text-xs text-muted-foreground">e.g., &quot;What documents do I need for PA?&quot;</p>
          </div>
        </button>
      </motion.div>
    </motion.div>
  )
}
