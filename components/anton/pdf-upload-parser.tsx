'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload, FileText, Sparkles, CheckCircle2, Pill,
  Building2, Shield, Clock, FileSearch, Zap, AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ExtractedEntity {
  type: 'drug' | 'payer' | 'criteria' | 'date' | 'code'
  value: string
  confidence: number
}

interface ParseStage {
  label: string
  icon: React.ReactNode
  status: 'pending' | 'active' | 'complete'
  entities: ExtractedEntity[]
}

const mockEntities: ExtractedEntity[][] = [
  [
    { type: 'drug', value: 'Adalimumab (Humira)', confidence: 0.98 },
    { type: 'drug', value: 'Infliximab (Remicade)', confidence: 0.95 },
    { type: 'payer', value: 'Aetna', confidence: 0.99 },
  ],
  [
    { type: 'criteria', value: 'Prior Authorization Required', confidence: 0.97 },
    { type: 'criteria', value: 'Step Therapy: 2 conventional DMARDs', confidence: 0.92 },
    { type: 'criteria', value: 'Specialist documentation required', confidence: 0.89 },
  ],
  [
    { type: 'code', value: 'J0135 - Adalimumab injection', confidence: 0.99 },
    { type: 'code', value: 'J1745 - Infliximab injection', confidence: 0.98 },
    { type: 'date', value: 'Effective: January 1, 2026', confidence: 0.96 },
    { type: 'date', value: 'Last Updated: March 15, 2026', confidence: 0.95 },
  ],
]

export function PDFUploadParser() {
  const [isDragging, setIsDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [stages, setStages] = useState<ParseStage[]>([
    { label: 'Document Recognition', icon: <FileSearch className="w-4 h-4" />, status: 'pending', entities: [] },
    { label: 'Entity Extraction', icon: <Pill className="w-4 h-4" />, status: 'pending', entities: [] },
    { label: 'Criteria Mapping', icon: <Shield className="w-4 h-4" />, status: 'pending', entities: [] },
    { label: 'Code Detection', icon: <Zap className="w-4 h-4" />, status: 'pending', entities: [] },
  ])
  const [particles, setParticles] = useState<{ id: number; x: number; y: number }[]>([])

  const simulateParsing = useCallback(() => {
    setIsParsing(true)

    // Stage 1
    setTimeout(() => {
      setStages(prev => prev.map((s, i) => i === 0 ? { ...s, status: 'active' } : s))
    }, 300)

    setTimeout(() => {
      setStages(prev => prev.map((s, i) => 
        i === 0 ? { ...s, status: 'complete', entities: mockEntities[0] } 
        : i === 1 ? { ...s, status: 'active' }
        : s
      ))
    }, 1800)

    // Stage 2
    setTimeout(() => {
      setStages(prev => prev.map((s, i) =>
        i === 1 ? { ...s, status: 'complete', entities: mockEntities[1] }
        : i === 2 ? { ...s, status: 'active' }
        : s
      ))
    }, 3500)

    // Stage 3
    setTimeout(() => {
      setStages(prev => prev.map((s, i) =>
        i === 2 ? { ...s, status: 'complete', entities: mockEntities[2]?.slice(0, 2) || [] }
        : i === 3 ? { ...s, status: 'active' }
        : s
      ))
    }, 5000)

    // Stage 4
    setTimeout(() => {
      setStages(prev => prev.map(s => ({ ...s, status: 'complete' as const })))
      setStages(prev => {
        const updated = [...prev]
        updated[3] = { ...updated[3], entities: mockEntities[2] || [] }
        return updated
      })
      setIsParsing(false)
    }, 6500)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      setFile(droppedFile)
      setStages(prev => prev.map(s => ({ ...s, status: 'pending' as const, entities: [] })))
      simulateParsing()
    }
  }, [simulateParsing])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setStages(prev => prev.map(s => ({ ...s, status: 'pending' as const, entities: [] })))
      simulateParsing()
    }
  }, [simulateParsing])

  const entityIcon = (type: ExtractedEntity['type']) => {
    switch (type) {
      case 'drug': return <Pill className="w-3 h-3 text-blue-400" />
      case 'payer': return <Building2 className="w-3 h-3 text-green-400" />
      case 'criteria': return <Shield className="w-3 h-3 text-yellow-400" />
      case 'date': return <Clock className="w-3 h-3 text-purple-400" />
      case 'code': return <Zap className="w-3 h-3 text-orange-400" />
    }
  }

  const entityColor = (type: ExtractedEntity['type']) => {
    switch (type) {
      case 'drug': return 'border-blue-500/30 bg-blue-500/10'
      case 'payer': return 'border-green-500/30 bg-green-500/10'
      case 'criteria': return 'border-yellow-500/30 bg-yellow-500/10'
      case 'date': return 'border-purple-500/30 bg-purple-500/10'
      case 'code': return 'border-orange-500/30 bg-orange-500/10'
    }
  }

  const allEntities = stages.flatMap(s => s.entities)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/12 to-teal-500/10 ring-1 ring-border flex items-center justify-center">
          <Upload className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Policy Document Ingestion</h2>
          <p className="text-sm text-muted-foreground">Drop a PDF to see live AI parsing</p>
        </div>
      </div>

      {/* Drop zone */}
      <motion.div
        className={cn(
          'relative rounded-2xl border-2 border-dashed transition-all overflow-hidden cursor-pointer',
          isDragging
            ? 'border-primary bg-primary/5'
            : file
            ? 'border-green-500/30 bg-green-500/5'
            : 'border-border/50 hover:border-primary/30 hover:bg-primary/5'
        )}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById('pdf-input')?.click()}
        animate={isDragging ? { scale: 1.02 } : { scale: 1 }}
      >
        <input
          id="pdf-input"
          type="file"
          accept=".pdf,.doc,.docx,.html"
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center py-12 px-6">
          <motion.div
            className={cn(
              'w-16 h-16 rounded-2xl flex items-center justify-center mb-4',
              file ? 'bg-green-500/20' : 'bg-primary/10'
            )}
            animate={isDragging ? { y: [0, -8, 0] } : {}}
            transition={{ duration: 0.5, repeat: isDragging ? Infinity : 0 }}
          >
            {file ? (
              <FileText className="w-8 h-8 text-green-400" />
            ) : (
              <Upload className="w-8 h-8 text-primary" />
            )}
          </motion.div>

          {file ? (
            <div className="text-center">
              <p className="font-medium text-foreground">{file.name}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {(file.size / 1024).toFixed(1)} KB — {isParsing ? 'Parsing...' : 'Parsing complete'}
              </p>
            </div>
          ) : (
            <div className="text-center">
              <p className="font-medium text-foreground">Drop a policy document here</p>
              <p className="text-sm text-muted-foreground mt-1">PDF, DOCX, or HTML — up to 50MB</p>
            </div>
          )}

          {/* Animated particles flowing into the parser */}
          <AnimatePresence>
            {isParsing && (
              <>
                {[...Array(8)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-2 h-2 rounded-full bg-primary"
                    initial={{
                      x: (Math.random() - 0.5) * 300,
                      y: -20,
                      opacity: 0,
                    }}
                    animate={{
                      x: 0,
                      y: 60,
                      opacity: [0, 1, 0],
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      delay: i * 0.3,
                      ease: 'easeInOut',
                    }}
                  />
                ))}
              </>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Parsing pipeline */}
      {file && (
        <div className="space-y-3">
          {stages.map((stage, i) => (
            <motion.div
              key={stage.label}
              className={cn(
                'glass-card rounded-xl overflow-hidden transition-all',
                stage.status === 'active' && 'ring-1 ring-primary/50 step-active-glow',
              )}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <div className="flex items-center gap-3 p-4">
                <div className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center',
                  stage.status === 'complete' ? 'bg-green-500/20' :
                  stage.status === 'active' ? 'bg-primary/20' :
                  'bg-secondary'
                )}>
                  {stage.status === 'complete' ? (
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                  ) : stage.status === 'active' ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                      <Sparkles className="w-4 h-4 text-primary" />
                    </motion.div>
                  ) : (
                    <span className="text-muted-foreground">{stage.icon}</span>
                  )}
                </div>
                <div className="flex-1">
                  <p className={cn(
                    'text-sm font-medium',
                    stage.status === 'complete' ? 'text-green-400' :
                    stage.status === 'active' ? 'text-primary' :
                    'text-muted-foreground'
                  )}>
                    {stage.label}
                  </p>
                  {stage.status === 'active' && (
                    <motion.div
                      className="h-1 bg-primary/30 rounded-full mt-2 overflow-hidden"
                    >
                      <motion.div
                        className="h-full bg-primary rounded-full"
                        initial={{ width: '0%' }}
                        animate={{ width: '100%' }}
                        transition={{ duration: 1.5, ease: 'easeInOut' }}
                      />
                    </motion.div>
                  )}
                </div>
                {stage.status === 'complete' && (
                  <span className="text-xs text-muted-foreground">
                    {stage.entities.length} found
                  </span>
                )}
              </div>

              {/* Extracted entities */}
              <AnimatePresence>
                {stage.entities.length > 0 && (
                  <motion.div
                    className="px-4 pb-4"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="flex flex-wrap gap-2">
                      {stage.entities.map((entity, j) => (
                        <motion.div
                          key={`${entity.value}-${j}`}
                          className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs',
                            entityColor(entity.type)
                          )}
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ delay: j * 0.15, type: 'spring' }}
                        >
                          {entityIcon(entity.type)}
                          <span>{entity.value}</span>
                          <span className="text-[10px] text-muted-foreground/60 ml-1">
                            {(entity.confidence * 100).toFixed(0)}%
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}

      {/* Result summary */}
      <AnimatePresence>
        {!isParsing && allEntities.length > 0 && (
          <motion.div
            className="glass-card rounded-xl p-5"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
              <h3 className="font-semibold">Extraction Complete</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { type: 'drug' as const, label: 'Drugs', color: 'text-blue-400' },
                { type: 'payer' as const, label: 'Payers', color: 'text-green-400' },
                { type: 'criteria' as const, label: 'Criteria', color: 'text-yellow-400' },
                { type: 'code' as const, label: 'HCPCS', color: 'text-orange-400' },
                { type: 'date' as const, label: 'Dates', color: 'text-purple-400' },
              ].map((t) => (
                <div key={t.type} className="text-center p-3 rounded-lg bg-secondary/50">
                  <div className={cn('text-xl font-bold', t.color)}>
                    {allEntities.filter(e => e.type === t.type).length}
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase">{t.label}</div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
