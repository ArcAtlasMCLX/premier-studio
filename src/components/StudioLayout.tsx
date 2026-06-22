import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export function StudioLayout({ children }: { children: ReactNode }) {
  const { session, signOut } = useAuth()
  const { pathname } = useLocation()
  const onInsights = pathname === '/' || pathname.startsWith('/insights')
  const onEngine = pathname.startsWith('/engine')
  const onSignal = pathname.startsWith('/signal')
  const onImages = pathname.startsWith('/images')

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 shrink-0 bg-navy text-white flex flex-col sticky top-0 h-screen">
        <div className="h-16 px-5 flex items-center gap-2.5 border-b border-white/10">
          <img src="/studio-mark.svg" alt="" width="28" height="28" className="rounded-md" />
          <span className="font-head font-bold tracking-tight">
            Premier <span className="text-teal">Studio</span>
          </span>
        </div>
        <nav className="flex-1 p-3 space-y-1 text-sm">
          <Link
            to="/"
            className={`block px-3 py-2 rounded-lg font-medium ${
              onInsights ? 'bg-white/10 text-white' : 'text-white/75 hover:text-white hover:bg-white/5'
            }`}
          >
            Insights
          </Link>
          <Link
            to="/engine"
            className={`block px-3 py-2 rounded-lg font-medium ${
              onEngine ? 'bg-white/10 text-white' : 'text-white/75 hover:text-white hover:bg-white/5'
            }`}
          >
            Content Engine
          </Link>
          <Link
            to="/signal"
            className={`block px-3 py-2 rounded-lg font-medium ${
              onSignal ? 'bg-white/10 text-white' : 'text-white/75 hover:text-white hover:bg-white/5'
            }`}
          >
            Signal
          </Link>
          <Link
            to="/images"
            className={`block px-3 py-2 rounded-lg font-medium ${
              onImages ? 'bg-white/10 text-white' : 'text-white/75 hover:text-white hover:bg-white/5'
            }`}
          >
            Image Bank
          </Link>
          <span className="flex items-center justify-between px-3 py-2 rounded-lg text-white/40 cursor-default">
            Settings <em className="text-[10px] not-italic uppercase tracking-wide">soon</em>
          </span>
        </nav>
        <div className="p-3 border-t border-white/10">
          <div className="text-xs text-white/60 truncate">{session?.user.email}</div>
          <button
            onClick={signOut}
            className="mt-2 w-full text-left text-xs font-semibold text-white/80 hover:text-teal"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 bg-surface min-h-screen">{children}</main>
    </div>
  )
}
