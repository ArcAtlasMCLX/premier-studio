// Spotlight renderer — the brand-image "layer cake", drawn on an HTML canvas in the
// author's browser instead of rasterised by resvg inside a Supabase edge function.
//
// Why here: the edge runtime allows 2 s of CPU per request (not raisable) and the
// cut-out render exceeded it on Portrait. The same picture draws in ~1 ms on a
// laptop, and the author gets a live preview with drag-to-reposition for free.
// The shared edge compositor (_shared/compositor.ts) still renders covers and
// Signals; this module mirrors its geometry so all three families look the same.
//
// Layout rules agreed with Zach & Jacob on 20 Oct 2026:
//   - the wheel colour follows where the wheel sits: right = blue, top = orange,
//     left = green, each with the brand gradient inside the segment;
//   - the wheel panel is ~15% slimmer than the first cut;
//   - the eyebrow has a short line either side (a hyphen, not an underscore), in
//     the "opposite" of the wheel colour by default;
//   - the "Premier Compliance" wordmark sits in a pill box so it reads on any
//     background, and can be placed at the top or bottom, left/centre/right.

export type Ratio = '16:9' | '1:1' | '4:5' | '1.91:1'
export type SpotStyle = 'standard' | 'colourings' | 'cutout'
export type Color = 'blue' | 'green' | 'orange'
export type WheelSide = 'right' | 'top' | 'left'
export type MarkPos = 'bottom-right' | 'bottom-centre' | 'bottom-left' | 'top-right' | 'top-centre' | 'top-left'
// Pill treatment for the wordmark: navy pill + white text (the "negative" logo), white
// pill + navy text (the "positive" logo), or no pill at all.
export type MarkStyle = 'navy' | 'white' | 'none'

export const DIMS: Record<Ratio, { w: number; h: number }> = {
  '16:9': { w: 1600, h: 900 },
  '1:1': { w: 1080, h: 1080 },
  '4:5': { w: 1080, h: 1350 },
  '1.91:1': { w: 1200, h: 628 },
}

const NAVY = '#030D3A'

// Wheel segment colours: the flat value colour plus the deeper/lighter end of the
// brand wheel's gradient (Brand Guidelines v1.0 p.7/p.9, yellow replaced per V3.1).
export const COLOR_HEX: Record<Color, string> = { blue: '#248CFF', green: '#03FFA1', orange: '#FF7D00' }
const COLOR_GRADE: Record<Color, [string, string]> = {
  blue: ['#248CFF', '#003CA0'],
  green: ['#03FFA1', '#2EA84F'],
  orange: ['#FF7D00', '#FFB400'],
}

// Where the wheel sits decides its colour (Zach: "if it was across the top it'd be
// orange, where it is now it'd be blue, on the left it'd be the green").
export const SIDE_COLOR: Record<WheelSide, Color> = { right: 'blue', top: 'orange', left: 'green' }
// Default eyebrow-line colour: the "opposite" of the wheel (Jacob, 20 Oct).
export const OPPOSITE: Record<Color, string> = { blue: '#FF7D00', orange: '#248CFF', green: '#FF7D00' }

// Brand palette offered as text-colour swatches (Brand Guidelines p.9 + white).
export const TEXT_SWATCHES: { hex: string; name: string }[] = [
  { hex: '#FFFFFF', name: 'White' },
  { hex: '#030D3A', name: 'PC Dark Blue' },
  { hex: '#00C896', name: 'Teal' },
  { hex: '#248CFF', name: 'PC Light Blue' },
  { hex: '#003CA0', name: 'PC Mid Blue' },
  { hex: '#03FFA1', name: 'PC Dark Green' },
  { hex: '#BFFFE5', name: 'PC Light Green' },
  { hex: '#FF7D00', name: 'PC Orange' },
  { hex: '#FFED1C', name: 'PC Yellow' },
]

export interface TextColors {
  eyebrow: string // hex, or 'auto' = opposite of the wheel colour
  headline: string
  subhead: string
}
export const DEFAULT_TEXT_COLORS: TextColors = { eyebrow: 'auto', headline: '#FFFFFF', subhead: '#03FFA1' }

const STANDARD_WASH = 0.34 // compositor VARIANT.spotlight.wash

// Zoom + pan on top of a cover-fit of the photo. pan is in output-canvas pixels.
export interface View {
  zoom: number
  panX: number
  panY: number
}
export const DEFAULT_VIEW: View = { zoom: 1, panX: 0, panY: 0 }
export const MAX_ZOOM = 2.5

export interface RenderInput {
  base: CanvasImageSource & { width: number; height: number }
  subject?: (CanvasImageSource & { width: number; height: number }) | null
  logo?: (CanvasImageSource & { width: number; height: number }) | null
  ratio: Ratio
  style: SpotStyle
  color: Color
  wheelSide: WheelSide
  markPos: MarkPos
  markStyle: MarkStyle
  eyebrow?: string
  headline?: string
  subhead?: string
  textColors: TextColors
  view: View
}

// The rect the photo (and its aligned cut-out) is drawn into: cover-fit × zoom,
// shifted by the pan, clamped so the canvas edge never shows through.
export function fitRect(iw: number, ih: number, W: number, H: number, view: View) {
  const cover = Math.max(W / iw, H / ih) * view.zoom
  const dw = iw * cover
  const dh = ih * cover
  const dx = Math.min(0, Math.max(W - dw, (W - dw) / 2 + view.panX))
  const dy = Math.min(0, Math.max(H - dh, (H - dh) / 2 + view.panY))
  return { dx, dy, dw, dh, scale: cover }
}

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`
}

function font(weight: number, px: number, italic = false): string {
  return `${italic ? 'italic ' : ''}${weight} ${px}px "Inter Tight", system-ui, sans-serif`
}

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

function setSpacing(g: Ctx, px: number) {
  // letterSpacing landed in Chrome 99 / Safari 17; older browsers just render unspaced.
  if ('letterSpacing' in g) (g as { letterSpacing: string }).letterSpacing = `${px}px`
}

function wrap(g: Ctx, text: string, maxW: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const next = line ? `${line} ${w}` : w
    if (g.measureText(next).width > maxW && line) {
      lines.push(line)
      line = w
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  if (lines.length > maxLines) {
    lines.length = maxLines
    lines[maxLines - 1] = lines[maxLines - 1].replace(/[\s.,;:]+$/, '') + '…'
  }
  return lines
}

// The wheel: a large circle the photo shows through, brand colour outside it. The
// circle is placed off one edge so the colour forms a band on that side. Right/left
// use cx = ∓0.101W (was 0.148 — the 15% slimmer panel Jacob asked for).
function wheelCircle(side: WheelSide, W: number, H: number) {
  if (side === 'right') return { cx: -W * 0.101, cy: H * 0.459, r: W * 0.833 }
  if (side === 'left') return { cx: W * 1.101, cy: H * 0.459, r: W * 0.833 }
  // Top: a wide circle just below the top band, so the colour is ~28% of the height
  // at the centre and curves down a little at the corners.
  const r = W * 1.2
  return { cx: W * 0.5, cy: H * 0.28 + r, r }
}

// Gradient that runs along the band so the segment reads like the brand wheel.
function wheelGradient(g: Ctx, side: WheelSide, color: Color, W: number, H: number) {
  const [a, b] = COLOR_GRADE[color]
  const grad =
    side === 'top' ? g.createLinearGradient(0, 0, W, 0)
    : side === 'right' ? g.createLinearGradient(W, 0, W, H)
    : g.createLinearGradient(0, H, 0, 0)
  grad.addColorStop(0, a)
  grad.addColorStop(1, b)
  return grad
}

export function renderSpotlight(g: Ctx, input: RenderInput): void {
  const { w: W, h: H } = DIMS[input.ratio]
  const wheel = COLOR_HEX[input.color]
  const wheeled = input.style !== 'standard'
  const rect = fitRect(input.base.width, input.base.height, W, H, input.view)

  g.clearRect(0, 0, W, H)
  g.drawImage(input.base, rect.dx, rect.dy, rect.dw, rect.dh)

  if (input.style === 'cutout') {
    // The photo sits INSIDE the wheel: brand colour everywhere except a large
    // circle (even-odd hole), then the full-colour subject on top, popping out of it.
    const { cx, cy, r } = wheelCircle(input.wheelSide, W, H)
    g.beginPath()
    g.rect(0, 0, W, H)
    g.moveTo(cx + r, cy)
    g.arc(cx, cy, r, 0, Math.PI * 2, true)
    g.fillStyle = wheelGradient(g, input.wheelSide, input.color, W, H)
    g.fill('evenodd')
    if (input.subject) g.drawImage(input.subject, rect.dx, rect.dy, rect.dw, rect.dh)
  } else if (input.style === 'colourings') {
    // Whole-image value grade + wheel-arc rings — for scenes rather than people.
    g.fillStyle = hexA(wheel, 0.34)
    g.fillRect(0, 0, W, H)
    const grade = g.createLinearGradient(0, 0, W, H * 0.35)
    grade.addColorStop(0, hexA(wheel, 0.1))
    grade.addColorStop(1, hexA(wheel, 0.62))
    g.fillStyle = grade
    g.fillRect(0, 0, W, H)
    g.fillStyle = hexA(NAVY, 0.1)
    g.fillRect(0, 0, W, H)
    g.lineWidth = Math.round(W * 0.055)
    g.strokeStyle = wheel
    g.beginPath(); g.arc(W, 0, Math.round(W * 0.34), 0, Math.PI * 2); g.stroke()
    g.beginPath(); g.arc(0, H, Math.round(W * 0.3), 0, Math.PI * 2); g.stroke()
  } else {
    g.fillStyle = hexA(NAVY, STANDARD_WASH)
    g.fillRect(0, 0, W, H)
  }

  // Bottom legibility scrim.
  const scrim = g.createLinearGradient(0, 0, 0, H)
  scrim.addColorStop(0, hexA(NAVY, 0))
  scrim.addColorStop(0.5, hexA(NAVY, 0.12))
  scrim.addColorStop(1, hexA(NAVY, 0.9))
  g.fillStyle = scrim
  g.fillRect(0, 0, W, H)

  // Text block: eyebrow ▸ headline ▸ role line, bottom-left, stacked from the bottom up.
  const pad = Math.round(W * 0.055)
  const headSize = Math.round(W * 0.05)
  const lineH = Math.round(headSize * 1.14)
  const eyeSize = Math.round(headSize * 0.32)
  const eyebrow = input.eyebrow?.trim() ?? ''
  const headline = input.headline?.trim() ?? ''
  const subhead = input.subhead?.trim() ?? ''
  const eyebrowColor = input.textColors.eyebrow === 'auto' ? OPPOSITE[input.color] : input.textColors.eyebrow
  g.textBaseline = 'alphabetic'
  g.textAlign = 'left'

  if (headline) {
    g.font = font(800, headSize)
    const lines = wrap(g, headline, W - pad * 2, input.ratio === '4:5' ? 5 : 3)
    let last = H - Math.round(H * 0.07)
    let subBase = 0
    if (subhead) {
      subBase = last
      last = subBase - eyeSize - Math.round(headSize * 0.32)
    }
    const headFirst = last - (lines.length - 1) * lineH
    const eyeBase = headFirst - headSize - Math.round(eyeSize * 0.7)

    if (eyebrow) {
      // "— EYEBROW —": a hyphen-height line either side, in the eyebrow colour.
      g.font = font(800, eyeSize, wheeled)
      setSpacing(g, eyeSize * 0.14)
      const text = eyebrow.toUpperCase()
      const tw = g.measureText(text).width
      const dash = Math.round(W * 0.035)
      const gap = Math.round(eyeSize * 0.6)
      const lineY = eyeBase - Math.round(eyeSize * 0.33)
      const textX = pad + dash + gap
      g.fillStyle = eyebrowColor
      g.beginPath(); g.roundRect(pad, lineY - 2, dash, 4, 2); g.fill()
      g.beginPath(); g.roundRect(textX + tw + gap, lineY - 2, dash, 4, 2); g.fill()
      g.fillText(text, textX, eyeBase)
      setSpacing(g, 0)
    }
    g.font = font(800, headSize)
    g.fillStyle = input.textColors.headline
    lines.forEach((ln, i) => g.fillText(ln, pad, headFirst + i * lineH))
    if (subhead) {
      g.font = font(800, eyeSize)
      g.fillStyle = input.textColors.subhead
      setSpacing(g, eyeSize * 0.1)
      g.fillText(subhead.toUpperCase(), pad, subBase)
      setSpacing(g, 0)
    }
  }

  // Branding mark. Wheeled = the "Premier Compliance" wordmark (the "o" drawn as the
  // brand ring) in a pill, placed per markPos; standard = the wheel logo, same positions.
  if (wheeled) {
    drawWordmarkPill(g, W, H, pad, input.markPos, input.markStyle)
  } else if (input.logo) {
    const logoW = Math.round(W * 0.072)
    const { x, y } = placeMark(W, H, pad, logoW, logoW, input.markPos)
    g.drawImage(input.logo, x, y, logoW, logoW)
  }
}

function placeMark(W: number, H: number, pad: number, w: number, h: number, pos: MarkPos) {
  const [v, hz] = pos.split('-') as ['top' | 'bottom', 'left' | 'centre' | 'right']
  const x = hz === 'left' ? pad : hz === 'right' ? W - pad - w : (W - w) / 2
  const y = v === 'top' ? pad : H - pad - h
  return { x, y }
}

// The brand symbol: a ring in three segments — orange across the top, blue down the
// right, green up the left (Brand Guidelines v1.0 p.7). Used as the "o" in the wordmark.
function drawRing(g: Ctx, cx: number, cy: number, r: number, stroke: number) {
  const seg: [number, number, string][] = [
    [-150, -30, COLOR_HEX.orange],
    [-30, 90, COLOR_HEX.blue],
    [90, 210, COLOR_HEX.green],
  ]
  g.lineWidth = stroke
  g.lineCap = 'butt'
  for (const [a0, a1, col] of seg) {
    g.strokeStyle = col
    g.beginPath()
    g.arc(cx, cy, r, (a0 * Math.PI) / 180, (a1 * Math.PI) / 180)
    g.stroke()
  }
}

function drawWordmarkPill(g: Ctx, W: number, H: number, pad: number, pos: MarkPos, style: MarkStyle) {
  const wm = Math.round(W * 0.026)
  g.font = font(700, wm)
  setSpacing(g, 0.3)
  const a = 'Premier C', o = 'o', c = 'mpliance'
  const wa = g.measureText(a).width, wo = g.measureText(o).width, wc = g.measureText(c).width
  const textW = wa + wo + wc
  const px = Math.round(wm * 0.9), py = Math.round(wm * 0.55)
  const pillW = textW + px * 2, pillH = wm + py * 2
  const { x, y } = placeMark(W, H, pad, pillW, pillH, pos)
  if (style !== 'none') {
    g.fillStyle = style === 'navy' ? hexA(NAVY, 0.84) : 'rgba(255,255,255,0.92)'
    g.beginPath(); g.roundRect(x, y, pillW, pillH, pillH / 2); g.fill()
  }
  const ink = style === 'white' ? NAVY : '#FFFFFF'
  const baseline = y + py + wm * 0.78
  g.textAlign = 'left'
  if (style === 'none') { g.shadowColor = 'rgba(3,13,58,0.6)'; g.shadowBlur = wm * 0.4 }
  g.fillStyle = ink
  g.fillText(a, x + px, baseline)
  g.fillText(c, x + px + wa + wo, baseline)
  g.shadowBlur = 0
  // The "o" is the ring: sized to the letter's x-height, centred on its advance.
  const xh = wm * 0.53
  drawRing(g, x + px + wa + wo / 2, baseline - xh / 2, xh / 2 - wm * 0.045, wm * 0.11)
  setSpacing(g, 0)
}

// ---- helpers for the page ----------------------------------------------------

export async function loadImage(src: Blob | string): Promise<HTMLImageElement> {
  const url = typeof src === 'string' ? src : URL.createObjectURL(src)
  const img = new Image()
  img.src = url
  await img.decode()
  return img
}

// Non-transparent bounding box of the cut-out, as fractions of its size (so it can be
// applied to the base photo even when the two differ in pixel dimensions).
export function alphaBbox(img: HTMLImageElement): { x0: number; y0: number; x1: number; y1: number } | null {
  const step = Math.max(1, Math.floor(Math.max(img.width, img.height) / 400))
  const c = document.createElement('canvas')
  c.width = Math.ceil(img.width / step)
  c.height = Math.ceil(img.height / step)
  const g = c.getContext('2d', { willReadFrequently: true })
  if (!g) return null
  g.drawImage(img, 0, 0, c.width, c.height)
  const d = g.getImageData(0, 0, c.width, c.height).data
  let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0, found = false
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (d[(y * c.width + x) * 4 + 3] > 40) {
        found = true
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  if (!found) return null
  return { x0: x0 / c.width, y0: y0 / c.height, x1: (x1 + 1) / c.width, y1: (y1 + 1) / c.height }
}

// Zoom so the subject fills ~86% of the frame height (and ≤78% of its width), with
// ~6% headroom and the subject biased away from the wheel panel: right of centre when
// the wheel is on the right, left of centre when it's on the left, centred for top.
export function autoFrame(
  bbox: ReturnType<typeof alphaBbox>,
  base: { width: number; height: number },
  ratio: Ratio,
  side: WheelSide = 'right',
): View {
  if (!bbox) return DEFAULT_VIEW
  const { w: W, h: H } = DIMS[ratio]
  const bx0 = bbox.x0 * base.width, bx1 = bbox.x1 * base.width
  const by0 = bbox.y0 * base.height, by1 = bbox.y1 * base.height
  const bw = Math.max(1, bx1 - bx0), bh = Math.max(1, by1 - by0)
  const cover = Math.max(W / base.width, H / base.height)
  const zoom = Math.max(1, Math.min(MAX_ZOOM, Math.min((H * 0.86) / bh, (W * 0.78) / bw) / cover))
  const s = cover * zoom
  const dw = base.width * s, dh = base.height * s
  const bias = side === 'right' ? 0.6 : side === 'left' ? 0.4 : 0.5
  const panX = W * bias - ((bx0 + bx1) / 2) * s - (W - dw) / 2
  const panY = H * 0.06 - by0 * s - (H - dh) / 2
  return { zoom, panX, panY }
}

// Auto colour: the value colour whose hue is furthest from the photo's average hue;
// neutral photos rotate by a size-derived seed (mirrors _shared/wheelcolor.ts).
export function pickColor(img: HTMLImageElement): Color {
  const HUE: Record<Color, number> = { blue: 213, green: 157, orange: 29 }
  const all: Color[] = ['blue', 'green', 'orange']
  const c = document.createElement('canvas')
  c.width = 24; c.height = 24
  const g = c.getContext('2d', { willReadFrequently: true })
  if (!g) return 'blue'
  g.drawImage(img, 0, 0, 24, 24)
  const d = g.getImageData(0, 0, 24, 24).data
  let r = 0, gr = 0, b = 0
  for (let i = 0; i < d.length; i += 4) { r += d[i]; gr += d[i + 1]; b += d[i + 2] }
  const n = d.length / 4
  const rn = r / n / 255, gn = gr / n / 255, bn = b / n / 255
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn), delta = max - min
  const l = (max + min) / 2
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1))
  if (s < 0.12) return all[(img.width * img.height) % all.length]
  let h = max === rn ? ((gn - bn) / delta) % 6 : max === gn ? (bn - rn) / delta + 2 : (rn - gn) / delta + 4
  h *= 60
  if (h < 0) h += 360
  const dist = (a: number, c2: number) => { const dd = Math.abs(a - c2) % 360; return dd > 180 ? 360 - dd : dd }
  return [...all].sort((a, c2) => dist(HUE[c2], h) - dist(HUE[a], h))[0]
}

// Full-resolution PNG of the current composition (what gets saved to the bank).
export async function exportPng(input: RenderInput): Promise<Blob> {
  const { w, h } = DIMS[input.ratio]
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const g = c.getContext('2d')
  if (!g) throw new Error('Canvas unavailable in this browser')
  renderSpotlight(g, input)
  return new Promise((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode the image'))), 'image/png'),
  )
}

// Make sure the brand faces are in before the first draw, so text doesn't render in a fallback.
export async function ensureFonts(): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load(font(800, 40)),
      document.fonts.load(font(800, 40, true)),
      document.fonts.load(font(700, 40)),
    ])
  } catch {
    // Font API unavailable — the system fallback is fine.
  }
}
