'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  MessageSquare, Sparkles, FileText, Bell, X, Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type Notification,
} from '@/lib/api'

const navSections = [
  {
    label: 'ANALYST',
    items: [
      { href: '/', label: 'Ask AI', icon: MessageSquare, matchPaths: ['/', '/results', '/processing'] },
    ],
  },
  {
    label: 'DATA',
    items: [
      { href: '/policy-bank', label: 'Policy Bank', icon: FileText, matchPaths: ['/policy-bank'] },
    ],
  },
]

function AntonLogo({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center', className)}>
      <Sparkles className="w-[55%] h-[55%] text-white" />
    </div>
  )
}

export function AppSidebar() {
  const pathname = usePathname()
  const [apiConnected, setApiConnected] = useState(false)
  const [planCount, setPlanCount] = useState(0)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showNotifs, setShowNotifs] = useState(false)

  useEffect(() => {
    fetch('http://localhost:8080/api/matrix')
      .then(r => r.json())
      .then(data => {
        setApiConnected(true)
        setPlanCount(data.payers?.length || 0)
      })
      .catch(() => {})

    // Fetch notifications
    fetchNotifications()
      .then(setNotifications)
      .catch(() => {})
    // Poll every 60s
    const interval = setInterval(() => {
      fetchNotifications().then(setNotifications).catch(() => {})
    }, 60_000)
    return () => clearInterval(interval)
  }, [])

  const unreadCount = notifications.filter(n => !n.read).length

  async function handleMarkRead(id: string) {
    await markNotificationRead(id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  async function handleMarkAllRead() {
    await markAllNotificationsRead()
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

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

      {/* Notification bell */}
      <div className="px-3 py-2 relative">
        <button
          onClick={() => setShowNotifs(!showNotifs)}
          className="flex items-center gap-2.5 px-3 py-2 w-full rounded-lg text-[13px] text-slate-400 hover:text-white hover:bg-white/[0.07] transition-all duration-150"
        >
          <Bell className="w-4 h-4 flex-shrink-0" />
          Notifications
          {unreadCount > 0 && (
            <span className="ml-auto flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* Notification dropdown */}
        {showNotifs && (
          <div className="absolute left-full bottom-0 ml-2 w-80 max-h-96 bg-[#1e2345] border border-white/[0.1] rounded-xl shadow-2xl overflow-hidden z-50">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]">
              <span className="text-xs font-semibold text-white">Notifications</span>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setShowNotifs(false)}
                  className="p-0.5 rounded text-slate-500 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto max-h-[320px]">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-slate-500">
                  No notifications yet
                </div>
              ) : (
                notifications.slice(0, 20).map(n => (
                  <div
                    key={n.id}
                    className={cn(
                      'px-4 py-3 border-b border-white/[0.04] text-xs transition-colors',
                      n.read ? 'opacity-60' : 'bg-indigo-500/[0.05]'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className={cn('font-medium truncate', n.read ? 'text-slate-400' : 'text-white')}>
                          {n.title}
                        </p>
                        <p className="text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                        <p className="text-slate-600 mt-1 text-[10px]">
                          {n.created_at ? new Date(n.created_at).toLocaleString() : ''}
                        </p>
                      </div>
                      {!n.read && (
                        <button
                          onClick={() => handleMarkRead(n.id)}
                          className="p-1 rounded text-slate-500 hover:text-emerald-400 flex-shrink-0"
                          title="Mark as read"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

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
        <p className="text-[10px] text-slate-500">{`Q${Math.ceil((new Date().getMonth() + 1) / 3)} ${new Date().getFullYear()}`} · {planCount} plans loaded</p>
      </div>
    </aside>
  )
}
