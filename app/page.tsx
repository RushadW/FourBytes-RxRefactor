import { AnimatedBackground } from '@/components/anton/animated-background'
import { SearchHero } from '@/components/anton/search-hero'

export default function HomePage() {
  return (
    <AnimatedBackground>
      <main className="min-h-screen flex flex-col items-center justify-start px-6 pt-16 pb-8">
        <SearchHero />
        
        {/* Subtle footer hint */}
        <div className="mt-14 text-center max-w-md mx-auto">
          <p className="text-[11px] text-muted-foreground/55 tracking-wide">
            Evidence-grounded answers · Document-linked sources · Same secure API
          </p>
        </div>
      </main>
    </AnimatedBackground>
  )
}
