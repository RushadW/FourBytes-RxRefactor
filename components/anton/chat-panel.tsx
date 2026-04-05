'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageCircle, X, Send, Sparkles, User, Mic, Volume2,
  ChevronDown, Loader2, Bot,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { VoiceOrb, SpeakButton } from './voice-orb'
import { useVoice } from '@/hooks/use-voice'
import { parseQuery, getDrugById, getPoliciesForDrug, drugs, payerPolicies } from '@/lib/mock-data'
import { cn } from '@/lib/utils'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isStreaming?: boolean
}

// Simple AI response generator (simulates streaming)
function generateChatResponse(query: string): string {
  const q = query.toLowerCase()
  const parsed = parseQuery(query)
  
  if (q.includes('compare') || q.includes('across') || q.includes('difference')) {
    const drug = parsed.drug !== 'Unknown drug' ? parsed.drug : 'Rituximab'
    const drugId = drug.toLowerCase()
    const policies = getPoliciesForDrug(drugId === 'humira' ? 'humira' : drugId === 'bevacizumab' ? 'bevacizumab' : 'rituximab')
    
    const paNames = policies.map(p => p.payerName).join(', ')
    const stPayers = policies.filter(p => p.stepTherapy).map(p => p.payerName)
    const noStPayers = policies.filter(p => !p.stepTherapy).map(p => p.payerName)
    
    let resp = `Here's a comparison of **${drug}** across ${paNames}:\n\n`
    resp += `**Prior Authorization:** All ${policies.length} payers require prior authorization.\n\n`
    
    if (stPayers.length > 0) {
      resp += `**Step Therapy:** ${stPayers.join(', ')} require${stPayers.length === 1 ? 's' : ''} step therapy. `
      if (noStPayers.length > 0) resp += `${noStPayers.join(', ')} do${noStPayers.length === 1 ? 'es' : ''} not.\n\n`
      else resp += '\n\n'
    } else {
      resp += `**Step Therapy:** None of the payers require step therapy.\n\n`
    }
    
    resp += `**Site of Care Options:**\n`
    policies.forEach(p => {
      resp += `- **${p.payerName}:** ${p.siteOfCare.join(', ')}\n`
    })
    
    resp += `\n💡 **Key Insight:** `
    if (noStPayers.length > 0) {
      resp += `${noStPayers[0]} offers the most direct path to approval with no step therapy requirement.`
    } else {
      resp += `All payers have similar restrictive requirements. Start the PA process early.`
    }
    
    return resp
  }
  
  if (q.includes('cover') && (q.includes('cigna') || q.includes('uhc') || q.includes('united') || q.includes('bcbs') || q.includes('blue'))) {
    let payer = 'Cigna'
    let payerId = 'cigna'
    if (q.includes('uhc') || q.includes('united')) { payer = 'UnitedHealthcare'; payerId = 'uhc' }
    if (q.includes('bcbs') || q.includes('blue')) { payer = 'Blue Cross Blue Shield'; payerId = 'bcbs' }
    
    const policies = payerPolicies.filter(p => p.payerId === payerId)
    const drugNames = policies.map(p => {
      const d = getDrugById(p.drugId)
      return d?.name || p.drugId
    })
    
    let resp = `**${payer}** covers the following drugs in our database:\n\n`
    policies.forEach(p => {
      const d = getDrugById(p.drugId)
      resp += `- **${d?.name || p.drugId}** — PA: ${p.priorAuth ? '✅ Required' : '❌ Not required'}, Step Therapy: ${p.stepTherapy ? '⚠️ Required' : '✅ Not required'}\n`
    })
    resp += `\nWould you like details on any specific drug?`
    return resp
  }
  
  if (q.includes('prior auth') || q.includes('authorization')) {
    return `**Prior Authorization Overview:**\n\nAll payers in our database require prior authorization for medical benefit drugs.\n\n**Submission Methods:**\n- **Cigna:** eviCore portal\n- **UnitedHealthcare:** CoverMyMeds or fax\n- **BCBS:** Must be submitted within 30 days of treatment\n\n**Pro Tip:** UHC generally has the fastest turnaround time. Start all PA submissions at least 2 weeks before planned treatment date.`
  }
  
  if (q.includes('step therapy')) {
    return `**Step Therapy Requirements:**\n\n| Drug | Cigna | UHC | BCBS |\n|------|-------|-----|------|\n| Rituximab | ⚠️ Required (MTX first) | ✅ Not required | ⚠️ Autoimmune only |\n| Humira | ⚠️ 2 TNF inhibitors | ✅ Preferred biologic | ⚠️ Biosimilar first |\n\n💡 UnitedHealthcare is the most lenient on step therapy requirements across the board.`
  }
  
  if (q.includes('change') || q.includes('update') || q.includes('new')) {
    return `**Recent Policy Changes (Q1 2026):**\n\n🔴 **Cigna** — Added biosimilar step therapy requirement for Humira (effective Jan 2026)\n🟡 **BCBS** — Updated Rituximab criteria: now requires specialist treatment plan\n🟢 **UHC** — Expanded site-of-care options to include home infusion for Rituximab\n\nTotal policies updated this quarter: **8 across 3 payers**\n\nWould you like me to drill into any specific change?`
  }
  
  if (q.includes('help') || q.includes('what can')) {
    return `I'm **RxRefactor AI**, your medical policy intelligence assistant. Here's what I can help with:\n\n🔍 **Compare drugs across payers** — "Compare Rituximab across all payers"\n📋 **Check coverage** — "Does Cigna cover Humira?"\n⚡ **Prior auth info** — "What are the PA requirements for biologics?"\n📊 **Step therapy** — "Which payers require step therapy?"\n🔄 **Policy changes** — "What changed in policies this quarter?"\n\nJust ask in natural language, or use the voice button! 🎤`
  }
  
  return `Based on your query about "${parsed.drug !== 'Unknown drug' ? parsed.drug : 'drug policies'}":\n\nI found **${payerPolicies.length} policies** across **3 payers** (Cigna, UnitedHealthcare, BCBS) covering **${drugs.length} drugs** in our database.\n\n**Quick Stats:**\n- ${payerPolicies.filter(p => p.priorAuth).length}/${payerPolicies.length} policies require prior authorization\n- ${payerPolicies.filter(p => p.stepTherapy).length}/${payerPolicies.length} have step therapy requirements\n\nTry asking something more specific like:\n- "Compare Rituximab across payers"\n- "What step therapy does Cigna require?"\n- "Show me recent policy changes"`
}

export function ChatPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hi! I\'m **RxRefactor AI**. Ask me anything about drug coverage policies. Try "Compare Rituximab across payers" or use the mic to speak! 🎤',
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const simulateStreaming = useCallback((fullText: string, msgId: string) => {
    let idx = 0
    const words = fullText.split(' ')
    
    const stream = () => {
      if (idx < words.length) {
        const chunk = words.slice(0, idx + 1).join(' ')
        setMessages(prev =>
          prev.map(m =>
            m.id === msgId ? { ...m, content: chunk, isStreaming: idx < words.length - 1 } : m
          )
        )
        idx++
        setTimeout(stream, 20 + Math.random() * 30)
      } else {
        setMessages(prev =>
          prev.map(m => (m.id === msgId ? { ...m, isStreaming: false } : m))
        )
        setIsTyping(false)
      }
    }
    stream()
  }, [])

  const handleSend = useCallback((text?: string) => {
    const msg = text || input.trim()
    if (!msg) return

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: msg,
      timestamp: new Date(),
    }

    const assistantId = `assistant-${Date.now()}`
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    }

    setMessages(prev => [...prev, userMsg, assistantMsg])
    setInput('')
    setIsTyping(true)

    // Simulate a brief "thinking" delay then stream
    setTimeout(() => {
      const response = generateChatResponse(msg)
      simulateStreaming(response, assistantId)
    }, 500 + Math.random() * 500)
  }, [input, simulateStreaming])

  const handleVoiceTranscript = useCallback((text: string) => {
    handleSend(text)
  }, [handleSend])

  return (
    <>
      {/* FAB button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg"
            onClick={() => setIsOpen(true)}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <MessageCircle className="w-6 h-6 text-white" />
            <motion.div
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-white"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed bottom-6 right-6 z-50 w-[420px] h-[600px] flex flex-col glass-card rounded-2xl overflow-hidden border border-border/50 shadow-2xl"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border/30">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">RxRefactor AI</h3>
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                    Online
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  className={cn('flex gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start')}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Bot className="w-3.5 h-3.5 text-primary" />
                    </div>
                  )}
                  <div
                    className={cn(
                      'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : 'bg-secondary/80 text-foreground rounded-bl-md'
                    )}
                  >
                    <div className="whitespace-pre-wrap">
                      {msg.content.split(/(\*\*.*?\*\*)/).map((part, i) => {
                        if (part.startsWith('**') && part.endsWith('**')) {
                          return <strong key={i}>{part.slice(2, -2)}</strong>
                        }
                        return <span key={i}>{part}</span>
                      })}
                      {msg.isStreaming && (
                        <motion.span
                          className="inline-block w-1.5 h-4 bg-primary ml-0.5 -mb-0.5"
                          animate={{ opacity: [1, 0] }}
                          transition={{ duration: 0.5, repeat: Infinity }}
                        />
                      )}
                    </div>
                    {msg.role === 'assistant' && !msg.isStreaming && msg.content && (
                      <div className="mt-1 flex justify-end">
                        <SpeakButton text={msg.content.replace(/\*\*/g, '').replace(/[#|_\-]/g, '')} />
                      </div>
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-7 h-7 rounded-lg bg-accent/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <User className="w-3.5 h-3.5 text-accent" />
                    </div>
                  )}
                </motion.div>
              ))}

              {isTyping && !messages[messages.length - 1]?.isStreaming && (
                <motion.div
                  className="flex gap-2 items-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
                    <Bot className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="flex gap-1 px-4 py-3 rounded-2xl bg-secondary/80">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="w-2 h-2 rounded-full bg-muted-foreground"
                        animate={{ y: [0, -6, 0] }}
                        transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-border/30">
              <div className="flex items-center gap-2">
                <VoiceOrb
                  onTranscript={handleVoiceTranscript}
                  size="sm"
                />
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Ask about drug policies..."
                  className="flex-1 bg-secondary/50 rounded-xl px-4 py-2.5 text-sm outline-none border border-border/30 focus:border-primary/50 transition-colors placeholder:text-muted-foreground/50"
                />
                <Button
                  size="sm"
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isTyping}
                  className="rounded-xl px-3"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
