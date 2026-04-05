'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  MessageSquare, Sparkles, FileText,
  BookOpen, Network, Radio,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SMART_ALERTS_FEED_COUNT } from '@/components/anton/smart-alerts'

const ALERTS_PAGE_SEEN_SESSION_KEY = 'antonrx-alerts-page-seen'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api'

const navSections = [
  {
    label: 'Workspace',
    items: [
      { href: '/', label: 'Ask AI', icon: MessageSquare, matchPaths: ['/', '/results', '/processing'] },
      { href: '/policy-bank', label: 'Policy Bank', icon: FileText, matchPaths: ['/policy-bank'] },
      { href: '/library', label: 'Compare', icon: BookOpen, matchPaths: ['/library'] },
      { href: '/graph', label: 'Graph', icon: Network, matchPaths: ['/graph'] },
      { href: '/alerts', label: 'Alerts', icon: Radio, matchPaths: ['/alerts'] },
    ],
  },
]

function AntonLogo({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-xl bg-gradient-to-br from-indigo-500 via-violet-600 to-teal-600 shadow-lg shadow-indigo-950/40 flex items-center justify-center ring-1 ring-white/20',
        className
      )}
    >
      <Sparkles className="w-[55%] h-[55%] text-white drop-shadow-sm" />
    </div>
  )
}

export function AppSidebar() {
  const pathname = usePathname()
  const [apiConnected, setApiConnected] = useState(false)
  const [planCount, setPlanCount] = useState(0)
  /** `null` until we read sessionStorage (avoids hydration flash). */
  const [alertsPageSeenThisSession, setAlertsPageSeenThisSession] = useState<boolean | null>(null)

  useEffect(() => {
    fetch(`${API_BASE}/matrix`)
      .then(r => r.json())
      .then(data => {
        setApiConnected(true)
        setPlanCount(data.payers?.length || 0)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    setAlertsPageSeenThisSession(sessionStorage.getItem(ALERTS_PAGE_SEEN_SESSION_KEY) === '1')
  }, [])

  useEffect(() => {
    if (pathname !== '/alerts' || typeof window === 'undefined') return
    sessionStorage.setItem(ALERTS_PAGE_SEEN_SESSION_KEY, '1')
    setAlertsPageSeenThisSession(true)
  }, [pathname])

  const showAlertsNavBadge =
    alertsPageSeenThisSession === false && SMART_ALERTS_FEED_COUNT > 0

  const isActive = (item: (typeof navSections)[0]['items'][0]) => {
    if ('matchPaths' in item && item.matchPaths) {
      return (item.matchPaths as string[]).some(
        (p: string) => pathname === p || (p !== '/' && pathname.startsWith(p))
      )
    }
    return pathname === item.href
  }

  return (
    <aside className="w-[200px] bg-sidebar text-sidebar-foreground flex flex-col h-screen sticky top-0 shrink-0 z-30 border-r border-sidebar-border shadow-[4px_0_24px_rgba(0,0,0,0.12)]">
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-indigo-500/10 to-transparent pointer-events-none" />

      <div className="px-3 pt-5 pb-3 relative">
        <Link href="/" className="flex items-center gap-2.5 group min-w-0">
          <AntonLogo className="w-8 h-8 flex-shrink-0 transition-transform duration-200 group-hover:scale-[1.03]" />
          <div className="min-w-0">
            <h1 className="text-[13px] font-bold text-sidebar-foreground tracking-tight leading-none">
              AntonRx
            </h1>
            <p className="text-[10px] text-sidebar-foreground/45 mt-0.5 font-medium leading-tight">
              Drug policy intelligence
            </p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 px-2.5 space-y-4 mt-0.5 overflow-y-auto scrollbar-thin relative">
        {navSections.map(section => (
          <div key={section.label}>
            <p className="px-2.5 mb-1.5 text-[10px] font-semibold text-sidebar-foreground/35 uppercase tracking-wider">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map(item => {
                const Icon = item.icon
                const active = isActive(item)
                const disabled = item.href.startsWith('#')
                const isAlerts = item.href === '/alerts'

                return (
                  <Link
                    key={item.label}
                    href={disabled ? '/' : item.href}
                    className={cn(
                      'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] transition-all duration-200',
                      active
                        ? 'bg-sidebar-primary/15 text-sidebar-primary font-semibold shadow-sm shadow-black/10 ring-1 ring-sidebar-primary/25'
                        : disabled
                          ? 'text-sidebar-foreground/30 cursor-default'
                          : 'text-sidebar-foreground/65 hover:text-sidebar-foreground hover:bg-sidebar-accent'
                    )}
                    onClick={disabled ? (e: React.MouseEvent) => e.preventDefault() : undefined}
                  >
                    <Icon className={cn('w-4 h-4 shrink-0', active && 'text-sidebar-primary')} />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {isAlerts && showAlertsNavBadge && (
                      <span
                        className="shrink-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold leading-none text-white ring-2 ring-sidebar"
                        aria-label={`${SMART_ALERTS_FEED_COUNT} items on Alerts`}
                      >
                        {SMART_ALERTS_FEED_COUNT > 99 ? '99+' : SMART_ALERTS_FEED_COUNT}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-3 py-3.5 border-t border-sidebar-border mt-auto relative bg-black/15">
        <div className="flex items-center gap-2 mb-1">
          <span
            className={cn(
              'w-2 h-2 rounded-full ring-2 ring-black/20',
              apiConnected ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'bg-slate-500'
            )}
          />
          <span
            className={cn(
              'text-[12px] font-medium',
              apiConnected ? 'text-emerald-400/90' : 'text-slate-500'
            )}
          >
            {apiConnected ? 'API connected' : 'API offline'}
          </span>
        </div>
        <p className="text-[10px] text-sidebar-foreground/40 leading-relaxed">
          Q{Math.ceil((new Date().getMonth() + 1) / 3)} {new Date().getFullYear()}
          <span className="mx-1.5 text-sidebar-foreground/25">·</span>
          {planCount} plans in matrix
        </p>
      </div>
    </aside>
  )
}
