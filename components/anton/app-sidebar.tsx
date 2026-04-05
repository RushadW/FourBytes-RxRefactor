'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  MessageSquare,
  Upload, Cpu,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navSections = [
  {
    label: 'ANALYST',
    items: [
      { href: '/', label: 'Ask AI', icon: MessageSquare, matchPaths: ['/', '/results', '/processing'] },
    ],
  },
  {
    label: 'DOCUMENTS',
    items: [
      { href: '#upload', label: 'Upload', icon: Upload },
    ],
  },
  {
    label: 'ML ENGINEER',
    items: [
      { href: '#mlops', label: 'MLOps', icon: Cpu },
    ],
  },
]

function AntonLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Rounded square background */}
      <rect width="32" height="32" rx="8" fill="url(#logo-grad)" />
      {/* Abstract "A" mark — two converging lines with dot */}
      <path d="M10 23L16 9L22 23" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="12.5" y1="18" x2="19.5" y2="18" stroke="white" strokeWidth="2" strokeLinecap="round" />
      {/* Accent dot — represents data/intelligence */}
      <circle cx="16" cy="9" r="1.5" fill="#FCD34D" />
      <defs>
        <linearGradient id="logo-grad" x1="0" y1="0" x2="32" y2="32">
          <stop stopColor="#6366F1" />
          <stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export function AppSidebar() {
  const pathname = usePathname()
  const [apiConnected, setApiConnected] = useState(false)
  const [planCount, setPlanCount] = useState(0)

  useEffect(() => {
    fetch('http://localhost:8080/api/matrix')
      .then(r => r.json())
      .then(data => {
        setApiConnected(true)
        setPlanCount(data.payers?.length || 0)
      })
      .catch(() => {})
  }, [])

  const isActive = (item: (typeof navSections)[0]['items'][0]) => {
    if ('matchPaths' in item && item.matchPaths) {
      return (item.matchPaths as string[]).some(
        (p: string) => pathname === p || (p !== '/' && pathname.startsWith(p))
      )
    }
    return pathname === item.href
  }

  return (
    <aside className="w-[200px] bg-[#1a1f37] flex flex-col h-screen sticky top-0 shrink-0 z-20">
      {/* Brand */}
      <div className="px-4 pt-5 pb-4">
        <Link href="/" className="flex items-center gap-2.5 group">
          <AntonLogo className="w-8 h-8 flex-shrink-0" />
          <div>
            <h1 className="text-[13px] font-bold text-white leading-none">AntonRx</h1>
            <p className="text-[10px] text-slate-400 mt-0.5">Drug Policy Tracker v2</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-5 mt-1 overflow-y-auto">
        {navSections.map(section => (
          <div key={section.label}>
            <p className="px-2 mb-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map(item => {
                const Icon = item.icon
                const active = isActive(item)
                const disabled = item.href.startsWith('#')
                return (
                  <Link
                    key={item.label}
                    href={disabled ? '/' : item.href}
                    className={cn(
                      'flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-all duration-150',
                      active
                        ? 'bg-indigo-600/90 text-white font-medium shadow-sm shadow-indigo-900/30'
                        : disabled
                          ? 'text-slate-500 cursor-default'
                          : 'text-slate-400 hover:text-white hover:bg-white/[0.07]'
                    )}
                    onClick={disabled ? (e: React.MouseEvent) => e.preventDefault() : undefined}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Status */}
      <div className="px-4 py-3.5 border-t border-white/[0.08]">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className={cn(
            'w-1.5 h-1.5 rounded-full',
            apiConnected ? 'bg-emerald-400' : 'bg-slate-500'
          )} />
          <span className={cn(
            'text-[11px]',
            apiConnected ? 'text-emerald-400' : 'text-slate-500'
          )}>
            {apiConnected ? 'API connected' : 'API offline'}
          </span>
        </div>
        <p className="text-[10px] text-slate-500">Q2 2026 · {planCount} plans loaded</p>
      </div>
    </aside>
  )
}
