import { supabase } from './supabase'
import type { Range } from './analytics'

// Internal contract for the Google Search Console (SEO) panel — separate from the
// Vercel traffic contract, surfaced as its own "Search" section in the Analytics view.
export interface SearchData {
  range: { from: string; to: string }
  totals: { clicks: number; impressions: number; ctr: number; position: number }
  pagesCount?: number
  queriesCount?: number
  timeseries: Array<{ date: string; clicks: number; impressions: number }>
  topQueries: Array<{ query: string; clicks: number; impressions: number; ctr: number; position: number }>
  topPages: Array<{ page: string; clicks: number; impressions: number; ctr: number; position: number }>
}

export async function fetchSearch(range: Range): Promise<SearchData> {
  const { data, error } = await supabase.functions.invoke('search-console', { body: { range } })
  if (error) throw error
  if (data?.error) throw new Error(String(data.error))
  return data as SearchData
}

// Daily SEO snapshots accumulated by the search-console function (the "Progress" view).
export interface SeoSnapshot {
  day: string
  clicks: number
  impressions: number
  pages: number
  queries: number
  position: number
}

export async function fetchSnapshots(): Promise<SeoSnapshot[]> {
  const { data, error } = await supabase
    .from('seo_snapshots')
    .select('day, clicks, impressions, pages, queries, position')
    .order('day', { ascending: true })
  if (error) throw error
  return (data ?? []) as SeoSnapshot[]
}
