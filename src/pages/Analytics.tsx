import { useEffect, useState } from 'react'
import { fetchAnalytics, RANGES, type AnalyticsData, type Range } from '../lib/analytics'
import { fetchSearch, fetchSnapshots, type SearchData, type SeoSnapshot } from '../lib/searchConsole'
import {
  fetchSearchVisibility, readingMetrics, parseGscCsv, windowDaysInclusive, ingestReading,
  type SearchVisibility, type GscRow, type Reading,
} from '../lib/searchVisibility'

export function Analytics() {
  const [range, setRange] = useState<Range>('30d')
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [search, setSearch] = useState<SearchData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [snaps, setSnaps] = useState<SeoSnapshot[]>([])
  const [sv, setSv] = useState<SearchVisibility | null>(null)
  const [svError, setSvError] = useState<string | null>(null)
  const [svLoaded, setSvLoaded] = useState(false)
  const [reload, setReload] = useState(0)
  const retry = () => setReload((n) => n + 1)

  useEffect(() => {
    let live = true
    setLoading(true); setError(null); setSearchError(null); setSvError(null)
    // Search-visibility baseline (own tables, RLS-gated client read) — independent of range.
    fetchSearchVisibility()
      .then((d) => { if (live) setSv(d) })
      .catch((e) => { if (live) setSvError(e instanceof Error ? e.message : String(e)) })
      .finally(() => { if (live) setSvLoaded(true) })
    // Two independent sources — one failing must not blank the other. Each is
    // bounded by a timeout so a slow/hung function surfaces a retry, not an
    // endless spinner.
    withTimeout(fetchAnalytics(range))
      .then((d) => { if (live) setData(d) })
      .catch((e) => { if (live) setError(e instanceof Error ? e.message : String(e)) })
      .finally(() => { if (live) setLoading(false) })
    // Search resolves first, then re-read snapshots so a just-written 30-day row shows.
    withTimeout(fetchSearch(range))
      .then((d) => { if (live) setSearch(d) })
      .catch((e) => { if (live) setSearchError(e instanceof Error ? e.message : String(e)) })
      .finally(() => { fetchSnapshots().then((s) => { if (live) setSnaps(s) }).catch(() => {}) })
    return () => { live = false }
  }, [range, reload])

  const empty = data && data.totals.visitors === 0 && data.totals.pageViews === 0 && data.topPages.length === 0
  const searchEmpty = search && search.totals.clicks === 0 && search.totals.impressions === 0

  return (
    <div className="max-w-5xl mx-auto px-8 py-8">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
        <h1 className="font-head text-2xl font-bold text-navy">Analytics</h1>
        <div className="flex gap-1 bg-white border border-line rounded-lg p-1">
          {RANGES.map((r) => (
            <button key={r.value} onClick={() => setRange(r.value)}
              className={`px-3 py-1.5 rounded-md text-sm font-semibold ${range === r.value ? 'bg-navy text-white' : 'text-ink-soft hover:text-navy'}`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* ---------- TRAFFIC (Vercel) ---------- */}
      <h2 className="font-head text-sm font-bold uppercase tracking-wide text-ink-soft mt-5 mb-1">Traffic · Vercel</h2>
      <p className="text-ink-soft text-sm mb-5">Visits to the public website · refreshed every ~15 minutes.</p>

      {error === 'unavailable' && <Notice onRetry={retry}>Traffic data is unavailable right now — please retry shortly.</Notice>}
      {error && error !== 'unavailable' && <Notice tone="error" onRetry={retry}>Couldn’t load traffic: {error}</Notice>}

      {loading && !data && !error ? (
        <Spinner label="Loading traffic…" />
      ) : data && !error ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <Stat label="Visitors" value={data.totals.visitors} />
            <Stat label="Page views" value={data.totals.pageViews} />
            <Stat label="Views / visitor" value={data.totals.visitors ? data.totals.pageViews / data.totals.visitors : 0} decimals={1} />
            <Stat label="Tracked days" value={data.timeseries.filter((d) => d.date).length} />
          </div>
          {empty ? (
            <EmptyCard>No traffic for this period yet — analytics was recently switched on. Numbers build up here as the site gets visitors.</EmptyCard>
          ) : (
            <div className="space-y-5">
              <Card title="Visitors & page views over time"><Chart series={data.timeseries} /></Card>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Card title="Top pages"><Table rows={data.topPages.map((p) => [p.path, p.pageViews, p.visitors])} cols={['Page', 'Views', 'Visitors']} /></Card>
                <Card title="Top referrers"><Table rows={data.topReferrers.map((r) => [r.source, r.visitors])} cols={['Source', 'Visitors']} /></Card>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <Card title="Countries"><Bars rows={data.topCountries.map((c) => ({ label: c.country, value: c.visitors }))} /></Card>
                <Card title="Devices"><Bars rows={data.devices.map((d) => ({ label: cap(d.type), value: d.visitors }))} /></Card>
                <Card title="Browsers"><Bars rows={data.browsers.map((b) => ({ label: b.name, value: b.visitors }))} /></Card>
              </div>
              <Card title={`History — by ${data.granularity === 'week' ? 'week' : 'day'}`}>
                <div className="max-h-72 overflow-y-auto">
                  <Table rows={[...data.timeseries].filter((d) => d.date).reverse().map((d) => [d.date, d.pageViews, d.visitors])} cols={['Date', 'Views', 'Visitors']} />
                </div>
              </Card>
            </div>
          )}
        </>
      ) : null}

      {/* ---------- SEARCH (Google Search Console) ---------- */}
      <h2 className="font-head text-sm font-bold uppercase tracking-wide text-ink-soft mt-9 mb-1 border-t border-line pt-7">Search · Google</h2>
      <p className="text-ink-soft text-sm mb-5">How people find you on Google · Search Console data lags ~2–3 days.</p>

      {searchError && <Notice tone="error" onRetry={retry}>Couldn’t load search data: {searchError}</Notice>}

      {!search && !searchError ? (
        <Spinner label="Loading search data…" />
      ) : search && !searchError ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
            <Stat label="Clicks" value={search.totals.clicks} />
            <Stat label="Impressions" value={search.totals.impressions} />
            <Stat label="CTR" value={search.totals.ctr * 100} decimals={1} suffix="%" />
            <Stat label="Avg position" value={search.totals.position} decimals={1} />
            <Stat label="Pages in search" value={search.pagesCount ?? 0} />
            <Stat label="Queries" value={search.queriesCount ?? 0} />
          </div>
          {searchEmpty ? (
            <EmptyCard>No search data yet — the site was just submitted to Google. Queries, clicks and rankings appear here over the coming weeks as it’s crawled and starts ranking.</EmptyCard>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Card title="Top search queries">
                <Table cols={['Query', 'Clicks', 'Impr.', 'Pos.']}
                  rows={search.topQueries.map((q) => [q.query, q.clicks, q.impressions, q.position.toFixed(1)])} />
              </Card>
              <Card title="Top pages from search">
                <Table cols={['Page', 'Clicks', 'Impr.', 'CTR']}
                  rows={search.topPages.map((p) => [shortPath(p.page), p.clicks, p.impressions, (p.ctr * 100).toFixed(1) + '%'])} />
              </Card>
            </div>
          )}
        </>
      ) : null}

      {/* ---------- SEARCH VISIBILITY (the baseline scorecard — the plan's metric) ---------- */}
      <h2 className="font-head text-sm font-bold uppercase tracking-wide text-ink-soft mt-9 mb-1 border-t border-line pt-7">Search visibility</h2>
      <p className="text-ink-soft text-sm mb-5">30 tracked commercial queries · fixed 28-day windows · how many reach the top 10.</p>

      {svError ? (
        <Notice tone="error" onRetry={retry}>Couldn’t load search visibility: {svError}</Notice>
      ) : !svLoaded ? (
        <Spinner label="Loading search visibility…" />
      ) : !sv ? (
        <EmptyCard>No baseline set found — apply the search-visibility migrations and seed, then import the baseline.</EmptyCard>
      ) : (
        <SearchScorecard sv={sv} onIngested={retry} />
      )}

      {/* ---------- OVERALL SITE VISIBILITY (seo_snapshots, demoted to a strip so it doesn't
           compete with the scorecard's trend — different question, plainly labelled) ---------- */}
      <h2 className="font-head text-sm font-bold uppercase tracking-wide text-ink-soft mt-9 mb-1 border-t border-line pt-7">Overall site visibility</h2>
      <p className="text-ink-soft text-sm mb-5">Whole site · all queries · rolling 28 days · captured automatically each day.</p>

      {snaps.length === 0 ? (
        <EmptyCard>Recorded automatically once a day — pages in search, impressions and clicks appear here as Google crawls the site.</EmptyCard>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          <Stat label="Pages in search" value={snaps[snaps.length - 1].pages} />
          <Stat label="Impressions" value={snaps[snaps.length - 1].impressions} />
          <Stat label="Clicks" value={snaps[snaps.length - 1].clicks} />
        </div>
      )}
    </div>
  )
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)
const shortPath = (url: string) => { try { return new URL(url).pathname || '/' } catch { return url } }
const fmtD = (iso: string) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const fmtRange = (r: Reading) => `${fmtD(r.period_start)} – ${fmtD(r.period_end)}`

function Stat({ label, value, decimals = 0, suffix = '' }: { label: string; value: number; decimals?: number; suffix?: string }) {
  return (
    <div className="bg-white border border-line rounded-xl p-4">
      <div className="text-xs font-semibold text-ink-soft uppercase tracking-wide">{label}</div>
      <div className="font-head text-3xl font-bold text-navy mt-1">
        {value.toLocaleString('en-GB', { maximumFractionDigits: decimals })}{suffix}
      </div>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-line rounded-xl p-5">
      <h2 className="font-head text-sm font-bold uppercase tracking-wide text-navy mb-4">{title}</h2>
      {children}
    </section>
  )
}

function EmptyCard({ children }: { children: React.ReactNode }) {
  return <div className="bg-white border border-line rounded-xl p-10 text-center text-ink-soft">{children}</div>
}

function Notice({ children, tone, onRetry }: { children: React.ReactNode; tone?: 'error'; onRetry?: () => void }) {
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm mb-5 flex items-center gap-3 flex-wrap ${tone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-line bg-surface text-ink-soft'}`}>
      <span>{children}</span>
      {onRetry && (
        <button onClick={onRetry} className="ml-auto font-semibold underline hover:no-underline">
          Retry
        </button>
      )}
    </div>
  )
}

// Branded loader — the Premier "ring" mark, spinning (static under reduced-motion).
function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-ink-soft text-sm py-6">
      <img src="/logo-wheel.webp" alt="" width={26} height={26}
        className="motion-safe:animate-spin" style={{ animationDuration: '1.1s' }} />
      {label ?? 'Loading…'}
    </div>
  )
}

// Bound a promise so a hung edge function surfaces a retry instead of an endless spinner.
function withTimeout<T>(p: Promise<T>, ms = 20000): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timed out')), ms)),
  ])
}

// Dual-line trend: page views (teal accent) + visitors (navy). Neither is a reserved value colour.
function Chart({ series }: { series: AnalyticsData['timeseries'] }) {
  const pts = series.filter((d) => d.date)
  if (pts.length < 2) return <p className="text-ink-soft text-sm">Not enough data to chart yet.</p>
  const W = 720, H = 170, P = 6
  const max = Math.max(1, ...pts.map((d) => Math.max(d.pageViews, d.visitors)))
  const x = (i: number) => P + (i * (W - 2 * P)) / (pts.length - 1)
  const y = (v: number) => H - P - (v / max) * (H - 2 * P)
  const path = (key: 'pageViews' | 'visitors') => pts.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join('')
  const area = `${path('pageViews')}L${x(pts.length - 1).toFixed(1)},${H - P}L${x(0).toFixed(1)},${H - P}Z`
  return (
    <div>
      <div className="flex gap-4 mb-2 text-xs text-ink-soft">
        <span className="inline-flex items-center gap-1.5"><i className="w-3 h-0.5 rounded" style={{ background: 'var(--color-accent)' }} />Page views</span>
        <span className="inline-flex items-center gap-1.5"><i className="w-3 h-0.5 rounded" style={{ background: 'var(--pc-navy)' }} />Visitors</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Visitors and page views over time">
        <path d={area} fill="var(--color-accent)" opacity="0.1" />
        <path d={path('pageViews')} fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinejoin="round" />
        <path d={path('visitors')} fill="none" stroke="var(--pc-navy)" strokeWidth="1.6" strokeLinejoin="round" opacity="0.65" />
      </svg>
      <div className="flex justify-between text-[11px] text-ink-soft mt-1"><span>{pts[0].date}</span><span>{pts[pts.length - 1].date}</span></div>
    </div>
  )
}

function Bars({ rows }: { rows: { label: string; value: number }[] }) {
  if (!rows.length) return <p className="text-ink-soft text-sm">No data yet.</p>
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <div className="space-y-2.5">
      {rows.map((r, i) => (
        <div key={i}>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-ink truncate">{r.label}</span>
            <span className="text-navy font-medium tabular-nums">{r.value.toLocaleString('en-GB')}</span>
          </div>
          <div className="h-1.5 bg-surface rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: 'var(--color-accent)' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function Table({ rows, cols }: { rows: (string | number)[][]; cols: string[] }) {
  if (rows.length === 0) return <p className="text-ink-soft text-sm">No data yet.</p>
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs uppercase tracking-wide text-ink-soft">
          {cols.map((c, i) => (<th key={c} className={`pb-2 font-semibold ${i ? 'text-right' : ''}`}>{c}</th>))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={ri} className="border-t border-line">
            {row.map((cell, ci) => (
              <td key={ci} className={`py-2 ${ci ? 'text-right tabular-nums text-navy font-medium' : 'text-ink truncate max-w-[220px]'}`}>
                {ci && typeof cell === 'number' ? cell.toLocaleString('en-GB') : cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/* ================= SEARCH VISIBILITY — the baseline scorecard ================= */

function SearchScorecard({ sv, onIngested }: { sv: SearchVisibility; onIngested: () => void }) {
  if (sv.readings.length === 0) {
    return (
      <>
        <EmptyCard>Baseline set “{sv.set.name}” is seeded ({sv.tracked.length} queries) but no reading has been imported yet.</EmptyCard>
        <div className="mt-5"><IngestForm sv={sv} onIngested={onIngested} /></div>
      </>
    )
  }
  const baseline = sv.readings.find((r) => r.is_baseline) ?? sv.readings[0]
  const latest = sv.readings[sv.readings.length - 1]
  const base = readingMetrics(sv, baseline.id)
  const now = readingMetrics(sv, latest.id)
  const n = sv.tracked.length
  const single = sv.readings.length === 1
  const clusters = [...new Set(sv.tracked.map((t) => t.cluster))].sort()

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Delta label="In top 10" value={now.top10} base={base.top10} suffix={` / ${n}`} />
        <Delta label="In top 20" value={now.top20} base={base.top20} suffix={` / ${n}`} />
        <Delta label="Clicks (tracked)" value={now.clicks} base={base.clicks} />
      </div>
      <p className="text-xs text-ink-soft -mt-2">
        Latest window <b>{fmtRange(latest)}</b> vs baseline <b>{fmtRange(baseline)}</b>{single ? ' — the baseline is the only reading so far.' : '.'}
      </p>

      <Card title="Terms in the top 10, per reading"><SvTrend sv={sv} /></Card>

      <Card title="By cluster — in the top 10 (latest window)">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {clusters.map((c) => {
            const m = readingMetrics(sv, latest.id, c)
            const bm = readingMetrics(sv, baseline.id, c)
            const count = sv.tracked.filter((t) => t.cluster === c).length
            const d = m.top10 - bm.top10
            return (
              <div key={c} className="border border-line rounded-lg p-3">
                <div className="text-xs font-semibold text-ink-soft">{c}</div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="font-head text-2xl font-bold text-navy">{m.top10}</span>
                  <span className="text-xs text-ink-soft">/ {count} in top 10</span>
                  {d !== 0 && <span className={`text-xs font-semibold ${d > 0 ? 'text-teal-ink' : 'text-red-600'}`}>{d > 0 ? '▲' : '▼'}{Math.abs(d)}</span>}
                </div>
                <div className="text-[11px] text-ink-soft mt-0.5">{m.top20} in top 20</div>
              </div>
            )
          })}
        </div>
      </Card>

      <Card title={`All ${n} tracked queries`}><SvDetailTable sv={sv} baseline={baseline} latest={latest} /></Card>

      <IngestForm sv={sv} onIngested={onIngested} />
    </div>
  )
}

function Delta({ label, value, base, suffix = '' }: { label: string; value: number; base: number; suffix?: string }) {
  const d = value - base
  return (
    <div className="bg-white border border-line rounded-xl p-4">
      <div className="text-xs font-semibold text-ink-soft uppercase tracking-wide">{label}</div>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="font-head text-3xl font-bold text-navy">
          {value.toLocaleString('en-GB')}<span className="text-base text-ink-soft font-semibold">{suffix}</span>
        </span>
        {d !== 0 && <span className={`text-xs font-semibold ${d > 0 ? 'text-teal-ink' : 'text-red-600'}`}>{d > 0 ? '▲' : '▼'} {Math.abs(d)}</span>}
      </div>
      <div className="text-[11px] text-ink-soft mt-0.5">baseline {base.toLocaleString('en-GB')}</div>
    </div>
  )
}

// Trend of "terms in top 10" per reading on a fixed 0..N scale (so the count is honest),
// annotated with search_event markers. Renders 1..N points — a single baseline reading
// shows as one labelled dot, not an error or a hidden chart.
function SvTrend({ sv }: { sv: SearchVisibility }) {
  const pts = sv.readings.map((r) => ({ r, top10: readingMetrics(sv, r.id).top10, t: Date.parse(r.period_end + 'T00:00:00Z') }))
  const evs = sv.events.map((e) => ({ e, t: Date.parse(e.occurred_on + 'T00:00:00Z') }))
  const W = 720, H = 190, P = 24
  const allT = [...pts.map((p) => p.t), ...evs.map((e) => e.t)]
  const tMin = Math.min(...allT), tMax = Math.max(...allT)
  const span = Math.max(1, tMax - tMin)
  const maxY = Math.max(1, sv.tracked.length)
  const x = (t: number) => P + ((t - tMin) / span) * (W - 2 * P)
  const y = (v: number) => H - P - (v / maxY) * (H - 2 * P)
  const single = pts.length === 1

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Terms in the top 10 per reading">
        <line x1={P} y1={y(0)} x2={W - P} y2={y(0)} stroke="var(--pc-navy)" strokeOpacity="0.12" strokeWidth="1" />
        {evs.map((e, i) => (
          <line key={i} x1={x(e.t)} y1={P - 8} x2={x(e.t)} y2={H - P}
            stroke="var(--pc-navy)" strokeOpacity="0.28" strokeWidth="1" strokeDasharray="3 3" />
        ))}
        {!single && (
          <path d={pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.top10).toFixed(1)}`).join('')}
            fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinejoin="round" />
        )}
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={x(p.t)} cy={y(p.top10)} r={single ? 5 : 3.5} fill="var(--color-accent)" />
            <text x={x(p.t)} y={y(p.top10) - 9} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--pc-navy)">{p.top10}</text>
          </g>
        ))}
      </svg>
      <div className="flex justify-between text-[11px] text-ink-soft mt-1">
        <span>{fmtD(pts[0].r.period_end)}</span>
        <span>0–{sv.tracked.length} scale · {single ? 'baseline only' : `${pts.length} readings`}</span>
        <span>{fmtD(pts[pts.length - 1].r.period_end)}</span>
      </div>
      {evs.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-line pt-3">
          {evs.map((e, i) => (
            <li key={i} className="text-xs text-ink-soft flex gap-2">
              <span className="text-navy font-semibold tabular-nums shrink-0">{fmtD(e.e.occurred_on)}</span>
              <span>{e.e.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// 30-query detail. NULL position = em-dash + tooltip (not zero, not 100). Sortable,
// default by change (baseline − latest position; positive = moved up) descending.
function SvDetailTable({ sv, baseline, latest }: { sv: SearchVisibility; baseline: Reading; latest: Reading }) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: 'change', dir: -1 })
  const bMap = sv.rowsByReading[baseline.id] ?? {}
  const lMap = sv.rowsByReading[latest.id] ?? {}
  const rows = sv.tracked.map((t) => {
    const bp = bMap[t.id]?.position ?? null
    const lp = lMap[t.id]?.position ?? null
    return { t, bp, lp, change: bp != null && lp != null ? bp - lp : null, clicks: lMap[t.id]?.clicks ?? null }
  })
  const val = (r: (typeof rows)[number]): number | null =>
    sort.key === 'baseline' ? r.bp : sort.key === 'latest' ? r.lp : sort.key === 'clicks' ? r.clicks : r.change
  const sorted = [...rows].sort((a, b) => {
    if (sort.key === 'cluster') return sort.dir * (a.t.cluster.localeCompare(b.t.cluster) || a.t.display_order - b.t.display_order)
    if (sort.key === 'query') return sort.dir * a.t.query.localeCompare(b.t.query)
    const av = val(a), bv = val(b)
    if (av == null && bv == null) return a.t.display_order - b.t.display_order
    if (av == null) return 1
    if (bv == null) return -1
    return sort.dir * (av - bv)
  })
  const toggle = (key: string) => setSort((s) =>
    s.key === key ? { key, dir: (s.dir === 1 ? -1 : 1) as 1 | -1 } : { key, dir: key === 'cluster' || key === 'query' ? 1 : -1 })
  const Th = ({ k, label, right }: { k: string; label: string; right?: boolean }) => (
    <th onClick={() => toggle(k)}
      className={`pb-2 font-semibold cursor-pointer select-none whitespace-nowrap ${right ? 'text-right' : ''}`}>
      {label}{sort.key === k ? (sort.dir === 1 ? ' ▲' : ' ▼') : ''}
    </th>
  )
  const Pos = ({ p }: { p: number | null }) => p == null
    ? <span className="text-ink-soft" title="No data returned for this query in this window (below GSC’s reporting threshold) — not zero, not position 100.">—</span>
    : <>{p.toFixed(1)}</>

  return (
    <div className="max-h-96 overflow-y-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-ink-soft">
            <Th k="cluster" label="Cl." /><Th k="query" label="Query" />
            <Th k="baseline" label="Base" right /><Th k="latest" label="Latest" right />
            <Th k="change" label="Change" right /><Th k="clicks" label="Clicks" right />
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.t.id} className="border-t border-line">
              <td className="py-2 text-ink-soft" title={r.t.cluster}>{r.t.cluster[0]}</td>
              <td className="py-2 text-ink truncate max-w-[240px]" title={r.t.query}>{r.t.query}</td>
              <td className="py-2 text-right tabular-nums text-ink-soft"><Pos p={r.bp} /></td>
              <td className="py-2 text-right tabular-nums text-navy font-medium"><Pos p={r.lp} /></td>
              <td className="py-2 text-right tabular-nums">
                {r.change == null ? <span className="text-ink-soft">—</span>
                  : r.change === 0 ? <span className="text-ink-soft">0</span>
                  : <span className={r.change > 0 ? 'text-teal-ink font-semibold' : 'text-red-600 font-semibold'}>{r.change > 0 ? '▲' : '▼'}{Math.abs(r.change).toFixed(1)}</span>}
              </td>
              <td className="py-2 text-right tabular-nums text-navy">{r.clicks ?? <span className="text-ink-soft">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// CSV upload → ingest_search_reading RPC. Enforces the 28-day window client-side too,
// and offers replace when a non-baseline reading already exists for the period.
function IngestForm({ sv, onIngested }: { sv: SearchVisibility; onIngested: () => void }) {
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [rows, setRows] = useState<GscRow[] | null>(null)
  const [fileName, setFileName] = useState('')
  const [busy, setBusy] = useState(false)
  const [pendingReplace, setPendingReplace] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error' | 'info'; text: string } | null>(null)

  const days = start && end ? windowDaysInclusive(start, end) : null
  const windowOk = days === 28

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFileName(f.name); setMsg(null); setPendingReplace(false)
    try {
      const parsed = parseGscCsv(await f.text())
      setRows(parsed)
      setMsg({ tone: 'info', text: `Parsed ${parsed.length} rows from the export.` })
    } catch (err) {
      setRows(null); setMsg({ tone: 'error', text: err instanceof Error ? err.message : String(err) })
    }
  }

  async function submit(replace: boolean) {
    if (!rows || !windowOk) return
    setBusy(true); setMsg(null)
    try {
      const res = await ingestReading(sv.set.id, start, end, rows, replace)
      const miss = res.unmatched.length
      setMsg({ tone: miss ? 'info' : 'ok', text: `Imported — ${res.matched}/${res.total} matched${miss ? `. Not in the export: ${res.unmatched.join(', ')}` : '.'}` })
      setPendingReplace(false)
      onIngested()
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err)
      if (/already exists/i.test(text)) { setPendingReplace(true); setMsg({ tone: 'info', text: 'A reading already exists for that period. Replace it?' }) }
      else setMsg({ tone: 'error', text })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="bg-surface border border-line rounded-xl p-5">
      <h3 className="font-head text-sm font-bold uppercase tracking-wide text-navy mb-1">Import a reading</h3>
      <p className="text-xs text-ink-soft mb-4">
        Upload a GSC “Queries” CSV for a <b>28-day</b> window. Rows are matched to the {sv.tracked.length} tracked queries; every reading stores exactly {sv.tracked.length} (a query absent from the export is recorded as no data, not zero).
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-semibold text-ink-soft">Period start
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)}
            className="block mt-1 px-3 py-2 rounded-lg border border-line text-sm bg-white" />
        </label>
        <label className="text-xs font-semibold text-ink-soft">Period end
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)}
            className="block mt-1 px-3 py-2 rounded-lg border border-line text-sm bg-white" />
        </label>
        <label className="text-xs font-semibold text-teal-ink cursor-pointer hover:underline pb-2.5">
          {fileName || '＋ Choose CSV'}
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
        </label>
      </div>
      {days != null && !windowOk && <p className="text-xs text-red-600 mt-2">Window is {days} days — it must be exactly 28.</p>}
      <div className="flex items-center gap-3 mt-4 flex-wrap">
        <button disabled={!rows || !windowOk || busy} onClick={() => submit(pendingReplace)}
          className="px-4 py-2 rounded-lg bg-teal text-navy font-head font-semibold text-sm disabled:opacity-50">
          {busy ? 'Importing…' : pendingReplace ? 'Replace existing' : 'Import'}
        </button>
        {msg && <span className={`text-xs ${msg.tone === 'error' ? 'text-red-600' : msg.tone === 'ok' ? 'text-teal-ink' : 'text-ink-soft'}`}>{msg.text}</span>}
      </div>
    </section>
  )
}
