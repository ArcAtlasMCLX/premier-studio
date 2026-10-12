import { supabase } from './supabase'

export interface AutoInsightRun {
  id: string
  outcome: string
  insight_id: string | null
  source_url: string | null
  source_feed: string | null
  detail: string | null
  dry_run: boolean
  created_at: string
}

// The draft the edge function WOULD create (dry run) — not persisted.
export interface DryRunResult {
  dry_run: true
  outcome: string
  item?: { title: string; link: string; summary: string; feed: string }
  draft?: { title: string; slug: string; excerpt: string; content: string; tags: string[]; safe_summary: string }
  verify_flags?: string[]
  auto_publishable?: boolean
  detail?: string
  published_recent?: number
  scheduled?: number
  fetched?: number
}

export async function listAutoInsightRuns(limit = 50): Promise<AutoInsightRun[]> {
  const { data, error } = await supabase
    .from('autoinsight_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as AutoInsightRun[]
}

// Trigger a run now. dryRun returns the would-be draft WITHOUT writing, emailing or
// publishing anything; force bypasses the quiet-window gap check (for testing while the
// site is active). A real run (no dryRun) is queued in the background — poll the log.
export async function runAutoInsight(opts: { dryRun?: boolean; force?: boolean } = {}): Promise<DryRunResult | { ok: true; queued: true }> {
  const { data, error } = await supabase.functions.invoke('draft-autoinsight', {
    body: { dry_run: opts.dryRun ?? false, force: opts.force ?? false },
  })
  if (error) throw new Error(await functionErrorMessage(error))
  return data
}

// supabase-js reports a non-2xx as a generic message; dig out the function's own
// { error } body so the UI shows what actually went wrong.
async function functionErrorMessage(error: unknown): Promise<string> {
  const ctx = (error as { context?: Response }).context
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = await ctx.json()
      if (body?.error) return typeof body.error === 'string' ? body.error : JSON.stringify(body.error)
    } catch { /* fall through */ }
  }
  return error instanceof Error ? error.message : String(error)
}
