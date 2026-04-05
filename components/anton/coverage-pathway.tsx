'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  FileText, 
  Clock, 
  CheckCircle2, 
  ArrowRight, 
  AlertTriangle,
  Building2,
  Pill,
  ChevronDown
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { PayerPolicy } from '@/lib/types'

interface CoveragePathwayProps {
  policies: PayerPolicy[]
  drugName: string
}

interface PathwayStep {
  id: string
  label: string
  icon: typeof FileText
  duration?: string
  required: boolean
  description: string
}

export function CoveragePathway({ policies, drugName }: CoveragePathwayProps) {
  const [selectedPayer, setSelectedPayer] = useState(policies[0]?.payerId)
  const policy = policies.find(p => p.payerId === selectedPayer) || policies[0]
  
  if (!policy) return null

  // Build pathway based on policy requirements
  const pathwaySteps: PathwayStep[] = [
    {
      id: 'diagnosis',
      label: 'Diagnosis',
      icon: Pill,
      required: true,
      description: 'Confirmed diagnosis documentation'
    },
    ...(policy.stepTherapy ? [{
      id: 'step-therapy',
      label: 'Step Therapy',
      icon: Clock,
      duration: '4-12 weeks',
      required: true,
      description: policy.stepTherapyDetails || 'Prior medication trial required'
    }] : []),
    {
      id: 'prior-auth',
      label: 'Prior Authorization',
      icon: FileText,
      duration: '3-5 days',
      required: policy.priorAuth,
      description: policy.priorAuthDetails || 'Submit PA request'
    },
    {
      id: 'approval',
      label: 'Approval',
      icon: CheckCircle2,
      required: true,
      description: 'Coverage determination'
    },
    {
      id: 'site-of-care',
      label: 'Treatment',
      icon: Building2,
      required: true,
      description: `At ${policy.siteOfCare.join(' or ')}`
    }
  ]

  // Calculate total estimated time
  const hasStepTherapy = policy.stepTherapy
  const estimatedWeeks = hasStepTherapy ? '6-14' : '1-2'

  return (
    <motion.div
      className="glass-card rounded-2xl p-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-foreground">Approval Pathway</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Estimated time: <span className="text-primary font-medium">{estimatedWeeks} weeks</span>
          </p>
        </div>
        
        {/* Payer selector */}
        <div className="flex gap-2">
          {policies.map(p => (
            <button
              key={p.payerId}
              onClick={() => setSelectedPayer(p.payerId)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedPayer === p.payerId 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              {p.payerName.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Pathway visualization */}
      <div className="relative">
        {/* Connecting line */}
        <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-gradient-to-b from-primary via-primary/50 to-success" />
        
        <div className="space-y-4">
          {pathwaySteps.map((step, index) => (
            <motion.div
              key={step.id}
              className="relative flex items-start gap-4"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 * index }}
            >
              {/* Icon */}
              <div className={`
                relative z-10 w-12 h-12 rounded-xl flex items-center justify-center
                ${index === pathwaySteps.length - 1 
                  ? 'bg-success/20 text-success' 
                  : step.id === 'step-therapy'
                    ? 'bg-warning/20 text-warning'
                    : 'bg-primary/20 text-primary'
                }
              `}>
                <step.icon className="w-5 h-5" />
              </div>
              
              {/* Content */}
              <div className="flex-1 pb-4">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-foreground text-sm">{step.label}</h4>
                  {step.duration && (
                    <span className="px-2 py-0.5 rounded-full bg-secondary text-[10px] text-muted-foreground">
                      {step.duration}
                    </span>
                  )}
                  {step.id === 'step-therapy' && (
                    <span className="px-2 py-0.5 rounded-full bg-warning/20 text-warning text-[10px] font-medium">
                      Required
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{step.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Summary */}
      <motion.div
        className="mt-4 pt-4 border-t border-border/50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        {policy.stepTherapy ? (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-warning/10 border border-warning/20">
            <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-warning">Step therapy required</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {policy.stepTherapyDetails}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-success/10 border border-success/20">
            <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-success">Direct path available</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                No step therapy required - proceed directly to prior authorization
              </p>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
