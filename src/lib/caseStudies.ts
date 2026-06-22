import { supabase } from './supabase'

export interface CaseStudy {
  id: string
  slug: string
  title: string
  client: string | null
  location: string | null
  value: string | null
  duration: string | null
  service: string | null
  cover_image_url: string | null
  excerpt: string | null
  body: string
  study_date: string | null
  rank: number | null
  show_on_homepage: boolean
  status: 'draft' | 'published'
  created_at?: string
  updated_at?: string
}

export type CaseStudyDraft = Omit<CaseStudy, 'id' | 'created_at' | 'updated_at'>

export const HOMEPAGE_CAP = 6

export function slugify(text: string): string {
  return text.toLowerCase().trim()
    .replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

export async function listCaseStudies(): Promise<CaseStudy[]> {
  const { data, error } = await supabase
    .from('case_studies')
    .select('*')
    .order('rank', { ascending: true, nullsFirst: false })
    .order('study_date', { ascending: false })
  if (error) throw error
  return (data ?? []) as CaseStudy[]
}

export async function getCaseStudy(id: string): Promise<CaseStudy> {
  const { data, error } = await supabase.from('case_studies').select('*').eq('id', id).single()
  if (error) throw error
  return data as CaseStudy
}

// How many PUBLISHED studies are currently flagged for the homepage (cap = 6).
export async function homepageCount(): Promise<number> {
  const { count, error } = await supabase
    .from('case_studies')
    .select('id', { count: 'exact', head: true })
    .eq('show_on_homepage', true)
    .eq('status', 'published')
  if (error) throw error
  return count ?? 0
}

export async function createCaseStudy(draft: CaseStudyDraft): Promise<CaseStudy> {
  const { data: userData } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('case_studies')
    .insert({ ...draft, author_id: userData.user?.id ?? null })
    .select().single()
  if (error) throw error
  return data as CaseStudy
}

export async function updateCaseStudy(id: string, patch: Partial<CaseStudyDraft>): Promise<CaseStudy> {
  const { data, error } = await supabase.from('case_studies').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data as CaseStudy
}

export async function deleteCaseStudy(id: string): Promise<void> {
  const { error } = await supabase.from('case_studies').delete().eq('id', id)
  if (error) throw error
}

// Rebuild the public site (author-gated; holds the deploy hook server-side).
export async function triggerRebuild(): Promise<void> {
  try {
    await supabase.functions.invoke('trigger-rebuild', { body: {} })
  } catch {
    /* non-fatal */
  }
}
