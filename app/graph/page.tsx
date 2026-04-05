'use client'

import { AnimatedBackground } from '@/components/anton/animated-background'
import { KnowledgeGraph } from '@/components/anton/knowledge-graph'

export default function GraphPage() {
  return (
    <AnimatedBackground>
      <main className="min-h-screen py-8 px-6">
        <div className="max-w-5xl mx-auto">
          <KnowledgeGraph />
        </div>
      </main>
    </AnimatedBackground>
  )
}
