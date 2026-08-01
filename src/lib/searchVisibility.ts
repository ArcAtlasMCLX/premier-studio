import { supabase } from './supabase'

// Search-visibility baseline tracker — the 30 fixed commercial queries, fixed
// 28-day windows, "how many in the top 10". Read client-side under author RLS
// (mirrors seo_snapshots/fetchSnapshots); writes go through the ingest RPC.
// DISTINCT from seo_snapshots (whole-site rolling totals) — different instrument.

export interface BaselineSet { id: string; name: string; frozen_at: string; window_days: number; notes: string | null }
export interface TrackedQuery { id: string; query: string; cluster: string; display_order: number }
export interface Reading {
  id: string; period_start: string; period_end: string
  source: string; is_baseline: boolean; ingested_at: string; notes: string | null
}
export interface ReadingRow {
  reading_id: string; tracked_query_id: string
  impressions: number | null; clicks: number | null; position: number | null   // NULL = absent, never 0
}
export interface SearchEvent { id: string; occurred_on: string; label: string; detail: string | null }

export interface SearchVisibility {
  set: BaselineSet
  tracked: TrackedQuery[]                                       // 30, ordered by display_order
  readings: Reading[]                                           // period_start asc; [0] is the baseline
  rowsByReading: Record<string, Record<string, ReadingRow>>    // readingId -> trackedQueryId -> row
  events: SearchEvent[]
}

export async function fetchSearchVisibility(): Promise<SearchVisibility | null> {
  const { data: sets, error: e1 } = await supabase
    .from('search_baseline_set').select('*').order('frozen_at', { ascending: false }).limit(1)
  if (e1) throw e1
  const set = (sets ?? [])[0] as BaselineSet | undefined
  if (!set) return null

  const [tq, rd, ev] = await Promise.all([
    supabase.from('search_tracked_query').select('*').eq('set_id', set.id).order('display_order', { ascending: true }),
    supabase.from('search_reading').select('*').eq('set_id', set.id).order('period_start', { ascending: true }),
    supabase.from('search_event').select('*').eq('set_id', set.id).order('occurred_on', { ascending: true }),
  ])
  if (tq.error) throw tq.error
  if (rd.error) throw rd.error
  if (ev.error) throw ev.error

  const readings = (rd.data ?? []) as Reading[]
  const readingIds = readings.map((r) => r.id)
  let rows: ReadingRow[] = []
  if (readingIds.length) {
    const rr = await supabase.from('search_reading_row').select('*').in('reading_id', readingIds)
    if (rr.error) throw rr.error
    rows = (rr.data ?? []) as ReadingRow[]
  }
  const rowsByReading: Record<string, Record<string, ReadingRow>> = {}
  for (const r of rows) (rowsByReading[r.reading_id] ??= {})[r.tracked_query_id] = r

  return { set, tracked: (tq.data ?? []) as TrackedQuery[], readings, rowsByReading, events: (ev.data ?? []) as SearchEvent[] }
}

// ---- metrics --------------------------------------------------------------
export interface ReadingMetrics { top10: number; top20: number; clicks: number }

// Counts are built from the TRACKED list, and a NULL position never counts as a
// ranking (guards against absence being read as position 0 / a top-ten result).
export function readingMetrics(sv: SearchVisibility, readingId: string, cluster?: string): ReadingMetrics {
  const map = sv.rowsByReading[readingId] ?? {}
  let top10 = 0, top20 = 0, clicks = 0
  for (const t of sv.tracked) {
    if (cluster && t.cluster !== cluster) continue
    const r = map[t.id]
    if (r?.position != null && r.position <= 10) top10++
    if (r?.position != null && r.position <= 20) top20++
    if (r?.clicks != null) clicks += r.clicks
  }
  return { top10, top20, clicks }
}

// ---- CSV ingest -----------------------------------------------------------
export interface GscRow { query: string; clicks: number | null; impressions: number | null; position: number | null }
export interface IngestResult { reading_id: string; total: number; matched: number; unmatched: string[] }

export function windowDaysInclusive(start: string, end: string): number {
  const a = Date.parse(start + 'T00:00:00Z'), b = Date.parse(end + 'T00:00:00Z')
  if (Number.isNaN(a) || Number.isNaN(b)) return NaN
  return Math.round((b - a) / 86_400_000) + 1
}

// Parse a GSC "Queries" export (Top queries, Clicks, Impressions, CTR, Position).
// Absent numeric cells stay NULL — never defaulted to 0.
export function parseGscCsv(text: string): GscRow[] {
  const grid = splitCsv(text.replace(/^﻿/, ''))
  if (!grid.length) return []
  const header = grid[0].map((h) => h.trim().toLowerCase())
  const qi = header.indexOf('top queries')
  if (qi < 0) throw new Error('Not a GSC “Queries” export — no “Top queries” column found.')
  const ci = header.indexOf('clicks'), ii = header.indexOf('impressions'), pi = header.indexOf('position')
  const num = (v: string | undefined): number | null => {
    const s = (v ?? '').trim().replace(/,/g, '').replace(/%$/, '')
    if (s === '') return null
    const n = Number(s)
    return Number.isFinite(n) ? n : null
  }
  const intOrNull = (n: number | null) => (n == null ? null : Math.round(n))
  const out: GscRow[] = []
  for (let i = 1; i < grid.length; i++) {
    const f = grid[i]
    const query = (f[qi] ?? '').trim()
    if (!query) continue
    out.push({
      query,
      clicks: ci >= 0 ? intOrNull(num(f[ci])) : null,
      impressions: ii >= 0 ? intOrNull(num(f[ii])) : null,
      position: pi >= 0 ? num(f[pi]) : null,
    })
  }
  return out
}

// Minimal RFC-4180-ish splitter (handles quoted fields, embedded commas/quotes, CRLF).
function splitCsv(text: string): string[][] {
  const rows: string[][] = []
  let field = '', row: string[] = [], q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else q = false }
      else field += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); rows.push(row); field = ''; row = []
    } else field += c
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  return rows.filter((r) => r.length > 1 || (r[0] ?? '').trim() !== '')
}

export async function ingestReading(
  setId: string, periodStart: string, periodEnd: string, rows: GscRow[], replace: boolean,
): Promise<IngestResult> {
  const { data, error } = await supabase.rpc('ingest_search_reading', {
    p_set: setId, p_start: periodStart, p_end: periodEnd, p_source: 'gsc_csv', p_rows: rows, p_replace: replace,
  })
  if (error) throw error
  return data as IngestResult
}
