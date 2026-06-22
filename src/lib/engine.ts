import { supabase } from './supabase'

export interface GenJob {
  id: string
  status: 'running' | 'complete' | 'failed'
  progress: number
  total: number
  message: string | null
}

// Kick off a batch run: generate `count` insight drafts on a theme. Returns the job id.
// Drafts land in studio.insights as 'pending_review' for an author to review + publish.
export async function startBatch(
  theme: string,
  count: number,
  previousTitles: string[],
): Promise<string> {
  // Slots are scheduling placeholders (one per draft, spread out). Drafts are
  // pending_review regardless — slots just seed scheduled_at for later.
  const slots: string[] = []
  for (let i = 0; i < count; i++) {
    const d = new Date()
    d.setDate(d.getDate() + i + 1)
    d.setHours(9, 0, 0, 0)
    slots.push(d.toISOString())
  }
  const { data, error } = await supabase.functions.invoke('generate-batch', {
    body: { theme, slots, previousTitles },
  })
  if (error) throw new Error(await functionErrorMessage(error))
  return (data?.job_id ?? '') as string
}

// supabase-js reports a non-2xx as a generic message; dig out the function's own
// { error } body so the UI shows what actually went wrong.
async function functionErrorMessage(error: unknown): Promise<string> {
  const ctx = (error as { context?: Response }).context
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = await ctx.json()
      if (body?.error) return typeof body.error === 'string' ? body.error : JSON.stringify(body.error)
    } catch {
      /* fall through */
    }
  }
  return error instanceof Error ? error.message : String(error)
}

export async function getJob(id: string): Promise<GenJob | null> {
  const { data } = await supabase
    .from('generation_jobs')
    .select('id, status, progress, total, message')
    .eq('id', id)
    .single()
  return (data ?? null) as GenJob | null
}
