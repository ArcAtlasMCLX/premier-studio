import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listReports, periodLabel, publishedLabel, type Report } from '../lib/reports'

export function UpdatesList() {
  const [reports, setReports] = useState<Report[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    listReports()
      .then((r) => { if (live) setReports(r) })
      .catch((e) => { if (live) setError(e instanceof Error ? e.message : String(e)) })
    return () => { live = false }
  }, [])

  return (
    <div className="max-w-3xl mx-auto px-8 py-8">
      <Link to="/analytics" className="text-sm text-teal-ink font-semibold">← Analytics</Link>
      <h1 className="font-head text-2xl font-bold text-navy mt-3 mb-1">Updates</h1>
      <p className="text-ink-soft text-sm mb-6">The written search-performance reports, one per measurement window — a permanent record alongside the live numbers.</p>

      {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

      {!reports && !error && <p className="text-ink-soft text-sm">Loading…</p>}

      {reports && reports.length === 0 && (
        <div className="bg-white border border-line rounded-xl p-10 text-center text-ink-soft">
          No reports yet — the first one appears here once it’s added.
        </div>
      )}

      {reports && reports.length > 0 && (
        <ul className="space-y-3">
          {reports.map((r) => (
            <li key={r.id}>
              <Link to={`/analytics/updates/${r.slug}`}
                className="block bg-white border border-line rounded-xl p-5 hover:border-teal transition-colors">
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <span className="font-head text-lg font-bold text-navy">{r.title}</span>
                  {r.published_at && <span className="text-xs text-ink-soft">Published {publishedLabel(r.published_at)}</span>}
                </div>
                <div className="text-sm text-ink-soft mt-1">{periodLabel(r)}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
