import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  cutoutSubject,
  downloadSource,
  listImages,
  saveSpotlightToBank,
  signedThumb,
  uploadSpotlight,
  type ImageBankItem,
  type SpotlightResult,
} from '../lib/imageBank'
import {
  alphaBbox,
  autoFrame,
  COLOR_HEX,
  DEFAULT_VIEW,
  DIMS,
  ensureFonts,
  exportPng,
  loadImage,
  MAX_ZOOM,
  pickColor,
  renderSpotlight,
  type Color,
  type Ratio,
  type SpotStyle,
  type View,
} from '../lib/spotlightCanvas'

type ColorChoice = 'auto' | Color

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
const COLORS: { value: ColorChoice; label: string }[] = [
  { value: 'auto', label: 'Auto · best fit for the photo' },
  { value: 'blue', label: 'Blue (Dependable)' },
  { value: 'green', label: 'Green (Expert)' },
  { value: 'orange', label: 'Orange (Dynamic)' },
]
const HEADLINE_MAX = 80
const inputCls =
  'w-full px-3 py-2 rounded-lg border border-line focus:outline-none focus:ring-2 focus:ring-teal/40'

// Spotlight — the brand-image workshop. Tier 2 of the two-tier model: the Image Bank
// holds the raw upload; here it's framed, brand-treated and exported. The picture is
// composed live on a canvas in the browser (lib/spotlightCanvas.ts) — the only server
// step is the Cut-out's background removal. Landed on via the nav ("choose a source")
// or from an Image Bank card ("Open in Spotlight").
export function Spotlight() {
  const { imageId } = useParams()
  const navigate = useNavigate()

  const [items, setItems] = useState<ImageBankItem[]>([])
  const [thumbs, setThumbs] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [ratio, setRatio] = useState<Ratio>('1.91:1')
  const [style, setStyle] = useState<SpotStyle>('standard')
  const [color, setColor] = useState<ColorChoice>('auto')
  const [eyebrow, setEyebrow] = useState('')
  const [headline, setHeadline] = useState('')
  const [subhead, setSubhead] = useState('')
  const [view, setView] = useState<View>(DEFAULT_VIEW)

  const [base, setBase] = useState<HTMLImageElement | null>(null)
  const [autoColor, setAutoColor] = useState<Color>('blue')
  const [subject, setSubject] = useState<HTMLImageElement | null>(null)
  const [bbox, setBbox] = useState<ReturnType<typeof alphaBbox>>(null)
  const [logo, setLogo] = useState<HTMLImageElement | null>(null)
  const [fontsReady, setFontsReady] = useState(false)

  const [cutting, setCutting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<SpotlightResult | null>(null)
  const [copied, setCopied] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)

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
    ensureFonts().then(() => setFontsReady(true))
    loadImage('/logo-wheel.webp').then(setLogo).catch(() => null)
  }, [])

  // Only raw uploads are valid sources (not finished spotlights).
  const sources = useMemo(() => items.filter((i) => !i.public_url), [items])
  const active = useMemo(() => items.find((i) => i.id === imageId) ?? null, [items, imageId])

  // Load the source photo as bytes (keeps the canvas exportable). Switching source
  // drops the cut-out and the saved result but keeps the text controls (often reused).
  // Keyed on the image's id/path, NOT the row object: refreshing the bank list after a
  // save produces a new object for the same image, and that must not reset the workshop.
  const activeId = active?.id ?? null
  const activePath = active?.storage_path ?? null
  useEffect(() => {
    setBase(null)
    setSubject(null)
    setBbox(null)
    setSaved(null)
    setError(null)
    setView(DEFAULT_VIEW)
    if (!activePath) return
    let cancelled = false
    downloadSource(activePath)
      .then(loadImage)
      .then((img) => {
        if (cancelled) return
        setBase(img)
        setAutoColor(pickColor(img))
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : String(err)))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, activePath])

  const resolvedColor: Color = color === 'auto' ? autoColor : color

  // Any change to the composition invalidates a previous save.
  useEffect(() => {
    setSaved(null)
  }, [ratio, style, resolvedColor, eyebrow, headline, subhead, view, subject])

  // Re-frame when the ratio changes: zoom on the subject for Cut-out, else plain cover.
  useEffect(() => {
    setView(style === 'cutout' && bbox && base ? autoFrame(bbox, base, ratio) : DEFAULT_VIEW)
  }, [ratio, style, bbox, base])

  const draw = useCallback(() => {
    const c = canvasRef.current
    if (!c || !base) return
    const { w, h } = DIMS[ratio]
    if (c.width !== w || c.height !== h) {
      c.width = w
      c.height = h
    }
    const g = c.getContext('2d')
    if (!g) return
    renderSpotlight(g, {
      base, subject: style === 'cutout' ? subject : null, logo,
      ratio, style, color: resolvedColor, eyebrow, headline, subhead, view,
    })
  }, [base, subject, logo, ratio, style, resolvedColor, eyebrow, headline, subhead, view, fontsReady])

  useEffect(() => {
    const id = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(id)
  }, [draw])

  // Drag the photo to reposition it inside the frame.
  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    dragRef.current = { x: e.clientX, y: e.clientY, panX: view.panX, panY: view.panY }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const d = dragRef.current
    if (!d) return
    const k = e.currentTarget.width / e.currentTarget.getBoundingClientRect().width
    setView((v) => ({ ...v, panX: d.panX + (e.clientX - d.x) * k, panY: d.panY + (e.clientY - d.y) * k }))
  }
  function onPointerUp() {
    dragRef.current = null
  }

  async function onCutout() {
    if (!active || !base) return
    setCutting(true)
    setError(null)
    try {
      const img = await loadImage(await cutoutSubject(active.id))
      const bb = alphaBbox(img)
      setSubject(img)
      setBbox(bb)
      setView(autoFrame(bb, base, ratio))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setCutting(false)
    }
  }

  function currentInput() {
    if (!base) throw new Error('Photo still loading')
    return {
      base, subject: style === 'cutout' ? subject : null, logo,
      ratio, style, color: resolvedColor, eyebrow, headline, subhead, view,
    }
  }

  async function onSave() {
    if (!active || !base) return
    setSaving(true)
    setError(null)
    try {
      const png = await exportPng(currentInput())
      const result = await uploadSpotlight(png)
      await saveSpotlightToBank(result, headline.trim() || active.title || 'Spotlight')
      setSaved(result)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function onDownload() {
    if (!base) return
    try {
      const png = await exportPng(currentInput())
      const a = document.createElement('a')
      a.href = URL.createObjectURL(png)
      a.download = `spotlight-${ratio.replace(':', 'x')}.png`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const needsCutout = style === 'cutout' && !subject
  const { w: outW, h: outH } = DIMS[ratio]

  return (
    <div className="max-w-6xl mx-auto px-8 py-8">
      <div className="flex items-start justify-between gap-4 mb-2">
        <h1 className="font-head text-2xl font-bold text-navy">Spotlight</h1>
        {active && (
          <Link to="/spotlight" className="text-sm font-semibold text-teal-ink">↩ Change image</Link>
        )}
      </div>
      <p className="text-ink-soft text-sm mb-6">
        Frame a photo to a ratio and apply the Premier brand treatment. Pick a source image from your{' '}
        <Link to="/images" className="text-teal-ink font-semibold">Image Bank</Link>, choose a style,
        drag the picture to position it, then <strong>Save to bank</strong> to keep the finished image.
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
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
          <div className="space-y-3">
            <div className="bg-white border border-line rounded-xl p-4 flex flex-col items-center gap-2">
              {base ? (
                <canvas
                  ref={canvasRef}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  className="max-w-full max-h-[70vh] rounded-lg shadow-md cursor-grab active:cursor-grabbing touch-none"
                  aria-label="Spotlight preview — drag to reposition the photo"
                />
              ) : (
                <div className="aspect-square w-full max-w-sm bg-surface rounded-lg flex items-center justify-center text-ink-soft text-sm">
                  Loading photo…
                </div>
              )}
              <p className="text-xs text-ink-soft">
                {outW}×{outH} · drag to reposition
                {style !== 'standard' && <span> · wheel colour <span className="font-semibold capitalize">{resolvedColor}</span></span>}
                {style === 'cutout' && subject && <span> · subject cut out ✓</span>}
              </p>
            </div>

            {needsCutout && (
              <div className="rounded-lg border border-line bg-white px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm text-ink-soft">Cut-out removes the background behind the person. It takes a few seconds.</span>
                <button
                  onClick={onCutout}
                  disabled={cutting || !base}
                  className="px-4 py-2 rounded-lg bg-navy text-white font-head font-semibold text-sm disabled:opacity-60"
                >
                  {cutting ? 'Cutting out…' : '✂ Cut out subject'}
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={onSave}
                disabled={saving || !base || needsCutout || Boolean(saved)}
                className="px-4 py-2 rounded-lg bg-teal text-navy font-head font-semibold text-sm disabled:opacity-60"
              >
                {saved ? 'Saved ✓' : saving ? 'Saving…' : '＋ Save to bank'}
              </button>
              <button onClick={onDownload} disabled={!base || needsCutout} className="text-sm font-semibold text-teal-ink disabled:opacity-60">
                Download
              </button>
              {saved && (
                <>
                  <Link to="/images" className="text-sm font-semibold text-teal-ink">View in Image Bank ↗</Link>
                  <button
                    onClick={() => { navigator.clipboard.writeText(saved.url); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
                    className="text-sm font-semibold text-teal-ink"
                  >
                    {copied ? 'Copied ✓' : 'Copy URL'}
                  </button>
                  <a href={saved.url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-teal-ink">Open ↗</a>
                </>
              )}
            </div>
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
                <div className="flex items-center gap-2">
                  <select value={color} onChange={(e) => setColor(e.target.value as ColorChoice)} className={inputCls}>
                    {COLORS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                  <span className="w-8 h-8 rounded-full border border-line shrink-0" style={{ background: COLOR_HEX[resolvedColor] }} aria-hidden="true" />
                </div>
                {style === 'cutout' && (
                  <span className="block text-[11px] text-ink-soft mt-1">Best for people shots — the person stays full colour over the brand panel.</span>
                )}
              </label>
            )}
            <label className="block">
              <span className="block text-xs font-semibold text-navy mb-1">Zoom</span>
              <input
                type="range" min={1} max={MAX_ZOOM} step={0.01} value={view.zoom}
                onChange={(e) => setView((v) => ({ ...v, zoom: Number(e.target.value) }))}
                className="w-full"
              />
              {style === 'cutout' && subject && (
                <button onClick={() => setView(autoFrame(bbox, base!, ratio))} className="text-xs font-semibold text-teal-ink mt-1">
                  Auto-frame the subject
                </button>
              )}
            </label>
            <label className="block">
              <span className="block text-xs font-semibold text-navy mb-1">
                Eyebrow <span className="text-ink-soft font-normal">(optional)</span>
              </span>
              <input value={eyebrow} onChange={(e) => setEyebrow(e.target.value.slice(0, 32))} placeholder="e.g. New starter" className={inputCls} />
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
      )}
    </div>
  )
}
