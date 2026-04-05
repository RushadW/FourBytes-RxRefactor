'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AIDashboard } from '@/components/anton/ai-dashboard'

function ResultsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const query = searchParams.get('q') || ''
  const [planCount, setPlanCount] = useState(0)

  useEffect(() => {
    fetch('http://localhost:8080/api/matrix')
      .then(r => r.json())
      .then(data => setPlanCount(data.payers?.length || 0))
      .catch(() => {})
  }, [])

  if (!query) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 mb-4">No results available</p>
          <Button onClick={() => router.push('/')}>Go back to search</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Page Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-slate-200 bg-white shrink-0">
        <h1 className="text-base font-bold text-slate-800">Ask AI</h1>
        <div className="flex items-center gap-2.5">
          {planCount > 0 && (
            <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
              {planCount} Plans
            </span>
          )}
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </span>
          <button className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 hover:bg-slate-200 transition-colors">
            <Settings className="w-3 h-3" />
            Settings
          </button>
        </div>
      </header>

      {/* Dashboard */}
      <div className="flex-1 overflow-y-auto">
        <AIDashboard query={query} />
      </div>
    </div>
  )
}

export default function ResultsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500">Loading results...</p>
        </div>
      </div>
    }>
      <ResultsContent />
    </Suspense>
  )
}
