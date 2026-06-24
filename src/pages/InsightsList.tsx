import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  deleteInsight,
  listInsights,
  scheduleInsightsWeek,
  triggerRebuild,
  updateInsight,
} from '../lib/insights'
import type { Insight } from '../types'

// Drafts/pending/scheduled can be batch-scheduled; published ones can't.
const SCHEDULABLE = new Set(['draft', 'pending_review', 'scheduled'])

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-line text-ink-soft',
  pending_review: 'bg-orange/15 text-orange',
  scheduled: 'bg-light-blue/15 text-light-blue',
  published: 'bg-teal/15 text-teal-ink',
}

export function InsightsList() {
  const [items, setItems] = useState<Insight[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [scheduling, setScheduling] = useState(false)
  const [schedMsg, setSchedMsg] = useState<string | null>(null)

  function toggleSel(id: string) {
    setSelected((s) => {
      const next = new Set(s)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function onScheduleWeek() {
    // Preserve the list order so the day-by-day spread is predictable.
    const ids = items.filter((i) => selected.has(i.id)).map((i) => i.id)
    if (ids.length === 0) return
    setScheduling(true)
    setSchedMsg(null)
    setError(null)
    try {
      const slots = await scheduleInsightsWeek(ids)
      const first = new Date(slots[0]).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
      const last = new Date(slots[slots.length - 1]).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
      setSchedMsg(`Scheduled ${ids.length} insight${ids.length === 1 ? '' : 's'}: ${first} → ${last} (one per weekday).`)
      setSelected(new Set())
      setItems(await listInsights())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setScheduling(false)
    }
  }

  useEffect(() => {
    listInsights()
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [])

  async function onDelete(item: Insight) {
    if (!window.confirm(`Delete "${item.title || 'untitled'}"? This cannot be undone.`)) return
    setBusyId(item.id)
    setError(null)
    try {
      await deleteInsight(item.id)
      if (item.status === 'published') await triggerRebuild()
      setItems((xs) => xs.filter((x) => x.id !== item.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusyId(null)
    }
  }

  // ISO (UTC) ↔ datetime-local (browser-local) for the inline date editor.
  function toLocalInput(iso: string | null | undefined): string {
    if (!iso) return ''
    const d = new Date(iso)
    const p = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
  }

  async function onChangeDate(item: Insight, value: string) {
    const iso = value ? new Date(value).toISOString() : null
    setBusyId(item.id)
    setError(null)
    try {
      // Setting a date schedules it (the cron publishes when due, then rebuilds).
      await updateInsight(item.id, { status: 'scheduled', scheduled_at: iso })
      setItems((xs) => xs.map((x) => (x.id === item.id ? { ...x, status: 'scheduled', scheduled_at: iso } : x)))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusyId(null)
    }
  }

  async function onUnpublish(item: Insight) {
    setBusyId(item.id)
    setError(null)
    try {
      await updateInsight(item.id, { status: 'draft' })
      await triggerRebuild()
      setItems((xs) => xs.map((x) => (x.id === item.id ? { ...x, status: 'draft' } : x)))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-head text-2xl font-bold text-navy">Insights</h1>
        <Link to="/insights/new" className="px-4 py-2 rounded-lg bg-teal text-navy font-head font-semibold text-sm">
          New insight
        </Link>
      </div>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 bg-white border border-line rounded-xl px-4 py-3">
          <span className="text-sm text-navy font-medium">{selected.size} selected</span>
          <button
            onClick={onScheduleWeek}
            disabled={scheduling}
            className="px-4 py-2 rounded-lg bg-teal text-navy font-head font-semibold text-sm disabled:opacity-60"
          >
            {scheduling ? 'Scheduling…' : '🗓 Schedule the week'}
          </button>
          <span className="text-xs text-ink-soft">one per weekday from today</span>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-ink-soft hover:text-navy">
            Clear
          </button>
        </div>
      )}
      {schedMsg && <p className="text-teal-ink text-sm mb-4">{schedMsg}</p>}

      {loading ? (
        <p className="text-ink-soft">Loading…</p>
      ) : items.length === 0 ? (
        <div className="bg-white border border-line rounded-xl p-10 text-center text-ink-soft">
          No insights yet. Create your first one.
        </div>
      ) : (
        <div className="bg-white border border-line rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface text-ink-soft text-left text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 w-8"></th>
                <th className="px-4 py-3 font-semibold">Title</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Publish date</th>
                <th className="px-4 py-3 font-semibold">Updated</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className="border-t border-line hover:bg-surface">
                  <td className="px-4 py-3 text-center">
                    {SCHEDULABLE.has(i.status) && (
                      <input
                        type="checkbox"
                        checked={selected.has(i.id)}
                        onChange={() => toggleSel(i.id)}
                        aria-label="Select for scheduling"
                      />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/insights/${i.id}`} className="font-semibold text-navy hover:text-teal-ink">
                      {i.title || '(untitled)'}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_STYLE[i.status] ?? ''}`}>
                      {i.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {i.status === 'published' ? (
                      <span className="text-ink-soft text-xs">
                        {i.published_at ? new Date(i.published_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </span>
                    ) : (
                      <input
                        type="datetime-local"
                        value={toLocalInput(i.scheduled_at)}
                        disabled={busyId === i.id}
                        onChange={(e) => onChangeDate(i, e.target.value)}
                        className="text-xs px-2 py-1 rounded-lg border border-line focus:outline-none focus:ring-2 focus:ring-teal/40"
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">
                    {new Date(i.updated_at).toLocaleDateString('en-GB')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3 text-xs font-semibold">
                      <Link to={`/insights/${i.id}`} className="text-teal-ink hover:underline">Edit</Link>
                      {i.status === 'published' && (
                        <button
                          onClick={() => onUnpublish(i)}
                          disabled={busyId === i.id}
                          className="text-ink-soft hover:text-navy disabled:opacity-50"
                        >
                          Unpublish
                        </button>
                      )}
                      <button
                        onClick={() => onDelete(i)}
                        disabled={busyId === i.id}
                        className="text-red-600 hover:underline disabled:opacity-50"
                      >
                        {busyId === i.id ? '…' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
