import { useAuth } from '../lib/auth'

export function NotAuthorised() {
  const { session, signOut } = useAuth()
  return (
    <div className="min-h-screen grid place-items-center bg-surface px-6">
      <div className="max-w-md w-full text-center bg-white border border-line rounded-2xl p-8">
        <h1 className="font-head text-xl font-bold text-navy">No Studio access</h1>
        <p className="mt-3 text-sm text-ink-soft">
          You're signed in as <strong>{session?.user.email}</strong>, but this account isn't on the
          Studio author list. Ask a super or senior user to grant access.
        </p>
        <button
          onClick={signOut}
          className="mt-6 px-4 py-2 rounded-lg border border-line text-sm font-semibold text-navy hover:bg-surface"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
