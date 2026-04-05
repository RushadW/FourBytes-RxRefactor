import { AnimatedBackground } from '@/components/anton/animated-background'
import { PolicyDiffView } from '@/components/anton/policy-diff-view'

export default function DiffPage() {
  return (
    <AnimatedBackground>
      <main className="min-h-screen py-8 px-6">
        <div className="max-w-4xl mx-auto">
          <PolicyDiffView />
        </div>
      </main>
    </AnimatedBackground>
  )
}
