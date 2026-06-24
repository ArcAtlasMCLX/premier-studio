import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { deleteCaseStudy, listCaseStudies, triggerRebuild, HOMEPAGE_CAP } from '../lib/caseStudies'
import type { CaseStudy } from '../lib/caseStudies'
import { CaseStudiesHelp } from '../components/CaseStudiesHelp'

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-line text-ink-soft',
  published: 'bg-teal/15 text-teal-ink',
}

export function CaseStudiesList() {
  const [items, setItems] = useState<CaseStudy[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)

  function load() {
    setLoading(true)
    listCaseStudies().then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  async function onDelete(cs: CaseStudy) {
    if (!window.confirm(`Delete "${cs.title}"? This cannot be undone.`)) return
    setBusyId(cs.id); setError(null)
    try {
      await deleteCaseStudy(cs.id)
      await triggerRebuild()
      setItems((xs) => xs.filter((x) => x.id !== cs.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally { setBusyId(null) }
  }

  const onHomepage = items.filter((i) => i.show_on_homepage && i.status === 'published').length

  return (
    <div className="max-w-4xl mx-auto px-8 py-8">
      <div className="flex items-center justify-between mb-2">
        <h1 className="font-head text-2xl font-bold text-navy">Case Studies</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setHelpOpen(true)}
            className="px-3 py-2 rounded-lg border border-line text-ink-soft hover:text-navy hover:border-navy font-head font-semibold text-sm"
          >
            ? Help
          </button>
          <Link to="/case-studies/new" className="px-4 py-2 rounded-lg bg-teal text-navy font-head font-semibold text-sm">
            ＋ New case study
          </Link>
        </div>
      </div>
      <CaseStudiesHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
      <p className="text-ink-soft text-sm mb-5">
        Ordered by <strong>rank</strong> (lowest first = always-feature), then newest. Homepage shows the ones
        toggled on — <strong className={onHomepage >= HOMEPAGE_CAP ? 'text-orange' : ''}>{onHomepage}/{HOMEPAGE_CAP}</strong> selected.
      </p>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
      {loading ? <p className="text-ink-soft text-sm">Loading…</p> : (
        <div className="bg-white border border-line rounded-xl divide-y divide-line">
          {items.map((cs) => (
            <div key={cs.id} className="flex items-center gap-3 px-4 py-3">
              <span className="w-8 shrink-0 text-center text-xs font-bold text-ink-soft">
                {cs.rank ?? '—'}
              </span>
              <div className="flex-1 min-w-0">
                <Link to={`/case-studies/${cs.id}`} className="font-semibold text-navy hover:text-teal-ink truncate block">
                  {cs.title}
                </Link>
                <span className="text-xs text-ink-soft">{cs.client}</span>
              </div>
              {cs.show_on_homepage && (
                <span className="shrink-0 text-[11px] font-semibold text-teal-ink bg-teal/15 rounded-full px-2 py-0.5">★ Homepage</span>
              )}
              <span className={`shrink-0 text-[11px] font-semibold rounded-full px-2.5 py-0.5 capitalize ${STATUS_STYLE[cs.status]}`}>
                {cs.status}
              </span>
              <Link to={`/case-studies/${cs.id}`} className="shrink-0 text-xs font-semibold text-teal-ink">Edit</Link>
              <button onClick={() => onDelete(cs)} disabled={busyId === cs.id}
                className="shrink-0 text-xs text-ink-soft hover:text-red-600">Delete</button>
            </div>
          ))}
          {items.length === 0 && <p className="text-ink-soft text-sm p-4">No case studies yet.</p>}
        </div>
      )}
    </div>
  )
}
