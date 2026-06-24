import { useEffect } from 'react'

// A self-contained help drawer documenting every field + workflow on the Case
// Studies area. Opened from the "? Help" button on the list page.
export function CaseStudiesHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Case Studies help">
      <div className="absolute inset-0 bg-navy/40" onClick={onClose} />
      <aside className="relative w-full max-w-xl h-full overflow-y-auto bg-white shadow-2xl">
        <header className="sticky top-0 bg-white border-b border-line px-6 py-4 flex items-center justify-between">
          <h2 className="font-head text-lg font-bold text-navy">Case Studies — how it works</h2>
          <button onClick={onClose} className="text-ink-soft hover:text-navy text-sm font-semibold">Close ✕</button>
        </header>

        <div className="px-6 py-5 space-y-6 text-sm text-ink leading-relaxed">
          <section>
            <p>
              A case study is a project write-up that appears on the public
              <strong> /case-studies</strong> page, and — if you choose — in the
              <strong> homepage strip</strong>. Create one with
              <strong> ＋ New case study</strong>, fill in the fields below, then
              <strong> Save &amp; publish</strong>.
            </p>
          </section>

          <Group title="The fields">
            <Field name="Title" required>The project headline, e.g. “Fire Damper Testing for Betsi Cadwaladr Health Board”.</Field>
            <Field name="Slug (URL)">
              Auto-filled from the title — it’s the page address (<code>/case-studies/your-slug</code>).
              Safe to leave as-is. Only change it before publishing; editing it later breaks any existing links.
            </Field>
            <Field name="Client">
              The organisation’s name, shown on the card. <strong>Only name a client you have written consent to name publicly</strong>
              (NHS trusts / universities especially) — otherwise leave it generic (e.g. “A UK Government department”).
            </Field>
            <Field name="Location · Value · Duration · Service">
              Optional meta. <em>Value</em> takes a figure like <code>£1.8m</code>; <em>Service</em> is the work type
              (Fire Damper Testing, Fire Doors…) shown next to the client on the card.
            </Field>
            <Field name="Date">When the work happened. Used to order studies that don’t have a rank (newest first).</Field>
            <Field name="Cover image">
              The card thumbnail + detail hero. <strong>Upload</strong> a PNG/JPEG/WebP (it stores it for you and fills the URL),
              or paste an image URL. Landscape (roughly 16:9) looks best — portraits get cropped.
            </Field>
            <Field name="Excerpt">One or two sentences shown on the card under the title. Keep it punchy.</Field>
            <Field name="Body (markdown)">
              The full write-up. Supports <code># ## ###</code> headings, <code>**bold**</code>, <code>*italic*</code>,
              <code>[links](url)</code>, <code>-</code>/<code>1.</code> lists, <code>&gt; quotes</code> and <code>---</code> rules.
            </Field>
            <Field name="Rank">
              Controls order. <strong>Lower number = higher up</strong> and always-featured (rank <code>1</code> pins it to the top).
              Leave <strong>blank</strong> to let it fall into date order. Use ranks to curate the “best first” run.
            </Field>
            <Field name="Status">
              <strong>Draft</strong> = hidden from the public site. <strong>Published</strong> = live. Nothing appears publicly until published.
            </Field>
            <Field name="Shown on homepage">
              Features the study in the homepage strip. <strong>Hard cap of 6</strong> (the strip is 3 across, 2 rows). If 6 are already on,
              the box is disabled — turn one off on another study to free a slot. Only takes effect once the study is <em>published</em>.
            </Field>
          </Group>

          <Group title="Saving &amp; publishing">
            <Field name="Save draft">Stores changes but keeps it hidden. Use while you’re still writing.</Field>
            <Field name="Save &amp; publish">Makes it live and rebuilds the public site so the new/updated page appears.</Field>
            <Field name="Delete">Permanent — removes the study and rebuilds the site. There’s a confirm prompt.</Field>
            <p className="text-ink-soft text-xs">
              Publishing, editing a published study, or deleting one triggers a site rebuild automatically — the public pages
              regenerate as static HTML (good for Google), so changes can take a minute to show.
            </p>
          </Group>

          <Group title="How ordering works">
            <ul className="list-disc pl-5 space-y-1">
              <li>The list and the public page sort by <strong>rank first</strong> (lowest), then <strong>newest date</strong>.</li>
              <li>The <strong>homepage strip</strong> shows the published studies you’ve toggled on, up to <strong>6</strong>.</li>
              <li>The public listing shows <strong>9 per page</strong> (3 × 3), then paginates.</li>
            </ul>
          </Group>

          <Group title="Good to know">
            <ul className="list-disc pl-5 space-y-1">
              <li>Get <strong>written consent</strong> before naming a client publicly.</li>
              <li>Don’t change a <strong>slug</strong> after publishing — it breaks shared links.</li>
              <li>A missing cover image degrades gracefully to an on-brand placeholder.</li>
            </ul>
          </Group>
        </div>
      </aside>
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="font-head text-sm font-bold uppercase tracking-wide text-navy border-b-2 border-teal pb-1.5 mb-3">{title}</h3>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function Field({ name, required, children }: { name: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-semibold text-navy">
        {name}{required && <span className="text-orange"> *</span>}
      </p>
      <p className="text-ink-soft">{children}</p>
    </div>
  )
}
