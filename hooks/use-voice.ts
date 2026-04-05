'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

interface UseVoiceOptions {
  onResult?: (transcript: string) => void
  onInterimResult?: (transcript: string) => void
  continuous?: boolean
  lang?: string
}

interface UseVoiceReturn {
  isListening: boolean
  transcript: string
  interimTranscript: string
  startListening: () => void
  stopListening: () => void
  toggleListening: () => void
  isSupported: boolean
  speak: (text: string) => void
  isSpeaking: boolean
  stopSpeaking: () => void
  volume: number
}

export function useVoice(options: UseVoiceOptions = {}): UseVoiceReturn {
  const { onResult, onInterimResult, continuous = false, lang = 'en-US' } = options
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [volume, setVolume] = useState(0)
  const [isSupported, setIsSupported] = useState(false)

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const synthRef = useRef<SpeechSynthesis | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef<number>(0)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      setIsSupported(!!SpeechRecognition)
      synthRef.current = window.speechSynthesis
    }
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }
    }
  }, [])

  const startVolumeTracking = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const audioCtx = new AudioContext()
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyserRef.current = analyser

      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      const tick = () => {
        analyser.getByteFrequencyData(dataArray)
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
        setVolume(avg / 255)
        animFrameRef.current = requestAnimationFrame(tick)
      }
      tick()
    } catch {
      // Microphone access denied
    }
  }, [])

  const stopVolumeTracking = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setVolume(0)
  }, [])

  const startListening = useCallback(() => {
    if (!isSupported) return
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.continuous = continuous
    recognition.interimResults = true
    recognition.lang = lang

    recognition.onstart = () => setIsListening(true)
    
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ''
      let final = ''
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          final += t
        } else {
          interim += t
        }
      }
      
      if (interim) {
        setInterimTranscript(interim)
        onInterimResult?.(interim)
      }
      if (final) {
        setTranscript(final)
        setInterimTranscript('')
        onResult?.(final)
      }
    }

    recognition.onerror = () => {
      setIsListening(false)
      stopVolumeTracking()
    }

    recognition.onend = () => {
      setIsListening(false)
      stopVolumeTracking()
    }

    recognitionRef.current = recognition
    recognition.start()
    startVolumeTracking()
  }, [isSupported, continuous, lang, onResult, onInterimResult, startVolumeTracking, stopVolumeTracking])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setIsListening(false)
    stopVolumeTracking()
  }, [stopVolumeTracking])

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }, [isListening, startListening, stopListening])

  const speak = useCallback((text: string) => {
    if (!synthRef.current) return
    synthRef.current.cancel()
    
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1.0
    utterance.pitch = 1.0
    utterance.volume = 1.0
    utterance.lang = lang
    
    // Try to use a natural voice
    const voices = synthRef.current.getVoices()
    const preferred = voices.find(v => v.name.includes('Samantha') || v.name.includes('Google') || v.name.includes('Natural'))
    if (preferred) utterance.voice = preferred
    
    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)
    
    synthRef.current.speak(utterance)
  }, [lang])

  const stopSpeaking = useCallback(() => {
    synthRef.current?.cancel()
    setIsSpeaking(false)
  }, [])

  return {
    isListening,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    toggleListening,
    isSupported,
    speak,
    isSpeaking,
    stopSpeaking,
    volume,
  }
}

// Add global type declarations
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition
    webkitSpeechRecognition: typeof SpeechRecognition
  }
}
