import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { listInsights } from '../lib/insights'
import { startBatch, getJob, type GenJob } from '../lib/engine'

const inputCls =
  'w-full px-3 py-2 rounded-lg border border-line focus:outline-none focus:ring-2 focus:ring-teal/40'

export function ContentEngine() {
  const [theme, setTheme] = useState('')
  const [count, setCount] = useState(3)
  const [jobId, setJobId] = useState<string | null>(null)
  const [job, setJob] = useState<GenJob | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!jobId) return
    let active = true
    const tick = async () => {
      try {
        const j = await getJob(jobId)
        if (!active) return
        setJob(j)
        if (j && (j.status === 'complete' || j.status === 'failed')) {
          window.clearInterval(timer.current)
        }
      } catch {
        /* transient — keep polling */
      }
    }
    tick()
    timer.current = window.setInterval(tick, 3000)
    return () => {
      active = false
      window.clearInterval(timer.current)
    }
  }, [jobId])

  async function onGenerate() {
    if (!theme.trim()) {
      setError('Enter a theme.')
      return
    }
    setBusy(true)
    setError(null)
    setJob(null)
    setJobId(null)
    try {
      const existing = await listInsights()
      const titles = existing.map((i) => i.title).filter(Boolean)
      const id = await startBatch(theme.trim(), count, titles)
      setJobId(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const running = jobId !== null && (!job || job.status === 'running')
  const pct = job && job.total > 0 ? Math.round((job.progress / job.total) * 100) : 0

  return (
    <div className="max-w-2xl mx-auto px-8 py-8">
      <h1 className="font-head text-2xl font-bold text-navy mb-2">Content Engine</h1>
      <p className="text-ink-soft text-sm mb-6">
        Generate several insight drafts on a theme. Each one is written in Premier's voice with a
        cover image and saved as <strong>pending review</strong> — nothing goes live until you
        publish it from the Insights list.
      </p>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      <div className="bg-white border border-line rounded-xl p-6 space-y-5">
        <label className="block">
          <span className="block text-xs font-semibold text-navy mb-1">Theme</span>
          <textarea
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            rows={5}
            placeholder={
              'e.g. Fire door compliance for housing providers.\n' +
              'Audience: housing association property managers.\n' +
              'Angle: what the Fire Safety (England) Regulations 2022 require, in plain English.\n' +
              'Focus: quarterly communal-door checks, common failures, evidence to keep.\n' +
              'Avoid: scaremongering, naming specific clients.'
            }
            className={`${inputCls} resize-y`}
            disabled={running}
          />
          <p className="text-xs text-ink-soft mt-2 leading-relaxed">
            <strong>Tips for a good theme.</strong> The more direction you give, the sharper the
            drafts. Try to cover: <strong>who it's for</strong> (audience/sector),
            the <strong>angle</strong> (the question or problem to answer),
            the <strong>regulation or standard</strong> to ground it in (e.g. BS 9999, TR19, the
            Building Safety Act 2022), and anything to <strong>avoid</strong>. One topic per batch
            works best — each draft is a different take on the same theme.
          </p>
        </label>
        <label className="block">
          <span className="block text-xs font-semibold text-navy mb-1">How many drafts</span>
          <select
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className={inputCls}
            disabled={running}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <button
          onClick={onGenerate}
          disabled={busy || running}
          className="px-5 py-2.5 rounded-lg bg-teal text-navy font-head font-semibold disabled:opacity-60"
        >
          {busy ? 'Starting…' : running ? 'Generating…' : '✦ Generate drafts'}
        </button>
      </div>

      {jobId && (
        <div className="bg-white border border-line rounded-xl p-6 mt-6">
          {job?.status === 'complete' ? (
            <div>
              <p className="font-head font-semibold text-navy">Done — {job.message}</p>
              <p className="text-sm text-ink-soft mt-1">
                Drafts are saved as pending review.{' '}
                <Link to="/" className="text-teal-ink font-semibold">Review them in Insights →</Link>
              </p>
            </div>
          ) : job?.status === 'failed' ? (
            <p className="text-red-600 text-sm">Generation failed: {job.message}</p>
          ) : (
            <div>
              <p className="text-sm text-ink-soft mb-2">{job?.message ?? 'Starting…'}</p>
              <div className="h-2 rounded-full bg-surface overflow-hidden">
                <div className="h-full bg-teal transition-all" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-xs text-ink-soft mt-2">This runs in the background — you can leave this page.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
