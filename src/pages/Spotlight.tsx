import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  listImages,
  signedThumb,
  spotlight,
  saveSpotlightToBank,
  type ImageBankItem,
  type Ratio,
  type SpotlightResult,
  type SpotStyle,
  type WheelColor,
} from '../lib/imageBank'

const RATIOS: { value: Ratio; label: string }[] = [
  { value: '1.91:1', label: 'Wide · 1.91:1 (LinkedIn / OG)' },
  { value: '16:9', label: 'Landscape · 16:9 (cover)' },
  { value: '1:1', label: 'Square · 1:1 (social)' },
  { value: '4:5', label: 'Portrait · 4:5 (feed)' },
]
const STYLES: { value: SpotStyle; label: string }[] = [
  { value: 'standard', label: 'Standard · navy/teal + wheel logo' },
  { value: 'colourings', label: 'Colourings · colour grade + wheel arcs' },
  { value: 'cutout', label: 'Cut-out · subject kept, background graded' },
]
const COLORS: { value: WheelColor; label: string }[] = [
  { value: 'auto', label: 'Auto · best fit for the photo' },
  { value: 'blue', label: 'Blue (Dependable)' },
  { value: 'green', label: 'Green (Expert)' },
  { value: 'orange', label: 'Orange (Dynamic)' },
  { value: 'yellow', label: 'Yellow (Proud)' },
]
const HEADLINE_MAX = 80
const inputCls =
  'w-full px-3 py-2 rounded-lg border border-line focus:outline-none focus:ring-2 focus:ring-teal/40'

// Spotlight — the brand-image workshop. Tier 2 of the two-tier model: the Image Bank
// holds the raw upload; here it's cropped, brand-treated and downscaled to a sane size
// (the downscale itself happens server-side in process-image). Landed on directly via
// the nav ("choose a source") or from an Image Bank card ("Open in Spotlight").
export function Spotlight() {
  const { imageId } = useParams()
  const navigate = useNavigate()

  const [items, setItems] = useState<ImageBankItem[]>([])
  const [thumbs, setThumbs] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  const [ratio, setRatio] = useState<Ratio>('1.91:1')
  const [style, setStyle] = useState<SpotStyle>('standard')
  const [color, setColor] = useState<WheelColor>('auto')
  const [eyebrow, setEyebrow] = useState('')
  const [headline, setHeadline] = useState('')
  const [subhead, setSubhead] = useState('')
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [result, setResult] = useState<SpotlightResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function refresh() {
    setLoading(true)
    try {
      const rows = await listImages()
      setItems(rows)
      const entries = await Promise.all(
        rows.map(async (r) =>
          [r.id, r.public_url ?? (await signedThumb(r.storage_path)) ?? ''] as const,
        ),
      )
      setThumbs(Object.fromEntries(entries))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  // Only raw uploads are valid sources (not finished spotlights).
  const sources = useMemo(() => items.filter((i) => !i.public_url), [items])
  const active = useMemo(() => items.find((i) => i.id === imageId) ?? null, [items, imageId])

  // Switching source image resets the render but keeps the text controls (often reused).
  useEffect(() => {
    setResult(null)
    setError(null)
    setSaved(false)
  }, [imageId])

  async function onGenerate() {
    if (!active) return
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      const res = await spotlight({
        imageId: active.id,
        ratio,
        style,
        color,
        eyebrow: eyebrow.trim() || undefined,
        headline: headline.trim() || undefined,
        subhead: subhead.trim() || undefined,
      })
      setResult(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function onSave() {
    if (!result || !active) return
    setSaving(true)
    setError(null)
    try {
      await saveSpotlightToBank(result, headline.trim() || active.title || 'Spotlight')
      setSaved(true)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function onDownload() {
    if (!result) return
    try {
      const r = await fetch(result.url)
      const blob = await r.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'spotlight.png'
      a.click()
      URL.revokeObjectURL(a.href)
    } catch {
      window.open(result.url, '_blank')
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-8 py-8">
      <div className="flex items-start justify-between gap-4 mb-2">
        <h1 className="font-head text-2xl font-bold text-navy">Spotlight</h1>
        {active && (
          <Link to="/spotlight" className="text-sm font-semibold text-teal-ink">↩ Change image</Link>
        )}
      </div>
      <p className="text-ink-soft text-sm mb-6">
        Crop a photo to a ratio and apply the Premier brand treatment. Pick a source image from your{' '}
        <Link to="/images" className="text-teal-ink font-semibold">Image Bank</Link>, choose a style,
        then <strong>Generate</strong> — and <strong>Save to bank</strong> to keep the finished image.
      </p>

      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {error}
        </p>
      )}

      {!active ? (
        // ---- Source picker ---------------------------------------------------
        loading ? (
          <p className="text-ink-soft text-sm">Loading…</p>
        ) : sources.length === 0 ? (
          <div className="bg-white border border-line rounded-xl p-10 text-center text-ink-soft">
            No source images yet — <Link to="/images" className="text-teal-ink font-semibold">upload some in the Image Bank</Link> first.
          </div>
        ) : (
          <div>
            <h2 className="font-head text-sm font-bold uppercase tracking-wide text-ink-soft mb-3">Choose a source image</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {sources.map((item) => (
                <button
                  key={item.id}
                  onClick={() => navigate(`/spotlight/${item.id}`)}
                  className="group bg-white border border-line rounded-xl overflow-hidden text-left hover:border-teal focus:outline-none focus:ring-2 focus:ring-teal/40"
                >
                  <div className="aspect-square bg-surface">
                    {thumbs[item.id] ? (
                      <img src={thumbs[item.id]} alt={item.alt_text ?? item.title ?? ''} className="w-full h-full object-cover" />
                    ) : null}
                  </div>
                  <div className="p-3">
                    <div className="text-xs font-medium text-navy truncate" title={item.title ?? ''}>{item.title ?? 'Untitled'}</div>
                    <div className="text-xs font-semibold text-teal-ink mt-1 opacity-0 group-hover:opacity-100">✦ Spotlight this</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )
      ) : (
        // ---- Workshop --------------------------------------------------------
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
          <div className="space-y-4">
            <div className="aspect-square bg-surface rounded-lg overflow-hidden border border-line">
              {thumbs[active.id] ? <img src={thumbs[active.id]} alt="" className="w-full h-full object-cover" /> : null}
            </div>
            {result && (
              <div>
                <img src={result.url} alt="Spotlight result" className="w-full rounded-lg border border-line" />
                {result.color && (
                  <p className="text-xs text-ink-soft mt-2">
                    Wheel colour: <span className="font-semibold capitalize">{result.color}</span>
                    {style === 'cutout' && (result.cutout
                      ? <span> · subject cut out ✓</span>
                      : <span className="text-orange"> · cut-out unavailable (used flat grade)</span>)}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-4 mt-3">
                  <button
                    onClick={onSave}
                    disabled={saving || saved}
                    className="px-4 py-2 rounded-lg bg-teal text-navy font-head font-semibold text-sm disabled:opacity-60"
                  >
                    {saved ? 'Saved ✓' : saving ? 'Saving…' : '＋ Save to bank'}
                  </button>
                  {saved && <Link to="/images" className="text-sm font-semibold text-teal-ink">View in Image Bank ↗</Link>}
                  <button onClick={onDownload} className="text-sm font-semibold text-teal-ink">Download</button>
                  <button
                    onClick={() => { navigator.clipboard.writeText(result.url); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
                    className="text-sm font-semibold text-teal-ink"
                  >
                    {copied ? 'Copied ✓' : 'Copy URL'}
                  </button>
                  <a href={result.url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-teal-ink">Open ↗</a>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <label className="block">
              <span className="block text-xs font-semibold text-navy mb-1">Ratio</span>
              <select value={ratio} onChange={(e) => setRatio(e.target.value as Ratio)} className={inputCls}>
                {RATIOS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="block text-xs font-semibold text-navy mb-1">Style</span>
              <select value={style} onChange={(e) => setStyle(e.target.value as SpotStyle)} className={inputCls}>
                {STYLES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
            {style !== 'standard' && (
              <label className="block">
                <span className="block text-xs font-semibold text-navy mb-1">Wheel colour</span>
                <select value={color} onChange={(e) => setColor(e.target.value as WheelColor)} className={inputCls}>
                  {COLORS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                {style === 'cutout' && (
                  <span className="block text-[11px] text-ink-soft mt-1">Cut-out removes the background behind the subject — best for people shots.</span>
                )}
              </label>
            )}
            <label className="block">
              <span className="block text-xs font-semibold text-navy mb-1">
                Eyebrow <span className="text-ink-soft font-normal">(optional)</span>
              </span>
              <input value={eyebrow} onChange={(e) => setEyebrow(e.target.value.slice(0, 32))} placeholder="e.g. Fire Doors" className={inputCls} />
            </label>
            <label className="block">
              <span className="block text-xs font-semibold text-navy mb-1">
                Headline <span className="text-ink-soft font-normal">({headline.length}/{HEADLINE_MAX})</span>
              </span>
              <textarea
                value={headline}
                onChange={(e) => setHeadline(e.target.value.slice(0, HEADLINE_MAX))}
                rows={3}
                placeholder="Optional text overlay"
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="block text-xs font-semibold text-navy mb-1">
                Role / subtitle <span className="text-ink-soft font-normal">(optional — shows in green under the headline)</span>
              </span>
              <input value={subhead} onChange={(e) => setSubhead(e.target.value.slice(0, 40))} placeholder="e.g. Fire Damper Operative" className={inputCls} />
            </label>

            <button
              onClick={onGenerate}
              disabled={busy}
              className="w-full mt-1 px-5 py-2.5 rounded-lg bg-teal text-navy font-head font-semibold disabled:opacity-60"
            >
              {busy ? 'Polishing…' : result ? '↻ Regenerate' : '✦ Generate'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
