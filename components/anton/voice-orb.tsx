'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, MicOff, Volume2, VolumeX, X } from 'lucide-react'
import { useVoice } from '@/hooks/use-voice'
import { cn } from '@/lib/utils'

interface VoiceOrbProps {
  onTranscript: (text: string) => void
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function VoiceOrb({ onTranscript, className, size = 'md' }: VoiceOrbProps) {
  const [showOverlay, setShowOverlay] = useState(false)
  const hasSubmittedRef = useRef(false)

  const handleResult = useCallback((text: string) => {
    if (text.trim() && !hasSubmittedRef.current) {
      hasSubmittedRef.current = true
      onTranscript(text.trim())
      setTimeout(() => setShowOverlay(false), 600)
    }
  }, [onTranscript])

  const {
    isListening,
    interimTranscript,
    startListening,
    stopListening,
    isSupported,
    volume,
  } = useVoice({
    onResult: handleResult,
  })

  const handleClick = () => {
    if (!isSupported) return
    if (isListening) {
      stopListening()
      setShowOverlay(false)
    } else {
      hasSubmittedRef.current = false
      setShowOverlay(true)
      startListening()
    }
  }

  const handleClose = () => {
    stopListening()
    setShowOverlay(false)
  }

  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-12 h-12',
    lg: 'w-14 h-14',
  }

  if (!isSupported) return null

  return (
    <>
      {/* Mic Button */}
      <motion.button
        type="button"
        onClick={handleClick}
        className={cn(
          'relative rounded-full flex items-center justify-center transition-all',
          'bg-gradient-to-br from-primary/20 to-accent/20 hover:from-primary/30 hover:to-accent/30',
          'border border-primary/30',
          sizeClasses[size],
          isListening && 'from-red-500/30 to-red-600/30 border-red-500/50',
          className,
        )}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {isListening ? (
          <MicOff className="w-5 h-5 text-red-400" />
        ) : (
          <Mic className="w-5 h-5 text-primary" />
        )}
        
        {/* Pulse ring when listening */}
        {isListening && (
          <>
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-red-400/40"
              animate={{ scale: [1, 1.4 + volume * 0.6], opacity: [0.6, 0] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
            <motion.div
              className="absolute inset-0 rounded-full border border-red-400/20"
              animate={{ scale: [1, 1.8 + volume * 0.8], opacity: [0.4, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          </>
        )}
      </motion.button>

      {/* Full-screen voice overlay */}
      <AnimatePresence>
        {showOverlay && (
          <motion.div
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/95 backdrop-blur-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Close button */}
            <button
              onClick={handleClose}
              className="absolute top-6 right-6 p-2 rounded-full hover:bg-secondary transition-colors"
            >
              <X className="w-6 h-6 text-muted-foreground" />
            </button>

            {/* Central orb */}
            <div className="relative mb-12">
              <motion.div
                className="w-32 h-32 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center"
                animate={{
                  scale: isListening ? [1, 1.1 + volume * 0.4, 1] : 1,
                  boxShadow: isListening
                    ? [
                        '0 0 40px rgba(59,130,246,0.3)',
                        `0 0 ${60 + volume * 80}px rgba(59,130,246,${0.4 + volume * 0.3})`,
                        '0 0 40px rgba(59,130,246,0.3)',
                      ]
                    : '0 0 20px rgba(59,130,246,0.2)',
                }}
                transition={{ duration: 0.3, repeat: isListening ? Infinity : 0 }}
              >
                <Mic className="w-12 h-12 text-white" />
              </motion.div>

              {/* Volume rings */}
              {isListening && (
                <>
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="absolute inset-0 rounded-full border border-primary/20"
                      animate={{
                        scale: [1, 2 + i * 0.5 + volume * 1.5],
                        opacity: [0.3 - i * 0.08, 0],
                      }}
                      transition={{
                        duration: 2 + i * 0.3,
                        repeat: Infinity,
                        delay: i * 0.4,
                      }}
                    />
                  ))}
                </>
              )}
            </div>

            {/* Status text */}
            <motion.p
              className="text-2xl font-semibold text-foreground mb-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {isListening ? 'Listening...' : 'Processing...'}
            </motion.p>

            {/* Interim transcript */}
            <AnimatePresence mode="wait">
              {interimTranscript && (
                <motion.div
                  className="max-w-lg text-center px-8"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <p className="text-lg text-muted-foreground italic">
                    &ldquo;{interimTranscript}&rdquo;
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Waveform visualization */}
            {isListening && (
              <div className="flex items-center gap-1 mt-8">
                {Array.from({ length: 20 }).map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-1 rounded-full bg-primary"
                    animate={{
                      height: [4, 8 + Math.random() * volume * 40 + Math.sin(i) * 8, 4],
                    }}
                    transition={{
                      duration: 0.3 + Math.random() * 0.3,
                      repeat: Infinity,
                      delay: i * 0.05,
                    }}
                  />
                ))}
              </div>
            )}

            <p className="mt-8 text-sm text-muted-foreground/60">
              Say something like &ldquo;Compare Rituximab across payers&rdquo;
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// Speaker button for TTS
interface SpeakButtonProps {
  text: string
  className?: string
}

export function SpeakButton({ text, className }: SpeakButtonProps) {
  const { speak, isSpeaking, stopSpeaking, isSupported } = useVoice({})

  if (!isSupported) return null

  return (
    <motion.button
      onClick={() => (isSpeaking ? stopSpeaking() : speak(text))}
      className={cn(
        'p-2 rounded-lg transition-colors',
        isSpeaking
          ? 'bg-primary/20 text-primary'
          : 'hover:bg-secondary/50 text-muted-foreground hover:text-foreground',
        className,
      )}
      whileTap={{ scale: 0.95 }}
      title={isSpeaking ? 'Stop speaking' : 'Read aloud'}
    >
      {isSpeaking ? (
        <VolumeX className="w-4 h-4" />
      ) : (
        <Volume2 className="w-4 h-4" />
      )}
    </motion.button>
  )
}
