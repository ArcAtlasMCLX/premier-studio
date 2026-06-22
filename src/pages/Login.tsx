import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setBusy(false)
  }

  const input =
    'w-full px-3 py-2 rounded-lg border border-line focus:outline-none focus:ring-2 focus:ring-teal/40'

  return (
    <div className="min-h-screen grid place-items-center bg-navy px-6">
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-2xl p-8 shadow-2xl">
        <img src="/studio-mark.svg" alt="" width="48" height="48" className="mb-4" />
        <div className="font-head font-bold text-lg text-navy">
          Premier <span className="text-teal-ink">Studio</span>
        </div>
        <p className="text-ink-soft text-sm mt-1 mb-6">Sign in with your CindersX account.</p>

        <label className="block text-xs font-semibold text-navy mb-1">Email</label>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={`${input} mb-4`} />

        <label className="block text-xs font-semibold text-navy mb-1">Password</label>
        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className={`${input} mb-5`} />

        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full py-2.5 rounded-lg bg-teal text-navy font-head font-semibold disabled:opacity-60"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
