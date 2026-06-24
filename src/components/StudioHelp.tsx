import { useEffect } from 'react'

const SECTIONS: [string, string][] = [
  ['insights', 'Insights'],
  ['engine', 'Content Engine'],
  ['signal', 'Signal'],
  ['images', 'Image Bank'],
  ['cases', 'Case Studies'],
  ['general', 'General'],
]

// One global guide covering every Studio area. Opened from the "? Help" item in
// the sidebar, so it's reachable from any page.
export function StudioHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const jump = (id: string) =>
    document.getElementById(`help-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Studio help">
      <div className="absolute inset-0 bg-navy/40" onClick={onClose} />
      <aside className="relative w-full max-w-2xl h-full overflow-y-auto bg-white shadow-2xl">
        <header className="sticky top-0 z-10 bg-white border-b border-line px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="font-head text-lg font-bold text-navy">Studio — how it works</h2>
            <button onClick={onClose} className="text-ink-soft hover:text-navy text-sm font-semibold">Close ✕</button>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {SECTIONS.map(([id, label]) => (
              <button
                key={id}
                onClick={() => jump(id)}
                className="text-xs font-semibold text-teal-ink bg-teal/10 hover:bg-teal/20 rounded-full px-2.5 py-1"
              >
                {label}
              </button>
            ))}
          </div>
        </header>

        <div className="px-6 py-5 space-y-7 text-sm text-ink leading-relaxed">
          <p className="text-ink-soft">
            Studio is where the team writes and ships content. The <strong>Insights</strong> and
            <strong> Case Studies</strong> you publish here become fast, Google-friendly pages on the
            public website; <strong>Content Engine</strong>, <strong>Signal</strong> and
            <strong> Image Bank</strong> help you produce them. Sign in with your <strong>CindersX</strong> account.
          </p>

          <Group id="insights" title="Insights">
            <p className="text-ink-soft">Your articles — they publish to the public <code>/insights</code> page as static HTML.</p>
            <Field name="New / edit insight">Title, Slug (the URL), Cover (upload one or <b>✦ Generate cover</b> for a branded image), Excerpt, and Body in markdown. <b>✦ AI assist</b> helps draft the writing.</Field>
            <Field name="Ask-AI cards">Generate prompt cards from the article, then pick <b>exactly 2 or 4</b> to show on the published page (save is blocked otherwise).</Field>
            <Field name="Generate Signals">Seeds 3 ready-to-post Signals from the article into the Signal board.</Field>
            <Field name="Schedule the week">Tick a few drafts in the list → <b>🗓 Schedule the week</b> spreads them one per weekday (Mon–Fri) at 2pm, starting next Monday.</Field>
            <Field name="Publish date column">Set or change any item's go-live time inline; it auto-publishes when due. Published rows show the live date.</Field>
            <Field name="Status / Unpublish / Delete">Draft = hidden; Published = live. Unpublish pulls it back to draft; Delete removes it. Each rebuilds the site.</Field>
          </Group>

          <Group id="engine" title="Content Engine">
            <p className="text-ink-soft">Spin up several insight <b>drafts</b> on a theme, written in Premier's voice.</p>
            <Field name="How to use">Enter a <b>Theme</b> and <b>how many drafts</b>, then <b>✦ Generate drafts</b>. They land in <b>Insights</b> as drafts — edit, then schedule or publish from there.</Field>
          </Group>

          <Group id="signal" title="Signal">
            <p className="text-ink-soft">Your social-content workbench — turns findings into LinkedIn-ready posts.</p>
            <Field name="Insight bank">Add an <b>anonymised</b> compliance finding (summary, optional sector + metric — <b>no client names</b>), then <b>✦ Generate 3 drafts</b>.</Field>
            <Field name="Auto-seeded">Publishing an Insight also seeds 3 Signals automatically.</Field>
            <Field name="Important">Signal never connects to LinkedIn or posts for you — you copy the finished post out and post it yourself.</Field>
          </Group>

          <Group id="images" title="Image Bank">
            <p className="text-ink-soft">Reusable, on-brand imagery for covers and posts.</p>
            <Field name="Upload">Add photos (PNG/JPEG, several at once) to keep them on hand.</Field>
            <Field name="Spotlight">Crop any image to a ratio and apply the Premier brand treatment — <b>Colourings</b> (colour grade + wheel arcs) or <b>Cut-out</b> (subject kept full-colour over a graded background) — then <b>Save to bank</b> to reuse it.</Field>
            <Field name="Your images vs Spotlights">Uploads sit under “Your images”; finished branded versions under “Spotlights”.</Field>
          </Group>

          <Group id="cases" title="Case Studies">
            <p className="text-ink-soft">Project write-ups for the public <code>/case-studies</code> page and (optionally) the homepage strip.</p>
            <Field name="Fields">Title, Slug (URL — don't change after publishing), Client (<b>only name with written consent</b>), Location/Value/Duration/Service, Cover (upload or paste a URL), Excerpt, Body (markdown).</Field>
            <Field name="Rank">Lower number = higher up and always-featured (rank <code>1</code> pins to the top); blank = ordered by date.</Field>
            <Field name="Shown on homepage">Features it in the homepage strip — <b>hard cap of 6</b>; turn one off elsewhere to add another. Applies once published.</Field>
            <Field name="Save / publish / delete">Save draft keeps it hidden; Save &amp; publish makes it live and rebuilds the site; Delete is permanent.</Field>
          </Group>

          <Group id="general" title="General">
            <Field name="Login">Your CindersX account — the same sign-in used for Roadmap and the Brand Hub.</Field>
            <Field name="Publishing rebuilds the site">Publishing, editing a published item, or deleting one automatically rebuilds the public website (static HTML for SEO), so changes can take a minute to appear.</Field>
            <Field name="Scheduling">Scheduled items auto-publish when their time is due, then trigger a rebuild — no need to come back and press publish.</Field>
            <Field name="Settings">Coming soon.</Field>
          </Group>
        </div>
      </aside>
    </div>
  )
}

function Group({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={`help-${id}`} className="scroll-mt-24">
      <h3 className="font-head text-sm font-bold uppercase tracking-wide text-navy border-b-2 border-teal pb-1.5 mb-3">{title}</h3>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function Field({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-semibold text-navy">{name}</p>
      <p className="text-ink-soft">{children}</p>
    </div>
  )
}
