import { supabase } from './supabase'
import type { ContentInsight, ContentPost, ContentPostStatus } from '../types'

// ── Insight bank (raw anonymised findings) ───────────────────────────────────
export async function listContentInsights(): Promise<ContentInsight[]> {
  const { data, error } = await supabase
    .from('content_insights')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as ContentInsight[]
}

export interface NewContentInsight {
  summary: string
  detail?: string | null
  sector?: string | null
  metric?: string | null
  tags?: string[]
  anonymised: boolean
}

export async function createContentInsight(d: NewContentInsight): Promise<ContentInsight> {
  const { data, error } = await supabase.from('content_insights').insert(d).select().single()
  if (error) throw error
  return data as ContentInsight
}

// ── Drafts (LinkedIn-ready) ──────────────────────────────────────────────────
export async function listContentPosts(): Promise<ContentPost[]> {
  const { data, error } = await supabase
    .from('content_posts')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as ContentPost[]
}

export async function setPostStatus(id: string, status: ContentPostStatus): Promise<void> {
  const { error } = await supabase.from('content_posts').update({ status }).eq('id', id)
  if (error) throw error
}

export async function deleteContentPost(id: string): Promise<void> {
  const { error } = await supabase.from('content_posts').delete().eq('id', id)
  if (error) throw error
}

// ── Generation (anonymised finding → drafts) ─────────────────────────────────
export async function generateDrafts(opts: {
  insight_id?: string
  raw_text?: string
  variant_count?: number
  cta_type?: 'report' | 'call' | 'none'
}): Promise<number> {
  const { data, error } = await supabase.functions.invoke('generate-drafts', { body: opts })
  if (error) throw error
  return (data?.count ?? 0) as number
}

// ── Signals from a published insight (text + branded image + link) ────────────
export async function generateSignalsFromInsight(insightId: string): Promise<number> {
  const { data, error } = await supabase.functions.invoke('generate-signals', {
    body: { insight_id: insightId },
  })
  if (error) {
    // supabase-js gives a generic "non-2xx" — dig out the function's real message.
    let msg = error.message
    try {
      const ctx = (error as { context?: { json?: () => Promise<{ error?: string }> } }).context
      const body = ctx?.json ? await ctx.json() : null
      if (body?.error) msg = body.error
    } catch {
      /* keep generic message */
    }
    throw new Error(msg)
  }
  return (data?.count ?? 0) as number
}
