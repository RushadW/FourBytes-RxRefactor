import { create } from 'zustand'
import type { ProcessingStep, AIThinking, GhostState, ComparisonResult } from './types'
import { processingSteps as initialSteps, parseQuery, generateComparisonResult } from './mock-data'
import { fetchComparison } from './api'

interface AntonStore {
  // Query state
  query: string
  drugId: string
  setQuery: (query: string) => void
  
  // AI Thinking state
  aiThinking: AIThinking
  updateAIThinking: (stage: AIThinking['stage']) => void
  
  // Processing state
  isProcessing: boolean
  processingSteps: ProcessingStep[]
  currentStepIndex: number
  startTime: number
  
  // Ghost preview state
  ghostState: GhostState
  revealGhostSection: (section: keyof GhostState) => void
  
  // Results
  result: ComparisonResult | null
  
  // Actions
  startProcessing: (query: string) => void
  advanceStep: () => void
  completeProcessing: () => Promise<void>
  resetProcessing: () => void
  
  // Replay
  isReplaying: boolean
  startReplay: () => void
  stopReplay: () => void
}

export const useAntonStore = create<AntonStore>((set, get) => ({
  // Initial state
  query: '',
  drugId: 'rituximab',
  
  aiThinking: {
    stage: 'understanding',
    parsedIntent: { drug: '', action: '', entities: [] },
    messages: [],
  },
  
  isProcessing: false,
  processingSteps: initialSteps.map(s => ({ ...s, status: 'pending' as const })),
  currentStepIndex: -1,
  startTime: 0,
  
  ghostState: {
    payers: false,
    cards: false,
    comparison: false,
    insights: false,
    summary: false,
  },
  
  result: null,
  isReplaying: false,
  
  // Actions
  setQuery: (query) => set({ query }),
  
  updateAIThinking: (stage) => {
    const { query } = get()
    const parsedIntent = parseQuery(query)
    
    const messages: string[] = []
    if (stage === 'understanding' || stage === 'identifying' || stage === 'detecting' || stage === 'complete') {
      messages.push('Analyzing your question...')
    }
    if (stage === 'identifying' || stage === 'detecting' || stage === 'complete') {
      messages.push(`Identified intent: ${parsedIntent.action}`)
    }
    if (stage === 'detecting' || stage === 'complete') {
      messages.push(`Detected entities: ${parsedIntent.entities.join(', ')}`)
    }
    
    set({
      aiThinking: {
        stage,
        parsedIntent,
        messages,
      },
    })
  },
  
  startProcessing: (query) => {
    const parsedIntent = parseQuery(query)
    
    // Determine drug ID from query
    let drugId = 'rituximab'
    const q = query.toLowerCase()
    if (q.includes('humira')) drugId = 'humira'
    if (q.includes('adalimumab')) drugId = 'adalimumab'
    if (q.includes('bevacizumab')) drugId = 'bevacizumab'
    if (q.includes('botulinum') || q.includes('botox')) drugId = 'botulinum'
    if (q.includes('denosumab') || q.includes('prolia') || q.includes('xgeva')) drugId = 'denosumab'
    if (q.includes('rituximab') || q.includes('rituxan')) drugId = 'rituximab'
    
    set({
      query,
      drugId,
      isProcessing: true,
      processingSteps: initialSteps.map(s => ({ ...s, status: 'pending' as const })),
      currentStepIndex: 0,
      startTime: Date.now(),
      ghostState: {
        payers: false,
        cards: false,
        comparison: false,
        insights: false,
        summary: false,
      },
      aiThinking: {
        stage: 'understanding',
        parsedIntent,
        messages: ['Analyzing your question...'],
      },
      result: null,
    })
  },
  
  advanceStep: () => {
    const { processingSteps, currentStepIndex } = get()
    
    if (currentStepIndex >= processingSteps.length - 1) {
      get().completeProcessing()
      return
    }
    
    const newSteps = [...processingSteps]
    
    // Mark current as complete
    if (currentStepIndex >= 0) {
      newSteps[currentStepIndex] = { ...newSteps[currentStepIndex], status: 'complete' }
      
      // Reveal ghost section if this step has one
      const completedStep = newSteps[currentStepIndex]
      if (completedStep.ghostSection) {
        get().revealGhostSection(completedStep.ghostSection)
      }
    }
    
    // Mark next as active
    const nextIndex = currentStepIndex + 1
    if (nextIndex < newSteps.length) {
      newSteps[nextIndex] = { ...newSteps[nextIndex], status: 'active' }
    }
    
    set({
      processingSteps: newSteps,
      currentStepIndex: nextIndex,
    })
  },
  
  revealGhostSection: (section) => {
    set((state) => ({
      ghostState: {
        ...state.ghostState,
        [section]: true,
      },
    }))
  },
  
  completeProcessing: async () => {
    const { drugId, startTime, processingSteps } = get()
    
    // Mark all steps as complete
    const completedSteps = processingSteps.map(s => ({ ...s, status: 'complete' as const }))
    
    // Try API first, fall back to mock data
    let result: ComparisonResult
    try {
      result = await fetchComparison(drugId, startTime)
    } catch {
      result = generateComparisonResult(drugId, startTime)
    }
    
    set({
      isProcessing: false,
      processingSteps: completedSteps,
      ghostState: {
        payers: true,
        cards: true,
        comparison: true,
        insights: true,
        summary: true,
      },
      result,
    })
  },
  
  resetProcessing: () => {
    set({
      query: '',
      isProcessing: false,
      processingSteps: initialSteps.map(s => ({ ...s, status: 'pending' as const })),
      currentStepIndex: -1,
      startTime: 0,
      ghostState: {
        payers: false,
        cards: false,
        comparison: false,
        insights: false,
        summary: false,
      },
      aiThinking: {
        stage: 'understanding',
        parsedIntent: { drug: '', action: '', entities: [] },
        messages: [],
      },
      result: null,
    })
  },
  
  startReplay: () => set({ isReplaying: true }),
  stopReplay: () => set({ isReplaying: false }),
}))
