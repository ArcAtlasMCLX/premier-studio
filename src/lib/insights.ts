import { supabase } from './supabase'
import type { Insight, InsightDraft } from '../types'

// Rebuild the public site via the author-gated trigger-rebuild edge function,
// which holds the deploy-hook URL as a server-side secret (never in the browser).
// Failures are non-fatal — the row is saved; worst case the admin redeploys manually.
export async function triggerRebuild(): Promise<void> {
  try {
    await supabase.functions.invoke('trigger-rebuild', { body: {} })
  } catch {
    /* non-fatal */
  }
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function listInsights(): Promise<Insight[]> {
  const { data, error } = await supabase
    .from('insights')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Insight[]
}

export async function getInsight(id: string): Promise<Insight> {
  const { data, error } = await supabase.from('insights').select('*').eq('id', id).single()
  if (error) throw error
  return data as Insight
}

export async function createInsight(draft: InsightDraft): Promise<Insight> {
  const { data: userData } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('insights')
    .insert({ ...draft, author_id: userData.user?.id ?? null })
    .select()
    .single()
  if (error) throw error
  return data as Insight
}

export async function updateInsight(id: string, patch: Partial<InsightDraft>): Promise<Insight> {
  const { data, error } = await supabase
    .from('insights')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Insight
}

export async function publishInsight(id: string): Promise<Insight> {
  return updateInsight(id, { status: 'published', published_at: new Date().toISOString() })
}

export async function deleteInsight(id: string): Promise<void> {
  const { error } = await supabase.from('insights').delete().eq('id', id)
  if (error) throw error
}

// Weekday publish slots (Mon–Fri, one per day) from `start`. Skips weekends and
// rolls into following weeks if there are more than five.
export function weekdaySlots(count: number, start: Date = new Date(), hour = 9): string[] {
  const slots: string[] = []
  const d = new Date(start)
  d.setHours(hour, 0, 0, 0)
  while (slots.length < count) {
    const day = d.getDay() // 0 Sun … 6 Sat
    if (day !== 0 && day !== 6) slots.push(new Date(d).toISOString())
    d.setDate(d.getDate() + 1)
  }
  return slots
}

// Schedule the given insights (in order) one per weekday from today. The
// auto-publish cron flips each to published when its slot is due, then rebuilds.
export async function scheduleInsightsWeek(ids: string[], start: Date = new Date()): Promise<string[]> {
  const slots = weekdaySlots(ids.length, start)
  for (let i = 0; i < ids.length; i++) {
    await updateInsight(ids[i], { status: 'scheduled', scheduled_at: slots[i] })
  }
  return slots
}

export async function uploadCover(file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('studio-insights').upload(path, file, { upsert: false })
  if (error) throw error
  const { data } = supabase.storage.from('studio-insights').getPublicUrl(path)
  return data.publicUrl
}
