import { supabase } from './supabase'

// Internal contract — the UI binds to this, NOT Vercel's raw shape, so the source
// can later be swapped (Drains/GA/Plausible) without touching the view.
export interface AnalyticsData {
  range: { from: string; to: string }
  totals: { visitors: number; pageViews: number; bounceRate?: number }
  timeseries: Array<{ date: string; visitors: number; pageViews: number }>
  topPages: Array<{ path: string; visitors: number; pageViews: number }>
  topReferrers: Array<{ source: string; visitors: number }>
}

export type Range = '7d' | '30d' | '90d'
export const RANGES: { value: Range; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
]

// Calls the author-gated `analytics` edge function (JWT attached automatically by
// supabase-js). Throws on a quiet "unavailable" so the page can show a retry state.
export async function fetchAnalytics(range: Range): Promise<AnalyticsData> {
  const { data, error } = await supabase.functions.invoke('analytics', { body: { range } })
  if (error) throw error
  if (data?.error) throw new Error(data.error === 'unavailable' ? 'unavailable' : String(data.error))
  return data as AnalyticsData
}
