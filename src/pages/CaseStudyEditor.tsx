import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  createCaseStudy, getCaseStudy, updateCaseStudy, deleteCaseStudy,
  homepageCount, triggerRebuild, slugify, HOMEPAGE_CAP,
  type CaseStudyDraft,
} from '../lib/caseStudies'

const input = 'w-full px-3 py-2 rounded-lg border border-line text-sm focus:outline-none focus:ring-2 focus:ring-teal/40'
const label = 'block text-xs font-semibold text-navy mb-1'

const BLANK: CaseStudyDraft = {
  slug: '', title: '', client: '', location: '', value: '', duration: '', service: '',
  cover_image_url: '', excerpt: '', body: '', study_date: '', rank: null,
  show_on_homepage: false, status: 'draft',
}

export function CaseStudyEditor() {
  const { id } = useParams()
  const isNew = !id
  const nav = useNavigate()
  const [f, setF] = useState<CaseStudyDraft>(BLANK)
  const [slugTouched, setSlugTouched] = useState(false)
  const [homeUsed, setHomeUsed] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(isNew)

  useEffect(() => {
    homepageCount().then(setHomeUsed).catch(() => {})
    if (!isNew) {
      getCaseStudy(id!).then((cs) => {
        setF({ ...cs }); setSlugTouched(true)
      }).catch((e) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setLoaded(true))
    }
  }, [id, isNew])

  const set = <K extends keyof CaseStudyDraft>(k: K, v: CaseStudyDraft[K]) => setF((p) => ({ ...p, [k]: v }))

  // Turning the toggle on is blocked once 6 published studies already use it.
  const capReached = useMemo(
    () => homeUsed >= HOMEPAGE_CAP && !f.show_on_homepage,
    [homeUsed, f.show_on_homepage],
  )

  async function save(publish?: boolean) {
    setBusy(true); setError(null)
    const draft: CaseStudyDraft = {
      ...f,
      slug: (f.slug || slugify(f.title)).trim(),
      study_date: f.study_date || null,
      rank: f.rank === null || (f.rank as unknown as string) === '' ? null : Number(f.rank),
      status: publish ? 'published' : f.status,
    }
    if (!draft.title.trim()) { setError('Title is required.'); setBusy(false); return }
    if (!draft.slug) { setError('Slug is required.'); setBusy(false); return }
    try {
      if (isNew) { await createCaseStudy(draft); }
      else { await updateCaseStudy(id!, draft); }
      await triggerRebuild()
      nav('/case-studies')
    } catch (e) {
      // The DB cap trigger raises a friendly message; surface it as-is.
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  async function onDelete() {
    if (!id || !window.confirm('Delete this case study?')) return
    setBusy(true)
    try { await deleteCaseStudy(id); await triggerRebuild(); nav('/case-studies') }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); setBusy(false) }
  }

  if (!loaded) return <p className="text-ink-soft text-sm p-8">Loading…</p>

  return (
    <div className="max-w-3xl mx-auto px-8 py-8">
      <h1 className="font-head text-2xl font-bold text-navy mb-5">{isNew ? 'New case study' : 'Edit case study'}</h1>
      {error && <p className="text-red-600 text-sm mb-4 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

      <div className="space-y-4 bg-white border border-line rounded-xl p-6">
        <label className="block">
          <span className={label}>Title</span>
          <input className={input} value={f.title}
            onChange={(e) => { set('title', e.target.value); if (!slugTouched && isNew) set('slug', slugify(e.target.value)) }} />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className={label}>Slug <span className="text-ink-soft font-normal">(URL)</span></span>
            <input className={input} value={f.slug}
              onChange={(e) => { setSlugTouched(true); set('slug', slugify(e.target.value)) }} />
          </label>
          <label className="block">
            <span className={label}>Client</span>
            <input className={input} value={f.client ?? ''} onChange={(e) => set('client', e.target.value)} />
          </label>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <label className="block"><span className={label}>Location</span>
            <input className={input} value={f.location ?? ''} onChange={(e) => set('location', e.target.value)} /></label>
          <label className="block"><span className={label}>Value</span>
            <input className={input} value={f.value ?? ''} placeholder="£1.8m" onChange={(e) => set('value', e.target.value)} /></label>
          <label className="block"><span className={label}>Duration</span>
            <input className={input} value={f.duration ?? ''} onChange={(e) => set('duration', e.target.value)} /></label>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <label className="block"><span className={label}>Service</span>
            <input className={input} value={f.service ?? ''} onChange={(e) => set('service', e.target.value)} /></label>
          <label className="block"><span className={label}>Date</span>
            <input type="date" className={input} value={f.study_date ?? ''} onChange={(e) => set('study_date', e.target.value)} /></label>
        </div>
        <label className="block"><span className={label}>Cover image URL</span>
          <input className={input} value={f.cover_image_url ?? ''} placeholder="assets/images/…" onChange={(e) => set('cover_image_url', e.target.value)} /></label>
        <label className="block"><span className={label}>Excerpt</span>
          <textarea className={input} rows={2} value={f.excerpt ?? ''} onChange={(e) => set('excerpt', e.target.value)} /></label>
        <label className="block"><span className={label}>Body <span className="text-ink-soft font-normal">(markdown)</span></span>
          <textarea className={`${input} font-mono`} rows={12} value={f.body} onChange={(e) => set('body', e.target.value)} /></label>

        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-line">
          <label className="block"><span className={label}>Rank <span className="text-ink-soft font-normal">(lower = higher; blank = by date)</span></span>
            <input type="number" className={input} value={f.rank ?? ''} onChange={(e) => set('rank', e.target.value === '' ? null : Number(e.target.value))} /></label>
          <label className="block"><span className={label}>Status</span>
            <select className={input} value={f.status} onChange={(e) => set('status', e.target.value as 'draft' | 'published')}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select></label>
        </div>

        <label className={`flex items-start gap-2 text-sm rounded-lg p-3 ${capReached ? 'bg-orange/10' : 'bg-surface'}`}>
          <input type="checkbox" className="mt-0.5" checked={f.show_on_homepage} disabled={capReached}
            onChange={(e) => set('show_on_homepage', e.target.checked)} />
          <span>
            <span className="font-semibold text-navy">Shown on homepage</span>
            <span className="block text-xs text-ink-soft">
              {capReached
                ? `${HOMEPAGE_CAP}/${HOMEPAGE_CAP} already selected — turn one off on another study to add this one.`
                : `Featured in the homepage strip (hard cap of ${HOMEPAGE_CAP}; ${homeUsed}/${HOMEPAGE_CAP} used). Only applies once published.`}
            </span>
          </span>
        </label>
      </div>

      <div className="flex items-center gap-3 mt-5">
        <button onClick={() => save(false)} disabled={busy}
          className="px-5 py-2.5 rounded-lg border border-line font-head font-semibold text-sm text-navy disabled:opacity-60">
          {busy ? 'Saving…' : 'Save draft'}
        </button>
        <button onClick={() => save(true)} disabled={busy}
          className="px-5 py-2.5 rounded-lg bg-teal text-navy font-head font-semibold text-sm disabled:opacity-60">
          {busy ? 'Saving…' : 'Save & publish'}
        </button>
        <button onClick={() => nav('/case-studies')} className="px-4 py-2 text-sm font-semibold text-ink-soft">Cancel</button>
        {!isNew && <button onClick={onDelete} disabled={busy} className="ml-auto text-sm text-ink-soft hover:text-red-600">Delete</button>}
      </div>
    </div>
  )
}
