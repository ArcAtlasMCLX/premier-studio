import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isConfigured = Boolean(url && anon)

if (!isConfigured) {
  // Don't hard-crash to a blank screen — warn and use harmless placeholders so the
  // UI still renders. Auth/data calls will fail until real env vars are set.
  console.warn('[studio] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — copy .env.example to .env')
}

// Default to the `studio` schema so .from()/.rpc() target our content tables.
// Auth (GoTrue) is schema-independent and still uses the shared CindersX identity.
export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anon || 'placeholder-anon-key',
  {
    db: { schema: 'studio' },
    auth: { persistSession: true, autoRefreshToken: true },
  },
)
