import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getReport, signedUrl, periodLabel, type Report } from '../lib/reports'

// A report is a COMPLETE standalone HTML document (own <head>, Google Fonts, full
// stylesheet), rendered in a sandboxed iframe so its styles can't collide with Studio's.
// It is FETCHED and injected via `srcDoc`, not pointed at with `src`: Supabase Storage
// serves HTML objects as text/plain on egress (a platform XSS guard on the supabase.co
// origin — not configurable, no upload-side fix), so an iframe `src` shows source. srcDoc
// is parsed as HTML by definition, which sidesteps the served content-type entirely; and
// fetch().text() decodes as UTF-8 regardless of the header, so the document's own
// characters (em-dashes etc.) come through clean.
export function UpdateViewer() {
  const { slug } = useParams<{ slug: string }>()
  const [report, setReport] = useState<Report | null | undefined>(undefined) // undefined = loading
  const [htmlDoc, setHtmlDoc] = useState<string | null>(null)                 // fetched HTML → iframe srcDoc
  const [htmlUrl, setHtmlUrl] = useState<string | null>(null)                 // signed URL for the "Open raw HTML" link
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
          const res = await fetch(html)
          if (!res.ok) throw new Error(`Report fetch failed (${res.status})`)
          const text = await res.text()
          if (live) setHtmlDoc(text)
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

          {htmlDoc ? (
            <iframe
              srcDoc={htmlDoc}
              title={report.title}
              sandbox=""
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
