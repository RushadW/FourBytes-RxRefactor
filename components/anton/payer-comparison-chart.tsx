'use client'

import { motion } from 'framer-motion'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  ResponsiveContainer,
  Cell,
  Tooltip
} from 'recharts'
import { CheckCircle2, XCircle, Clock, MapPin } from 'lucide-react'
import type { PayerPolicy } from '@/lib/types'

interface PayerComparisonChartProps {
  policies: PayerPolicy[]
}

export function PayerComparisonChart({ policies }: PayerComparisonChartProps) {
  // Calculate scores for each payer (higher = easier to get approved)
  const chartData = policies.map(policy => {
    let score = 100
    if (policy.priorAuth) score -= 20
    if (policy.stepTherapy) score -= 30
    if (!policy.siteOfCare.includes('Home Infusion')) score -= 10
    
    return {
      name: policy.payerName.split(' ')[0], // Shorten name
      fullName: policy.payerName,
      score,
      priorAuth: policy.priorAuth,
      stepTherapy: policy.stepTherapy,
      homeInfusion: policy.siteOfCare.includes('Home Infusion'),
      sitesCount: policy.siteOfCare.length,
      color: score >= 70 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444'
    }
  })

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="custom-tooltip">
          <p className="font-medium text-foreground mb-2">{data.fullName}</p>
          <p className="text-sm text-muted-foreground">
            Ease of Access Score: <span className="text-foreground font-medium">{data.score}%</span>
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <motion.div
      className="glass-card rounded-2xl p-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-foreground">Access Comparison</h3>
          <p className="text-xs text-muted-foreground mt-1">Higher score = easier approval path</p>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="h-48 mb-6">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" barSize={24}>
            <XAxis 
              type="number" 
              domain={[0, 100]}
              tick={{ fill: '#a1a1aa', fontSize: 11 }}
              axisLine={{ stroke: '#27272a' }}
              tickLine={false}
            />
            <YAxis 
              type="category" 
              dataKey="name" 
              tick={{ fill: '#fafafa', fontSize: 12, fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
              width={60}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
            <Bar dataKey="score" radius={[0, 6, 6, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Quick comparison grid */}
      <div className="grid grid-cols-3 gap-3">
        {policies.map((policy, index) => (
          <motion.div
            key={policy.payerId}
            className="p-3 rounded-xl bg-secondary/50"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 + index * 0.1 }}
          >
            <p className="text-xs font-medium text-foreground mb-2 truncate">{policy.payerName}</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                {policy.stepTherapy ? (
                  <XCircle className="w-3.5 h-3.5 text-destructive" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                )}
                <span className="text-[10px] text-muted-foreground">Step therapy</span>
              </div>
              <div className="flex items-center gap-2">
                {policy.siteOfCare.includes('Home Infusion') ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-destructive" />
                )}
                <span className="text-[10px] text-muted-foreground">Home infusion</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-primary" />
                <span className="text-[10px] text-muted-foreground">{policy.siteOfCare.length} sites</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}
