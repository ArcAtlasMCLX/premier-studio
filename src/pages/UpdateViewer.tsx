import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getReport, signedUrl, periodLabel, type Report } from '../lib/reports'

// A report is a COMPLETE standalone HTML document (own <head>, Google Fonts, full
// stylesheet). It's rendered in an iframe so its styles can't collide with Studio's —
// never injected into the Studio DOM. Studio sets no CSP, so the storage-origin iframe
// loads freely; the private bucket is reached via a time-limited signed URL.
export function UpdateViewer() {
  const { slug } = useParams<{ slug: string }>()
  const [report, setReport] = useState<Report | null | undefined>(undefined) // undefined = loading
  const [htmlUrl, setHtmlUrl] = useState<string | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    if (!slug) return
    getReport(slug)
      .then(async (r) => {
        if (!live) return
        setReport(r)
        if (!r) return
        try {
          const html = await signedUrl(r.html_path)
          if (live) setHtmlUrl(html)
          if (r.pdf_path) {
            const pdf = await signedUrl(r.pdf_path, 3600, true)
            if (live) setPdfUrl(pdf)
          }
        } catch (e) {
          if (live) setError(e instanceof Error ? e.message : String(e))
        }
      })
      .catch((e) => { if (live) { setReport(null); setError(e instanceof Error ? e.message : String(e)) } })
    return () => { live = false }
  }, [slug])

  return (
    <div className="max-w-5xl mx-auto px-8 py-8">
      <Link to="/analytics/updates" className="text-sm text-teal-ink font-semibold">← Updates</Link>

      {report === undefined && !error ? (
        <p className="text-ink-soft text-sm mt-4">Loading…</p>
      ) : report === null ? (
        <div className="bg-white border border-line rounded-xl p-10 text-center text-ink-soft mt-4">Report not found.</div>
      ) : report ? (
        <>
          <div className="flex items-end justify-between gap-4 flex-wrap mt-3 mb-4">
            <div>
              <h1 className="font-head text-2xl font-bold text-navy">{report.title}</h1>
              <p className="text-ink-soft text-sm mt-1">{periodLabel(report)}</p>
            </div>
            <div className="flex items-center gap-4 text-sm">
              {htmlUrl && (
                <a href={htmlUrl} target="_blank" rel="noopener noreferrer" className="text-teal-ink font-semibold hover:underline">
                  Open raw HTML ↗
                </a>
              )}
              {pdfUrl && (
                <a href={pdfUrl} className="text-teal-ink font-semibold hover:underline">Download PDF ↓</a>
              )}
            </div>
          </div>

          {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{error}</p>}

          {htmlUrl ? (
            <iframe
              src={htmlUrl}
              title={report.title}
              className="w-full bg-white border border-line rounded-xl"
              style={{ height: 'calc(100vh - 220px)', minHeight: '520px' }}
              referrerPolicy="no-referrer"
            />
          ) : !error ? (
            <p className="text-ink-soft text-sm">Loading report…</p>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
