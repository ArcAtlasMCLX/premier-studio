import { useEffect, type ReactNode } from 'react'

const SECTIONS: [string, string][] = [
  ['insights', 'Insights'],
  ['engine', 'Content Engine'],
  ['signal', 'Signal'],
  ['images', 'Image Bank'],
  ['cases', 'Case Studies'],
  ['analytics', 'Analytics'],
  ['general', 'General'],
]

// One global guide covering every Studio area — an annotated mockup of each screen
// plus numbered step-by-step instructions. Opened from the "? Help" sidebar item.
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
              <button key={id} onClick={() => jump(id)}
                className="text-xs font-semibold text-teal-ink bg-teal/10 hover:bg-teal/20 rounded-full px-2.5 py-1">
                {label}
              </button>
            ))}
          </div>
        </header>

        <div className="px-6 py-5 text-sm text-ink leading-relaxed">
          <p className="text-ink-soft">
            Studio is where the team writes and ships content. The <b>Insights</b> and <b>Case Studies</b> you publish
            become fast, Google-friendly pages on the public website; <b>Content Engine</b>, <b>Signal</b> and
            <b> Image Bank</b> help you make them. Sign in with your <b>CindersX</b> account. Each section below shows the
            screen, then the steps.
          </p>

          {/* INSIGHTS */}
          <Section id="insights" title="Insights" intro="Your articles — they publish to the public /insights page.">
            <Screen name="Insights · new insight">
              <Row mk={1} label="Title">
                <Fld bold>TR19 ductwork cleaning — what changed in 2026</Fld>
                <Hint>slug fills in automatically · /insights/tr19-ductwork-cleaning-2026</Hint>
              </Row>
              <Row mk={2} label="Cover image">
                <div className="flex gap-2 items-center">
                  <Thumb /><Btn>↑ Upload</Btn><Btn ai>✦ Generate cover</Btn>
                </div>
              </Row>
              <Row mk={3} label="Excerpt & body (markdown)" aside={<Btn ai>✦ AI assist</Btn>}>
                <Fld tall>A short teaser, then the full article…</Fld>
              </Row>
              <div className="flex gap-3">
                <div className="flex-1"><Row mk={4} label="Ask-AI cards"><div className="flex gap-1.5 items-center"><Chip>card</Chip><Chip>card</Chip><Hint inline>pick 2 or 4</Hint></div></Row></div>
                <div className="flex-1"><Row mk={5} label="Signals"><Btn ai>✦ Generate signals</Btn></Row></div>
              </div>
              <Bar><Btn>Save draft</Btn><Btn primary>Save &amp; publish</Btn><span className="ml-1"><Mk n={6} /></span></Bar>
            </Screen>
            <Steps>
              <Step n={1} title="Open the editor.">In the sidebar click <UI>Insights</UI>, then <UI>New insight</UI> (top-right). Give it a title — the <UI>slug</UI> (web address) fills in automatically.</Step>
              <Step n={2} title="Add a cover."><UI>Upload</UI> a photo, or click <UI>✦ Generate cover</UI> for an on-brand one made for you.</Step>
              <Step n={3} title="Write it.">Add a one-line <UI>excerpt</UI> (the teaser) and the <UI>body</UI> in markdown. Stuck? <UI>✦ AI assist</UI> drafts it in Premier's voice.</Step>
              <Step n={4} title="Optional — Ask-AI cards.">Generate prompt cards, then tick <b>exactly 2 or 4</b> to show on the live page (it won't save with any other number).</Step>
              <Step n={5} title="Optional — Signals.">Click <UI>✦ Generate signals</UI> to drop 3 ready-to-post LinkedIn drafts into the Signal board.</Step>
              <Step n={6} title="Publish."><UI>Save draft</UI> keeps it hidden; <UI>Save &amp; publish</UI> takes it live and rebuilds the site.</Step>
              <Step n={7} title="Or schedule it.">On the Insights list, set a <UI>publish date</UI> inline, or tick several drafts and use <UI>🗓 Schedule the week</UI> (Mon–Fri, 2pm, from next Monday).</Step>
            </Steps>
          </Section>

          {/* CONTENT ENGINE */}
          <Section id="engine" title="Content Engine" intro="Generate several insight drafts on a theme, in Premier's voice.">
            <Screen name="Content Engine">
              <Row mk={1} label="Theme"><Fld tall>Fire damper testing for NHS estates teams…</Fld></Row>
              <div className="flex gap-3 items-end">
                <div className="w-32"><Row mk={2} label="How many drafts"><Fld>5</Fld></Row></div>
                <Btn ai>✦ Generate drafts</Btn>
              </div>
              <Bar><Hint inline>Done — created 5 drafts in Insights</Hint></Bar>
            </Screen>
            <Steps>
              <Step n={1} title="Open Content Engine.">From the sidebar.</Step>
              <Step n={2} title="Describe the theme.">A sentence on what the batch should cover and who it's for.</Step>
              <Step n={3} title="Choose how many drafts.">Pick the number you want written.</Step>
              <Step n={4} title="Generate.">Click <UI>✦ Generate drafts</UI> and let it write — each one is in Premier's voice.</Step>
              <Step n={5} title="Find them in Insights.">The drafts land in the <UI>Insights</UI> list, marked <UI>draft</UI>.</Step>
              <Step n={6} title="Edit each one.">Open them in the Insights editor to refine the wording, cover and cards.</Step>
              <Step n={7} title="Schedule or publish.">Then schedule the week or publish, exactly like any Insight.</Step>
            </Steps>
          </Section>

          {/* SIGNAL */}
          <Section id="signal" title="Signal" intro="Turns findings into LinkedIn-ready posts. It never posts for you.">
            <Screen name="Signal · insight bank">
              <Row mk={1} label="Add a finding (anonymised — no client names)">
                <Fld>3,000 dampers surveyed across 20 health-board sites; 36% failed first test…</Fld>
              </Row>
              <div className="flex gap-3">
                <div className="flex-1"><Row label="Sector (optional)"><Fld>Healthcare</Fld></Row></div>
                <div className="flex-1"><Row label="Metric (optional)"><Fld>36% fail rate</Fld></Row></div>
              </div>
              <Bar><Mk n={2} /><Btn ai>✦ Generate 3 drafts</Btn></Bar>
              <Row mk={3} label="Drafts"><div className="flex gap-1.5"><Chip>post</Chip><Chip>post</Chip><Chip>post</Chip></div></Row>
            </Screen>
            <Steps>
              <Step n={1} title="Add an anonymised finding.">Open <UI>Signal</UI> and add a summary to the <UI>Insight bank</UI> — optional sector and metric, but <b>never client names</b>.</Step>
              <Step n={2} title="Generate drafts.">Click <UI>✦ Generate 3 drafts</UI>.</Step>
              <Step n={3} title="Review the drafts.">They appear below, ready to use.</Step>
              <Step n={4} title="Tip — they come free too.">Publishing an Insight automatically seeds 3 Signals here.</Step>
              <Step n={5} title="Pick one.">Choose the draft that lands best.</Step>
              <Step n={6} title="Copy it out.">Signal never connects to LinkedIn — copy the text.</Step>
              <Step n={7} title="Post it yourself.">Paste into LinkedIn (and pair it with an Image Bank picture if you like).</Step>
            </Steps>
          </Section>

          {/* IMAGE BANK */}
          <Section id="images" title="Image Bank" intro="Reusable, on-brand imagery for covers and posts.">
            <Screen name="Image Bank · spotlight">
              <Bar><Btn>＋ Upload images</Btn><Hint inline>PNG / JPEG · several at once</Hint></Bar>
              <div className="flex gap-2"><Thumb /><Thumb /><Thumb /></div>
              <Row mk={2} label="Spotlight — style">
                <div className="flex gap-1.5"><Btn primary>Colourings</Btn><Btn>Cut-out</Btn></div>
                <Hint>Colourings = grade + wheel arcs · Cut-out = subject over a graded background</Hint>
              </Row>
              <div className="flex gap-3">
                <div className="flex-1"><Row mk={3} label="Colour"><div className="flex gap-1.5"><Sw c="#248CFF" /><Sw c="#03FFA1" /><Sw c="#FF7D00" /></div></Row></div>
                <div className="flex-1"><Row mk={3} label="Ratio"><Btn>4:5</Btn> <Btn>1:1</Btn> <Btn>16:9</Btn></Row></div>
              </div>
              <Bar><Mk n={4} /><Btn primary>Save to bank</Btn></Bar>
            </Screen>
            <Steps>
              <Step n={1} title="Upload photos.">Open <UI>Image Bank</UI> and click <UI>＋ Upload images</UI> (PNG/JPEG, several at once).</Step>
              <Step n={2} title="Spotlight one.">Click <UI>✦ Spotlight</UI> on an image, then choose a style — <UI>Colourings</UI> (grade + wheel arcs) or <UI>Cut-out</UI> (subject kept full-colour over a graded background).</Step>
              <Step n={3} title="Set colour & ratio.">Pick the brand colour and the crop ratio (4:5, 1:1, 16:9).</Step>
              <Step n={4} title="Save to bank.">Stores the finished image for reuse.</Step>
              <Step n={5} title="Find it later.">Uploads sit under <UI>Your images</UI>; finished versions under <UI>Spotlights</UI>.</Step>
              <Step n={6} title="Reuse it.">Use it as an Insight or case-study cover, or alongside a Signal post.</Step>
              <Step n={7} title="Tidy up.">Delete anything you no longer need from either list.</Step>
            </Steps>
          </Section>

          {/* CASE STUDIES */}
          <Section id="cases" title="Case Studies" intro="Project write-ups for /case-studies and (optionally) the homepage.">
            <Screen name="Case Studies · edit">
              <Row mk={1} label="Title & client">
                <Fld bold>Fire damper testing for Betsi Cadwaladr Health Board</Fld>
                <Hint>client shown on the card — only name with written consent</Hint>
              </Row>
              <Row mk={2} label="Cover · excerpt · body"><div className="flex gap-2 items-center"><Thumb /><Btn>↑ Upload</Btn><Hint inline>or paste a URL</Hint></div></Row>
              <div className="flex gap-3">
                <div className="flex-1"><Row mk={3} label="Rank"><Fld>1</Fld><Hint>lower = higher; blank = by date</Hint></Row></div>
                <div className="flex-1"><Row mk={4} label="Status"><Btn>Draft</Btn> <Btn primary>Published</Btn></Row></div>
              </div>
              <Row mk={5} label="Shown on homepage"><div className="flex items-center gap-2"><span className="w-4 h-4 rounded border border-line inline-flex items-center justify-center text-teal-ink text-[10px]">✓</span><Hint inline>featured in the strip · max 6</Hint></div></Row>
              <Bar><Btn>Save draft</Btn><Btn primary>Save &amp; publish</Btn><span className="ml-1"><Mk n={6} /></span></Bar>
            </Screen>
            <Steps>
              <Step n={1} title="New case study.">Open <UI>Case Studies</UI> → <UI>＋ New case study</UI>. Add the title (slug auto-fills) and the <b>client</b> — only name a client with written consent.</Step>
              <Step n={2} title="Add the detail.">Location, value, duration, service; a cover (<UI>Upload</UI> or paste a URL), an excerpt, and the body in markdown.</Step>
              <Step n={3} title="Set the rank.">Lower number = higher up and always-featured (<UI>1</UI> pins to the top); leave blank to order by date.</Step>
              <Step n={4} title="Choose status."><UI>Draft</UI> = hidden, <UI>Published</UI> = live.</Step>
              <Step n={5} title="Optional — homepage.">Tick <UI>Shown on homepage</UI> to feature it in the strip. <b>Hard cap of 6</b> — turn one off elsewhere to add another.</Step>
              <Step n={6} title="Save & publish."><UI>Save &amp; publish</UI> takes it live and rebuilds the site; <UI>Save draft</UI> keeps it hidden.</Step>
              <Step n={7} title="Ordering & paging.">The page lists 9 per row-set (3×3) by rank then date, then paginates.</Step>
            </Steps>
          </Section>

          {/* GENERAL */}
          {/* ANALYTICS */}
          <Section id="analytics" title="Analytics" intro="How the website is doing — visitor traffic, Google search, and growth over time.">
            <Screen name="Analytics">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-navy">Three sections, one date range</span>
                <span className="inline-flex gap-1"><Chip>7d</Chip><Chip>30d</Chip><Chip>90d</Chip><Chip>1y</Chip></span>
              </div>
              <Row mk={1} label="Traffic · Vercel — visits to the site">
                <div className="flex gap-2"><Stat0 label="Visitors" v="—" /><Stat0 label="Page views" v="—" /><Stat0 label="Views / visitor" v="—" /></div>
              </Row>
              <Row mk={2} label="Search · Google — how people find you">
                <div className="flex gap-2"><Stat0 label="Clicks" v="—" /><Stat0 label="Impressions" v="—" /><Stat0 label="Pages in search" v="—" /></div>
              </Row>
              <Row mk={3} label="Progress over time — captured daily from launch">
                <div className="flex gap-2 items-end h-9">
                  {[3,4,4,6,7,9,11].map((h, i) => <span key={i} className="w-2 rounded-t bg-teal/70" style={{ height: `${h * 3}px` }} />)}
                </div>
              </Row>
            </Screen>
            <Steps>
              <Step n={1} title="Open Analytics.">From the sidebar. Everything respects the <UI>date range</UI> top-right (<UI>7d / 30d / 90d / 1y</UI>) — change it once and all three sections follow.</Step>
              <Step n={2} title="Traffic · Vercel.">Real visits to the public website — <b>visitors</b>, <b>page views</b>, the trend over time, plus top pages, referrers, countries, devices and browsers. Refreshes about every 15 minutes.</Step>
              <Step n={3} title="Search · Google.">How people find you on Google — <b>clicks</b>, <b>impressions</b>, <b>CTR</b>, average <b>position</b>, how many <b>pages</b> and <b>queries</b> you appear for, and your top queries and pages. Google’s data lags ~2–3 days.</Step>
              <Step n={4} title="Be patient at first.">The site was only just submitted to Google, so Search starts at zero and fills in over the coming weeks as Google crawls and ranks it. An empty panel here is normal, not a fault.</Step>
              <Step n={5} title="Progress over time.">A daily snapshot of your search footprint — <b>pages in search</b>, <b>impressions</b> and <b>clicks</b> — so you can watch the site grow from launch. Each sparkline shows the change since the first day recorded.</Step>
              <Step n={6} title="It records itself.">A snapshot is saved automatically the first time someone opens this page each day on the <UI>30d</UI> view. No button to press — just visit now and then so the history keeps building.</Step>
              <Step n={7} title="Reading it together.">Rising <b>impressions</b> = Google is showing you more; rising <b>clicks</b> and falling <b>position</b> (closer to 1) = you’re ranking better; <b>Traffic</b> then shows who actually arrived and what they read.</Step>
            </Steps>
          </Section>

          <Section id="general" title="General" intro="Things that apply across all of Studio.">
            <Steps>
              <Step n={1} title="Login.">Your CindersX account — the same sign-in used for Roadmap and the Brand Hub.</Step>
              <Step n={2} title="Publishing rebuilds the site.">Publishing, editing a published item, or deleting one rebuilds the public website automatically (static HTML for SEO), so changes can take a minute to appear.</Step>
              <Step n={3} title="Scheduling is hands-off.">Scheduled items auto-publish when due, then trigger the rebuild — no need to come back and press publish.</Step>
              <Step n={4} title="Drafts are safe.">Nothing is public until you publish or its scheduled time arrives.</Step>
              <Step n={5} title="Settings.">Coming soon.</Step>
            </Steps>
          </Section>
        </div>
      </aside>
    </div>
  )
}

/* ---- building blocks ---- */
function Section({ id, title, intro, children }: { id: string; title: string; intro: string; children: ReactNode }) {
  return (
    <section id={`help-${id}`} className="scroll-mt-24 mt-8">
      <h3 className="font-head text-sm font-bold uppercase tracking-wide text-navy border-b-2 border-teal pb-1.5">{title}</h3>
      <p className="text-ink-soft text-xs mt-2">{intro}</p>
      {children}
    </section>
  )
}

function Screen({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="bg-surface rounded-xl p-3 my-3">
      <div className="border border-line rounded-lg bg-white overflow-hidden">
        <div className="px-3 py-2 bg-navy text-white text-xs font-semibold">
          <span className="text-teal">Studio</span> · {name}
        </div>
        <div className="p-3.5 space-y-2.5">{children}</div>
      </div>
    </div>
  )
}

function Row({ mk, label, aside, children }: { mk?: number; label: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        {mk != null && <Mk n={mk} />}
        <span className="text-xs font-medium text-ink-soft">{label}</span>
        {aside && <span className="ml-auto">{aside}</span>}
      </div>
      {children}
    </div>
  )
}

function Mk({ n }: { n: number }) {
  return <span className="shrink-0 inline-flex items-center justify-center w-[18px] h-[18px] rounded-full bg-teal/15 text-teal-ink text-[11px] font-semibold">{n}</span>
}
function Fld({ children, bold, tall }: { children: ReactNode; bold?: boolean; tall?: boolean }) {
  return <div className={`border border-line rounded-md px-2.5 py-2 text-xs bg-white ${bold ? 'text-navy font-medium' : 'text-ink-soft'} ${tall ? 'h-12' : ''}`}>{children}</div>
}
function Btn({ children, ai, primary }: { children: ReactNode; ai?: boolean; primary?: boolean }) {
  const cls = primary ? 'bg-teal text-navy border-teal' : ai ? 'text-teal-ink border-teal/40 bg-teal/10' : 'text-navy border-line'
  return <span className={`inline-flex items-center gap-1 border rounded-md px-2 py-1 text-[11px] font-semibold whitespace-nowrap ${cls}`}>{children}</span>
}
function Chip({ children }: { children: ReactNode }) {
  return <span className="border border-line rounded-md px-3 py-1 text-[11px] text-ink-soft bg-surface">{children}</span>
}
function Stat0({ label, v }: { label: string; v: string }) {
  return (
    <div className="flex-1 border border-line rounded-md px-2 py-1.5 bg-white">
      <div className="text-[10px] uppercase tracking-wide text-ink-soft">{label}</div>
      <div className="font-head text-base font-bold text-navy leading-tight">{v}</div>
    </div>
  )
}
function Thumb() {
  return <span className="w-16 h-10 rounded-md bg-surface border border-line inline-flex items-center justify-center text-ink-soft text-xs">▣</span>
}
function Sw({ c }: { c: string }) {
  return <span className="w-6 h-6 rounded-md border border-line inline-block" style={{ background: c }} />
}
function Hint({ children, inline }: { children: ReactNode; inline?: boolean }) {
  return <span className={`text-[11px] text-ink-soft ${inline ? '' : 'block mt-1'}`}>{children}</span>
}
function Bar({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-2 border-t border-line pt-2.5 mt-1">{children}</div>
}
function UI({ children }: { children: ReactNode }) {
  return <code className="font-mono text-xs bg-surface px-1.5 py-0.5 rounded">{children}</code>
}
function Steps({ children }: { children: ReactNode }) {
  return <ol className="list-none p-0 m-0 mt-2">{children}</ol>
}
function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3 items-start py-2.5 border-t border-line text-sm leading-relaxed">
      <span className="shrink-0 mt-0.5 inline-flex items-center justify-center w-[22px] h-[22px] rounded-full bg-navy text-white text-xs font-semibold">{n}</span>
      <div><span className="font-semibold text-navy">{title}</span> {children}</div>
    </li>
  )
}
