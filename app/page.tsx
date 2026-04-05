import { AnimatedBackground } from '@/components/anton/animated-background'
import { SearchHero } from '@/components/anton/search-hero'

export default function HomePage() {
  return (
    <AnimatedBackground>
      <main className="min-h-screen flex flex-col items-center justify-center px-6 py-8">
        <SearchHero />
        
        {/* Subtle footer hint */}
        <div className="mt-auto pt-8 text-center">
          <p className="text-xs text-muted-foreground/60">
            Powered by AI · Just ask a question and we handle the rest
          </p>
        </div>
      </main>
    </AnimatedBackground>
  )
}
