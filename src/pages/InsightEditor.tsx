import { useEffect, useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  createInsight,
  getInsight,
  publishInsight,
  slugify,
  triggerRebuild,
  updateInsight,
  uploadCover,
} from '../lib/insights'
import { assistWrite, generateCover, generatePrompts, suggestTags } from '../lib/ai'
import { generateSignalsFromInsight } from '../lib/signal'
import type { AiCard, InsightDraft, InsightStatus } from '../types'

const EMPTY: InsightDraft = {
  title: '',
  slug: '',
  subtitle: null,
  excerpt: '',
  content: '',
  cover_image_url: null,
  tags: [],
  status: 'draft',
  scheduled_at: null,
  published_at: null,
  ai_prompts: [],
  ai_cards: [],
}

const STATUSES: InsightStatus[] = ['draft', 'pending_review', 'scheduled', 'published']
const inputCls =
  'w-full px-3 py-2 rounded-lg border border-line focus:outline-none focus:ring-2 focus:ring-teal/40'
const aiBtnCls =
  'mt-2 inline-flex items-center gap-1 text-xs font-semibold text-teal-ink border border-line rounded-lg px-3 py-1.5 hover:bg-surface disabled:opacity-60'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-navy mb-1">{label}</span>
      {children}
    </label>
  )
}

export function InsightEditor() {
  const { id } = useParams()
  const nav = useNavigate()

  const [draft, setDraft] = useState<InsightDraft>(EMPTY)
  const [tagsInput, setTagsInput] = useState('')
  const [recordId, setRecordId] = useState<string | undefined>(id)
  const [slugTouched, setSlugTouched] = useState(false)
  const [loading, setLoading] = useState(Boolean(id))
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [aiTags, setAiTags] = useState(false)
  const [aiBody, setAiBody] = useState(false)
  const [aiCover, setAiCover] = useState(false)
  const [cards, setCards] = useState<AiCard[]>([])
  const [picked, setPicked] = useState<boolean[]>([])
  const [aiCards, setAiCards] = useState(false)
  const [signalsBusy, setSignalsBusy] = useState(false)
  const [signalsMsg, setSignalsMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    getInsight(id)
      .then((i) => {
        setDraft({
          title: i.title,
          slug: i.slug,
          subtitle: i.subtitle,
          excerpt: i.excerpt,
          content: i.content,
          cover_image_url: i.cover_image_url,
          tags: i.tags,
          status: i.status,
          scheduled_at: i.scheduled_at,
          published_at: i.published_at,
          ai_prompts: i.ai_prompts ?? [],
          ai_cards: i.ai_cards ?? [],
        })
        const existingCards = i.ai_cards ?? []
        setCards(existingCards)
        setPicked(existingCards.map(() => true))
        setTagsInput(i.tags.join(', '))
        setSlugTouched(true)
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [id])

  function set<K extends keyof InsightDraft>(key: K, value: InsightDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  function togglePick(i: number) {
    setPicked((p) => p.map((v, idx) => (idx === i ? !v : v)))
  }

  async function onGenerateCards() {
    if (!draft.title.trim()) {
      setError('Add a title first.')
      return
    }
    setAiCards(true)
    setError(null)
    try {
      const result = await generatePrompts({
        title: draft.title,
        excerpt: draft.excerpt ?? '',
        content: draft.content,
      })
      setCards(result)
      setPicked(result.map(() => false))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setAiCards(false)
    }
  }

  const pickedCount = picked.filter(Boolean).length
  const cardsValid = pickedCount === 0 || pickedCount === 2 || pickedCount === 4

  async function onGenerateSignals() {
    if (!recordId) {
      setError('Save the insight first, then generate signals.')
      return
    }
    setSignalsBusy(true)
    setSignalsMsg(null)
    setError(null)
    try {
      const n = await generateSignalsFromInsight(recordId)
      setSignalsMsg(`Created ${n} signal${n === 1 ? '' : 's'} — find them in the Signal board.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSignalsBusy(false)
    }
  }

  function onTitle(value: string) {
    set('title', value)
    if (!slugTouched) set('slug', slugify(value))
  }

  async function onCover(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const url = await uploadCover(file)
      set('cover_image_url', url)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setUploading(false)
    }
  }

  async function save(publish: boolean) {
    setSaving(true)
    setError(null)
    try {
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
      const selectedCards = cards.filter((_, i) => picked[i])
      if (selectedCards.length !== 0 && selectedCards.length !== 2 && selectedCards.length !== 4) {
        setError('Pick exactly 2 or 4 Ask-AI cards (or none).')
        return
      }
      const payload: InsightDraft = {
        ...draft,
        slug: draft.slug || slugify(draft.title),
        tags,
        ai_cards: selectedCards,
      }
      const saved = recordId ? await updateInsight(recordId, payload) : await createInsight(payload)
      if (publish) await publishInsight(saved.id)
      setRecordId(saved.id)
      // A change to live (published) content should rebuild the public site.
      if (publish || payload.status === 'published') await triggerRebuild()
      nav('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function onSuggestTags() {
    if (!draft.title.trim()) {
      setError('Add a title first, then suggest tags.')
      return
    }
    setAiTags(true)
    setError(null)
    try {
      const tags = await suggestTags(draft.title, draft.excerpt ?? '')
      const existing = tagsInput.split(',').map((t) => t.trim()).filter(Boolean)
      const merged = Array.from(new Set([...existing, ...tags]))
      setTagsInput(merged.join(', '))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setAiTags(false)
    }
  }

  async function onGenerateCover() {
    if (!draft.title.trim()) {
      setError('Add a title first.')
      return
    }
    setAiCover(true)
    setError(null)
    try {
      const url = await generateCover(draft.title, draft.excerpt ?? '')
      if (url) set('cover_image_url', url)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setAiCover(false)
    }
  }

  async function onAiBody() {
    if (!draft.title.trim()) {
      setError('Add a title first.')
      return
    }
    setAiBody(true)
    setError(null)
    try {
      const prompt = draft.content.trim()
        ? `Improve and tighten this Insights post draft. Keep the meaning; sharpen the writing.\n\nTitle: ${draft.title}\n\n${draft.content}`
        : `Write a first draft of an Insights post in Markdown.\n\nTitle: ${draft.title}\nExcerpt: ${draft.excerpt ?? ''}\n\nUse ## section headings and keep it practical.`
      const text = await assistWrite([{ role: 'user', content: prompt }])
      if (text) set('content', text)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setAiBody(false)
    }
  }

  if (loading) return <div className="p-8 text-ink-soft">Loading…</div>

  return (
    <div className="max-w-3xl mx-auto px-8 py-8">
      <button onClick={() => nav('/')} className="text-sm text-teal-ink font-semibold mb-4">
        ← Back
      </button>
      <h1 className="font-head text-2xl font-bold text-navy mb-6">
        {recordId ? 'Edit insight' : 'New insight'}
      </h1>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      <div className="space-y-5 bg-white border border-line rounded-xl p-6">
        <Field label="Title">
          <input value={draft.title} onChange={(e) => onTitle(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Slug">
          <input
            value={draft.slug}
            onChange={(e) => {
              setSlugTouched(true)
              set('slug', e.target.value)
            }}
            className={inputCls}
          />
        </Field>
        <Field label="Excerpt">
          <textarea value={draft.excerpt ?? ''} onChange={(e) => set('excerpt', e.target.value)} rows={2} className={inputCls} />
        </Field>
        <Field label="Tags (comma-separated)">
          <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} className={inputCls} />
          <button type="button" onClick={onSuggestTags} disabled={aiTags} className={aiBtnCls}>
            {aiTags ? 'Suggesting…' : '✦ Suggest tags'}
          </button>
        </Field>
        <Field label="Cover image">
          <div className="flex items-center gap-4">
            {draft.cover_image_url && (
              <img src={draft.cover_image_url} alt="" className="h-16 w-24 object-cover rounded-md border border-line" />
            )}
            <input type="file" accept="image/*" onChange={onCover} className="text-sm" />
            {uploading && <span className="text-xs text-ink-soft">Uploading…</span>}
          </div>
          <button type="button" onClick={onGenerateCover} disabled={aiCover} className={aiBtnCls}>
            {aiCover ? 'Generating…' : '✦ Generate cover'}
          </button>
        </Field>
        <Field label="Body (Markdown)">
          <textarea
            value={draft.content}
            onChange={(e) => set('content', e.target.value)}
            rows={16}
            className={`${inputCls} font-mono text-sm`}
          />
          <button type="button" onClick={onAiBody} disabled={aiBody} className={aiBtnCls}>
            {aiBody ? 'Working…' : draft.content.trim() ? '✦ Improve with AI' : '✦ Draft with AI'}
          </button>
        </Field>
        <Field label="Status">
          <select value={draft.status} onChange={(e) => set('status', e.target.value as InsightStatus)} className={inputCls}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Ask-AI prompt cards (shown on the published page)">
          <p className="text-xs text-ink-soft mb-2">
            Generate cards from this article, then pick <strong>exactly 2 or 4</strong> to show
            (or none). {pickedCount} selected.
          </p>
          <button type="button" onClick={onGenerateCards} disabled={aiCards} className={aiBtnCls}>
            {aiCards ? 'Generating…' : cards.length ? '✦ Regenerate cards' : '✦ Generate cards'}
          </button>
          {cards.length > 0 && (
            <div className="space-y-2 pt-3">
              {cards.map((c, i) => (
                <label
                  key={i}
                  className={`flex gap-2 text-sm rounded-lg border p-3 cursor-pointer ${
                    picked[i] ? 'border-teal bg-teal/5' : 'border-line'
                  }`}
                >
                  <input type="checkbox" className="mt-1" checked={picked[i] ?? false} onChange={() => togglePick(i)} />
                  <span>
                    <span className="block font-semibold text-navy">{c.title}</span>
                    <span className="block text-ink-soft text-xs">{c.description}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
          {!cardsValid && (
            <p className="text-red-600 text-xs mt-2">Select exactly 2 or 4 cards (currently {pickedCount}).</p>
          )}
        </Field>
      </div>

      <div className="flex gap-3 mt-6">
        <button
          disabled={saving || !cardsValid}
          onClick={() => save(false)}
          className="px-5 py-2.5 rounded-lg border border-line font-head font-semibold text-navy disabled:opacity-60"
        >
          Save
        </button>
        <button
          disabled={saving || !cardsValid}
          onClick={() => save(true)}
          className="px-5 py-2.5 rounded-lg bg-teal text-navy font-head font-semibold disabled:opacity-60"
        >
          Save &amp; publish
        </button>
        <button
          type="button"
          disabled={!recordId || signalsBusy}
          onClick={onGenerateSignals}
          title={recordId ? '' : 'Save the insight first'}
          className="px-5 py-2.5 rounded-lg border border-line font-head font-semibold text-teal-ink disabled:opacity-50"
        >
          {signalsBusy ? 'Creating signals…' : '✦ Generate 3 signals'}
        </button>
      </div>
      {signalsMsg && <p className="text-teal-ink text-sm mt-3">{signalsMsg}</p>}
    </div>
  )
}
