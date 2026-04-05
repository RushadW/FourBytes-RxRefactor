import { AnimatedBackground } from '@/components/anton/animated-background'
import { CoverageCalculator } from '@/components/anton/coverage-calculator'

export default function CalculatorPage() {
  return (
    <AnimatedBackground>
      <main className="min-h-screen py-8 px-6">
        <div className="max-w-3xl mx-auto">
          <CoverageCalculator />
        </div>
      </main>
    </AnimatedBackground>
  )
}
