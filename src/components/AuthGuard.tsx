import type { ReactNode } from 'react'
import { useAuth } from '../lib/auth'
import { Login } from '../pages/Login'
import { NotAuthorised } from '../pages/NotAuthorised'

export function AuthGuard({ children }: { children: ReactNode }) {
  const { session, isAuthor, loading } = useAuth()

  if (loading) {
    return <div className="min-h-screen grid place-items-center bg-surface text-ink-soft">Loading…</div>
  }
  if (!session) return <Login />
  if (!isAuthor) return <NotAuthorised />
  return <>{children}</>
}
