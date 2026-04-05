'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AIDashboard } from '@/components/anton/ai-dashboard'

function ResultsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const query = searchParams.get('q') || ''

  if (!query) {
    return (
      <div className="min-h-[calc(100vh-0px)] flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/15 to-teal-500/10 flex items-center justify-center mx-auto mb-5 ring-1 ring-border">
            <Sparkles className="w-7 h-7 text-primary" />
          </div>
          <p className="text-muted-foreground mb-6 text-sm leading-relaxed">
            Start from Ask AI with a drug or payer question to see analysis, sources, and comparisons.
          </p>
          <Button asChild className="rounded-xl shadow-sm">
            <Link href="/">Back to search</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-20 shrink-0 border-b border-border/80 bg-card/80 backdrop-blur-xl supports-[backdrop-filter]:bg-card/65">
        <div className="flex items-center gap-3 px-4 sm:px-6 py-3.5 max-w-[1920px] mx-auto w-full">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-xl text-muted-foreground hover:text-foreground -ml-1 gap-1.5"
            onClick={() => router.push('/')}
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Home</span>
          </Button>
          <div className="h-4 w-px bg-border hidden sm:block" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
              Ask AI
            </p>
            <h1 className="text-sm sm:text-base font-semibold text-foreground truncate leading-tight mt-0.5">
              {query}
            </h1>
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 flex flex-col bg-gradient-to-b from-transparent to-muted/25">
        <AIDashboard query={query} />
      </div>
    </div>
  )
}

export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center px-6">
          <div className="text-center">
            <div className="relative w-12 h-12 mx-auto mb-4">
              <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
              <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
            <p className="text-sm text-muted-foreground">Loading results…</p>
          </div>
        </div>
      }
    >
      <ResultsContent />
    </Suspense>
  )
}
