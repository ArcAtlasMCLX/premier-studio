import { useEffect, useRef, useState } from 'react'
import {
  listImages,
  uploadImage,
  signedThumb,
  deleteImage,
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

export function ImageBank() {
  const [items, setItems] = useState<ImageBankItem[]>([])
  const [thumbs, setThumbs] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [active, setActive] = useState<ImageBankItem | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function refresh() {
    setLoading(true)
    try {
      const rows = await listImages()
      setItems(rows)
      const entries = await Promise.all(
        rows.map(async (r) =>
          // Spotlight outputs are public; uploaded sources need a signed URL.
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

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return
    setBusy(true)
    setError(null)
    try {
      for (const file of Array.from(files)) {
        await uploadImage(file)
      }
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function onDelete(item: ImageBankItem) {
    if (!confirm('Remove this image from the bank?')) return
    try {
      await deleteImage(item)
      setItems((xs) => xs.filter((x) => x.id !== item.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const uploads = items.filter((i) => !i.public_url)
  const spotlights = items.filter((i) => i.public_url)

  return (
    <div className="max-w-5xl mx-auto px-8 py-8">
      <div className="flex items-start justify-between gap-4 mb-2">
        <h1 className="font-head text-2xl font-bold text-navy">Image Bank</h1>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg"
            multiple
            onChange={onUpload}
            className="hidden"
            id="imgupload"
          />
          <label
            htmlFor="imgupload"
            className={`inline-block px-5 py-2.5 rounded-lg bg-teal text-navy font-head font-semibold cursor-pointer ${
              busy ? 'opacity-60 pointer-events-none' : ''
            }`}
          >
            {busy ? 'Uploading…' : '＋ Upload images'}
          </label>
        </div>
      </div>
      <p className="text-ink-soft text-sm mb-6">
        Upload reusable photos (PNG or JPEG — you can select several at once).{' '}
        <strong>Spotlight</strong> any image to crop it to a ratio and apply the Premier brand
        treatment, then <strong>Save to bank</strong> to keep the finished image here for reuse.
      </p>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      {loading ? (
        <p className="text-ink-soft text-sm">Loading…</p>
      ) : items.length === 0 ? (
        <div className="bg-white border border-line rounded-xl p-10 text-center text-ink-soft">
          No images yet — upload one to get started.
        </div>
      ) : (
        <div className="space-y-10">
          <section>
            <h2 className="font-head text-sm font-bold uppercase tracking-wide text-ink-soft mb-3">Your images</h2>
            {uploads.length === 0 ? (
              <p className="text-ink-soft text-sm">No source images yet — upload some to spotlight.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {uploads.map((item) => (
                  <BankCard key={item.id} item={item} thumb={thumbs[item.id]} onSpotlight={() => setActive(item)} onDelete={() => onDelete(item)} />
                ))}
              </div>
            )}
          </section>
          <section>
            <h2 className="font-head text-sm font-bold uppercase tracking-wide text-ink-soft mb-3">Spotlights</h2>
            {spotlights.length === 0 ? (
              <p className="text-ink-soft text-sm">No saved spotlights yet — spotlight an image, then “Save to bank”.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {spotlights.map((item) => (
                  <BankCard key={item.id} item={item} thumb={thumbs[item.id]} onSpotlight={() => setActive(item)} onDelete={() => onDelete(item)} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {active && (
        <SpotlightModal
          item={active}
          thumb={thumbs[active.id]}
          onClose={() => setActive(null)}
          onSaved={async () => {
            setActive(null)
            await refresh()
          }}
        />
      )}
    </div>
  )
}

function BankCard({
  item,
  thumb,
  onSpotlight,
  onDelete,
}: {
  item: ImageBankItem
  thumb?: string
  onSpotlight: () => void
  onDelete: () => void
}) {
  return (
    <div className="bg-white border border-line rounded-xl overflow-hidden">
      <div className="aspect-square bg-surface">
        {thumb ? <img src={thumb} alt={item.alt_text ?? item.title ?? ''} className="w-full h-full object-cover" /> : null}
      </div>
      <div className="p-3">
        <div className="text-xs font-medium text-navy truncate" title={item.title ?? ''}>
          {item.title ?? 'Untitled'}
        </div>
        <div className="flex items-center gap-3 mt-2">
          {item.public_url ? (
            <a href={item.public_url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-teal-ink">
              Open ↗
            </a>
          ) : (
            <button onClick={onSpotlight} className="text-xs font-semibold text-teal-ink">✦ Spotlight</button>
          )}
          <button onClick={onDelete} className="text-xs text-ink-soft hover:text-red-600">Delete</button>
        </div>
      </div>
    </div>
  )
}

function SpotlightModal({
  item,
  thumb,
  onClose,
  onSaved,
}: {
  item: ImageBankItem
  thumb?: string
  onClose: () => void
  onSaved: () => void
}) {
  const [ratio, setRatio] = useState<Ratio>('1.91:1')
  const [style, setStyle] = useState<SpotStyle>('standard')
  const [color, setColor] = useState<WheelColor>('auto')
  const [eyebrow, setEyebrow] = useState('')
  const [headline, setHeadline] = useState('')
  const [subhead, setSubhead] = useState('')
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<SpotlightResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function onGenerate() {
    setBusy(true)
    setError(null)
    try {
      const res = await spotlight({
        imageId: item.id,
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
    if (!result) return
    setSaving(true)
    setError(null)
    try {
      await saveSpotlightToBank(result, headline.trim() || item.title || 'Spotlight')
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
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
    <div className="fixed inset-0 bg-navy/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-head text-lg font-bold text-navy mb-4">Spotlight image</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 items-start">
          <div className="aspect-square bg-surface rounded-lg overflow-hidden">
            {thumb ? <img src={thumb} alt="" className="w-full h-full object-cover" /> : null}
          </div>
          <div className="space-y-3">
            <label className="block">
              <span className="block text-xs font-semibold text-navy mb-1">Ratio</span>
              <select value={ratio} onChange={(e) => setRatio(e.target.value as Ratio)} className={inputCls}>
                {RATIOS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-xs font-semibold text-navy mb-1">Style</span>
              <select value={style} onChange={(e) => setStyle(e.target.value as SpotStyle)} className={inputCls}>
                {STYLES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </label>
            {style !== 'standard' && (
              <label className="block">
                <span className="block text-xs font-semibold text-navy mb-1">Wheel colour</span>
                <select value={color} onChange={(e) => setColor(e.target.value as WheelColor)} className={inputCls}>
                  {COLORS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
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
          </div>
        </div>

        {error && <p className="text-red-600 text-sm mt-4">{error}</p>}

        {result && (
          <div className="mt-5">
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
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-teal text-navy font-head font-semibold text-sm disabled:opacity-60"
              >
                {saving ? 'Saving…' : '＋ Save to bank'}
              </button>
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

        <div className="flex items-center justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-ink-soft">Close</button>
          <button
            onClick={onGenerate}
            disabled={busy}
            className="px-5 py-2.5 rounded-lg border border-line font-head font-semibold text-navy disabled:opacity-60"
          >
            {busy ? 'Polishing…' : result ? 'Regenerate' : '✦ Generate'}
          </button>
        </div>
      </div>
    </div>
  )
}
