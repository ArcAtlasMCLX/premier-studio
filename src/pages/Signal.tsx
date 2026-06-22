import { useEffect, useState } from 'react'
import {
  createContentInsight,
  deleteContentPost,
  generateDrafts,
  listContentInsights,
  listContentPosts,
  setPostStatus,
} from '../lib/signal'
import type { ContentInsight, ContentPost, ContentPostStatus } from '../types'

const inputCls =
  'w-full px-3 py-2 rounded-lg border border-line focus:outline-none focus:ring-2 focus:ring-teal/40'
const STATUSES: ContentPostStatus[] = [
  'idea', 'drafted', 'in_review', 'approved', 'scheduled', 'posted', 'archived',
]

export function Signal() {
  const [insights, setInsights] = useState<ContentInsight[]>([])
  const [posts, setPosts] = useState<ContentPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // add-insight form
  const [summary, setSummary] = useState('')
  const [sector, setSector] = useState('')
  const [metric, setMetric] = useState('')
  const [anonymised, setAnonymised] = useState(false)
  const [adding, setAdding] = useState(false)

  async function reload() {
    const [i, p] = await Promise.all([listContentInsights(), listContentPosts()])
    setInsights(i)
    setPosts(p)
  }

  useEffect(() => {
    reload()
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [])

  async function onAdd() {
    if (!summary.trim()) {
      setError('Add a summary.')
      return
    }
    setAdding(true)
    setError(null)
    try {
      await createContentInsight({
        summary: summary.trim(),
        sector: sector.trim() || null,
        metric: metric.trim() || null,
        anonymised,
      })
      setSummary(''); setSector(''); setMetric(''); setAnonymised(false)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setAdding(false)
    }
  }

  async function onGenerate(insight: ContentInsight) {
    setBusyId(insight.id)
    setError(null)
    try {
      await generateDrafts({ insight_id: insight.id, variant_count: 3, cta_type: 'none' })
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusyId(null)
    }
  }

  async function onStatus(post: ContentPost, status: ContentPostStatus) {
    setPosts((xs) => xs.map((x) => (x.id === post.id ? { ...x, status } : x)))
    try {
      await setPostStatus(post.id, status)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  async function onDelete(post: ContentPost) {
    if (!window.confirm('Delete this draft?')) return
    setBusyId(post.id)
    try {
      await deleteContentPost(post.id)
      setPosts((xs) => xs.filter((x) => x.id !== post.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusyId(null)
    }
  }

  async function onCopy(post: ContentPost) {
    try {
      await navigator.clipboard.writeText(post.body)
      setCopiedId(post.id)
      window.setTimeout(() => setCopiedId((c) => (c === post.id ? null : c)), 1500)
    } catch {
      setError('Could not copy to clipboard.')
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-8 py-8">
      <h1 className="font-head text-2xl font-bold text-navy mb-2">Signal</h1>
      <p className="text-ink-soft text-sm mb-4">
        Signal is your social-content workbench. It turns what you know into LinkedIn-ready posts —
        which you always review and post yourself. Nothing is ever published automatically.
      </p>

      <details className="bg-white border border-line rounded-xl p-5 mb-6 text-sm" open>
        <summary className="font-head font-semibold text-navy cursor-pointer">
          How Signal works
        </summary>
        <div className="mt-3 space-y-2 text-ink-soft leading-relaxed">
          <p>
            <strong className="text-navy">Two ways posts arrive in the bank:</strong>
          </p>
          <p>
            <strong className="text-navy">1. From a finding (manual).</strong> Add an{' '}
            <em>anonymised</em> compliance finding to the Insight bank below, then “Generate 3 drafts”
            — three different LinkedIn angles on it. (The anonymised tick is a hard gate; nothing is
            sent to AI until you confirm it.)
          </p>
          <p>
            <strong className="text-navy">2. From an insight (automatic).</strong> Whenever you
            generate an Insight, three <strong className="text-navy">Signals</strong> are seeded here
            for it — each with post text, a branded square image, and a link back to the article.
          </p>
          <p>
            <strong className="text-navy">What you get:</strong> draft posts you move through{' '}
            <em>drafted → approved → posted</em>, copy with one click, and (for insight signals) a
            ready-to-share image. <strong className="text-navy">Output is text you post manually</strong> —
            Signal never connects to LinkedIn or posts for you.
          </p>
        </div>
      </details>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      {/* Insight bank */}
      <section className="bg-white border border-line rounded-xl p-6 mb-8">
        <h2 className="font-head font-bold text-navy mb-4">Insight bank</h2>
        <div className="space-y-3">
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={2}
            placeholder="Summary of the finding (anonymised — no client names)"
            className={inputCls}
          />
          <div className="grid grid-cols-2 gap-3">
            <input value={sector} onChange={(e) => setSector(e.target.value)} placeholder="Sector (optional)" className={inputCls} />
            <input value={metric} onChange={(e) => setMetric(e.target.value)} placeholder="Metric / result (optional)" className={inputCls} />
          </div>
          <label className="flex items-center gap-2 text-sm text-navy">
            <input type="checkbox" checked={anonymised} onChange={(e) => setAnonymised(e.target.checked)} />
            This finding is fully anonymised — safe to generate from
          </label>
          <button
            onClick={onAdd}
            disabled={adding}
            className="px-4 py-2 rounded-lg bg-teal text-navy font-head font-semibold text-sm disabled:opacity-60"
          >
            {adding ? 'Adding…' : 'Add to bank'}
          </button>
        </div>

        {loading ? (
          <p className="text-ink-soft mt-4">Loading…</p>
        ) : insights.length > 0 ? (
          <ul className="mt-5 divide-y divide-line border-t border-line">
            {insights.map((ins) => (
              <li key={ins.id} className="py-3 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm text-navy font-medium">{ins.summary}</p>
                  <p className="text-xs text-ink-soft mt-0.5">
                    {ins.sector && <span>{ins.sector} · </span>}
                    <span className={ins.anonymised ? 'text-teal-ink' : 'text-orange'}>
                      {ins.anonymised ? 'anonymised' : 'not anonymised'}
                    </span>
                    {ins.status === 'used' && <span> · used</span>}
                  </p>
                </div>
                <button
                  onClick={() => onGenerate(ins)}
                  disabled={!ins.anonymised || busyId === ins.id}
                  title={ins.anonymised ? '' : 'Mark anonymised first'}
                  className="shrink-0 px-3 py-1.5 rounded-lg border border-line text-xs font-semibold text-teal-ink hover:bg-surface disabled:opacity-50"
                >
                  {busyId === ins.id ? 'Generating…' : '✦ Generate 3 drafts'}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink-soft text-sm mt-4">No findings yet.</p>
        )}
      </section>

      {/* Drafts */}
      <section>
        <h2 className="font-head font-bold text-navy mb-4">Drafts</h2>
        {posts.length === 0 ? (
          <p className="text-ink-soft text-sm">No drafts yet — generate some from a finding above.</p>
        ) : (
          <div className="space-y-4">
            {posts.map((p) => (
              <article key={p.id} className="bg-white border border-line rounded-xl p-5">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="text-xs font-semibold text-teal-ink">
                    {p.variant_label ?? 'Draft'}
                    {p.source_insight_id && <span className="text-ink-soft font-normal"> · from insight</span>}
                  </span>
                  <div className="flex items-center gap-2">
                    <select
                      value={p.status}
                      onChange={(e) => onStatus(p, e.target.value as ContentPostStatus)}
                      className="text-xs border border-line rounded-md px-2 py-1"
                    >
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button onClick={() => onCopy(p)} className="text-xs font-semibold text-teal-ink hover:underline">
                      {copiedId === p.id ? 'Copied!' : 'Copy'}
                    </button>
                    <button
                      onClick={() => onDelete(p)}
                      disabled={busyId === p.id}
                      className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div className="flex gap-4">
                  {p.image_url && (
                    <a href={p.image_url} target="_blank" rel="noreferrer" className="shrink-0">
                      <img
                        src={p.image_url}
                        alt=""
                        className="w-28 h-28 object-cover rounded-lg border border-line"
                      />
                    </a>
                  )}
                  <p className="text-sm text-ink whitespace-pre-wrap leading-relaxed">{p.body}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
