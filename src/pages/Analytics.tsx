import { useEffect, useState } from 'react'
import { fetchAnalytics, RANGES, type AnalyticsData, type Range } from '../lib/analytics'
import { fetchSearch, type SearchData } from '../lib/searchConsole'

export function Analytics() {
  const [range, setRange] = useState<Range>('30d')
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [search, setSearch] = useState<SearchData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    setLoading(true); setError(null); setSearchError(null)
    // Two independent sources — one failing must not blank the other.
    fetchAnalytics(range)
      .then((d) => { if (live) setData(d) })
      .catch((e) => { if (live) setError(e instanceof Error ? e.message : String(e)) })
      .finally(() => { if (live) setLoading(false) })
    fetchSearch(range)
      .then((d) => { if (live) setSearch(d) })
      .catch((e) => { if (live) setSearchError(e instanceof Error ? e.message : String(e)) })
    return () => { live = false }
  }, [range])

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

      {error === 'unavailable' && <Notice>Traffic data is unavailable right now — please retry shortly.</Notice>}
      {error && error !== 'unavailable' && <Notice tone="error">Couldn’t load traffic: {error}</Notice>}

      {loading && !data ? (
        <p className="text-ink-soft text-sm">Loading…</p>
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

      {searchError && <Notice tone="error">Couldn’t load search data: {searchError}</Notice>}

      {!search && !searchError ? (
        <p className="text-ink-soft text-sm">Loading…</p>
      ) : search && !searchError ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <Stat label="Clicks" value={search.totals.clicks} />
            <Stat label="Impressions" value={search.totals.impressions} />
            <Stat label="CTR" value={search.totals.ctr * 100} decimals={1} suffix="%" />
            <Stat label="Avg position" value={search.totals.position} decimals={1} />
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
    </div>
  )
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)
const shortPath = (url: string) => { try { return new URL(url).pathname || '/' } catch { return url } }

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

function Notice({ children, tone }: { children: React.ReactNode; tone?: 'error' }) {
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm mb-5 ${tone === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-line bg-surface text-ink-soft'}`}>
      {children}
    </div>
  )
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
