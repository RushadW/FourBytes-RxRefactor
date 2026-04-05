import { AnimatedBackground } from '@/components/anton/animated-background'
import { PolicyCompare } from '@/components/anton/policy-compare'

export default function LibraryPage() {
  return (
    <AnimatedBackground>
      <main className="min-h-screen py-8 px-6">
        <div className="max-w-5xl mx-auto">
          <PolicyCompare />
        </div>
      </main>
    </AnimatedBackground>
  )
}
