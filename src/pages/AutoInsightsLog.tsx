import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listAutoInsightRuns, runAutoInsight, type AutoInsightRun, type DryRunResult } from '../lib/autoInsights'

const OUTCOME_STYLE: Record<string, string> = {
  drafted: 'bg-teal/15 text-teal-ink',
  published_fallback: 'bg-light-blue/15 text-light-blue',
  reminded: 'bg-orange/15 text-orange',
  skipped_recent: 'bg-line text-ink-soft',
  skipped_no_item: 'bg-line text-ink-soft',
  dry_run: 'bg-line text-ink-soft',
  running: 'bg-line text-ink-soft',
  failed: 'bg-red-100 text-red-700',
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function AutoInsightsLog() {
  const [runs, setRuns] = useState<AutoInsightRun[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<null | 'preview' | 'run'>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [preview, setPreview] = useState<DryRunResult | null>(null)

  async function refresh() {
    try {
      setRuns(await listAutoInsightRuns())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [])

  async function onPreview() {
    setBusy('preview'); setError(null); setMessage(null); setPreview(null)
    try {
      // dry run + force: drafts from the live feeds and returns it, but writes nothing,
      // emails no one and publishes nothing. Safe to run on the live project.
      const res = await runAutoInsight({ dryRun: true, force: true })
      setPreview(res as DryRunResult)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  async function onRunNow() {
    if (!window.confirm('Run the auto-insights check now? If the site is quiet it will draft an insight, save it as pending review and email the approvers. Nothing is published.')) return
    setBusy('run'); setError(null); setMessage(null); setPreview(null)
    try {
      await runAutoInsight({})
      setMessage('Run started in the background. Give it a minute, then Refresh to see the outcome in the log.')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-8 py-8">
      <div className="flex items-center justify-between mb-2 gap-4 flex-wrap">
        <h1 className="font-head text-2xl font-bold text-navy">Auto-insights</h1>
        <div className="flex items-center gap-3">
          <button
            type="button" onClick={onPreview} disabled={busy !== null}
            title="Draft from the live feeds and show it here — writes nothing, emails no one"
            className="px-4 py-2 rounded-lg border border-line text-navy font-head font-semibold text-sm disabled:opacity-60"
          >
            {busy === 'preview' ? 'Drafting…' : 'Preview a draft'}
          </button>
          <button
            type="button" onClick={onRunNow} disabled={busy !== null}
            className="px-4 py-2 rounded-lg bg-teal text-navy font-head font-semibold text-sm disabled:opacity-60"
          >
            {busy === 'run' ? 'Starting…' : 'Run now'}
          </button>
          <button type="button" onClick={refresh} className="text-sm text-teal-ink font-semibold">Refresh</button>
        </div>
      </div>
      <p className="text-ink-soft text-sm mb-6">
        When nothing has been published or scheduled for a fortnight, a draft is written from official and
        trade fire-safety feeds, saved as <strong>pending review</strong>, and emailed to the approvers. If it
        isn’t approved within the fallback window, a short, claim-free version is auto-published.
      </p>

      {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{error}</p>}
      {message && <p className="text-teal-ink text-sm mb-4">{message}</p>}

      {preview && (
        <div className="bg-white border border-line rounded-xl p-5 mb-6">
          <p className="text-xs uppercase tracking-wide text-ink-soft mb-2">Preview (dry run — nothing saved)</p>
          {preview.outcome !== 'dry_run' ? (
            <p className="text-sm text-navy">
              No draft produced — <strong>{preview.outcome.replace(/_/g, ' ')}</strong>
              {preview.detail ? ` (${preview.detail})` : ''}
              {typeof preview.fetched === 'number' ? ` · fetched ${preview.fetched} items` : ''}.
            </p>
          ) : (
            <>
              <h2 className="font-head text-lg font-bold text-navy">{preview.draft?.title}</h2>
              <p className="text-sm text-ink-soft mt-1 mb-3">{preview.draft?.safe_summary}</p>
              <p className="text-sm mb-3">
                {preview.auto_publishable
                  ? <span className="text-teal-ink font-semibold">Summary is auto-publishable (no claims to verify).</span>
                  : <span className="text-orange font-semibold">Needs review — summary carries something to verify.</span>}
              </p>
              {preview.verify_flags && preview.verify_flags.length > 0 && (
                <div className="mb-3">
                  <p className="text-sm font-semibold text-navy">To verify ({preview.verify_flags.length}):</p>
                  <ul className="list-disc ml-5 text-sm text-ink-soft">
                    {preview.verify_flags.map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                </div>
              )}
              {preview.item && (
                <p className="text-xs text-ink-soft mb-3">
                  Source: <a href={preview.item.link} target="_blank" rel="noopener noreferrer" className="text-teal-ink underline">{preview.item.link}</a>
                </p>
              )}
              <details>
                <summary className="text-sm text-teal-ink font-semibold cursor-pointer">Show full draft body</summary>
                <pre className="whitespace-pre-wrap text-sm text-navy mt-2 border-l-2 border-line pl-3">{preview.draft?.content}</pre>
              </details>
            </>
          )}
        </div>
      )}

      <div className="bg-white border border-line rounded-xl overflow-hidden">
        {loading ? (
          <p className="text-ink-soft text-sm p-6">Loading…</p>
        ) : runs.length === 0 ? (
          <p className="text-ink-soft text-sm p-6">No runs yet. The daily job logs here; or press “Preview a draft”.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink-soft border-b border-line">
                <th className="font-medium px-4 py-2.5">When</th>
                <th className="font-medium px-4 py-2.5">Outcome</th>
                <th className="font-medium px-4 py-2.5">Detail</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0 align-top">
                  <td className="px-4 py-2.5 whitespace-nowrap text-ink-soft">{timeLabel(r.created_at)}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${OUTCOME_STYLE[r.outcome] ?? 'bg-line text-ink-soft'}`}>
                      {r.outcome.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-navy">
                    {r.detail}
                    {r.insight_id && (
                      <> · <Link to={`/insights/${r.insight_id}`} className="text-teal-ink font-semibold">open draft</Link></>
                    )}
                    {r.source_url && (
                      <> · <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="text-teal-ink underline">source</a></>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
