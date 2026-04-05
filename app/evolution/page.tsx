import { AnimatedBackground } from '@/components/anton/animated-background'
import { PolicyEvolution } from '@/components/anton/policy-evolution'

export default function EvolutionPage() {
  return (
    <AnimatedBackground>
      <main className="min-h-screen py-8 px-6">
        <div className="max-w-4xl mx-auto">
          <PolicyEvolution />
        </div>
      </main>
    </AnimatedBackground>
  )
}
