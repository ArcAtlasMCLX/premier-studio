import { supabase } from './supabase'

// Client reports ("Updates") — the ~12/year measurement-window write-ups, stored as
// standalone HTML (+ PDF) in the private `reports` bucket, one row per report in
// studio.report. Author-gated by RLS (studio.is_author()), read client-side like the
// rest of Studio. No editor/upload UI — rows + files are added by hand.

const BUCKET = 'reports'

export interface Report {
  id: string
  slug: string
  title: string
  subtitle: string | null
  period_start: string
  period_end: string
  html_path: string
  pdf_path: string | null
  published_at: string | null
  created_by: string | null
}

export async function listReports(): Promise<Report[]> {
  const { data, error } = await supabase
    .from('report')
    .select('*')
    .order('period_end', { ascending: false })
  if (error) throw error
  return (data ?? []) as Report[]
}

export async function getReport(slug: string): Promise<Report | null> {
  const { data, error } = await supabase.from('report').select('*').eq('slug', slug).maybeSingle()
  if (error) throw error
  return (data ?? null) as Report | null
}

// Private bucket → time-limited signed URL (mirrors the Image Bank pattern). Used for
// the iframe src, the "open raw HTML" link, and the PDF download.
export async function signedUrl(path: string, expiresSeconds = 3600, download = false): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresSeconds, download ? { download: true } : undefined)
  if (error) throw error
  return data.signedUrl
}

// Plain-language period, e.g. "1 – 28 August 2026". Falls back to the dates when a
// subtitle isn't stored.
export function periodLabel(r: Report): string {
  if (r.subtitle) return r.subtitle
  const fmt = (iso: string, withYear: boolean) =>
    new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC',
    })
  const start = fmt(r.period_start, false)
  const end = fmt(r.period_end, true)
  return `${start} – ${end}`
}

export function publishedLabel(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
