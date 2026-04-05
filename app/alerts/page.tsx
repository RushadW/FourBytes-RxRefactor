import { AnimatedBackground } from '@/components/anton/animated-background'
import { SmartAlerts } from '@/components/anton/smart-alerts'

export default function AlertsPage() {
  return (
    <AnimatedBackground>
      <main className="min-h-screen py-8 px-6">
        <div className="max-w-4xl mx-auto">
          <SmartAlerts />
        </div>
      </main>
    </AnimatedBackground>
  )
}
