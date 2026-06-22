# Premier Compliance — Studio

Internal back office for the public website's content (Insights now; Signal,
case studies, etc. later). Part of the same repo as the public site (they share
the content DB); deployed as its **own** Vercel project rooted at this `studio/`
directory.

## Stack
Vite + React + TypeScript + Tailwind + Supabase. No content is committed here —
it lives in the CindersX Supabase project's isolated `studio` schema (see
`../supabase/migrations/`).

## Auth
Single sign-on via the CindersX Supabase project. Access is **fail-closed**: only
users whose `cx_user_roles.role` is in the allowlist (`super`, `senior`,
`sub_super`) pass the `studio.is_author()` gate. Enforcement is server-side via
RLS on every table; the client check is UX only.

## Local dev
```bash
cp .env.example .env      # fill in VITE_SUPABASE_URL + anon key
npm install
npm run dev
```

## Publish loop
Publishing an insight sets `status = 'published'` in `studio.insights`, then
(M2) triggers a Vercel deploy hook that rebuilds the public site via
`../build-insights.py` in `INSIGHTS_SOURCE=supabase` mode — keeping every page
static and indexable.

## Status
- **M1 (this scaffold):** auth gate + Insights list/editor.
- **M2:** wire Publish → rebuild.
- **M3:** AI write-assist / tags / batch / cover images (edge functions).
- **M4:** Signal / LinkedIn board.
