export type InsightStatus = 'draft' | 'pending_review' | 'scheduled' | 'published'

// A generated "Ask AI" card shown on the published insight page.
export interface AiCard {
  title: string
  description: string
  prompt: string
}

export interface Insight {
  id: string
  title: string
  slug: string
  subtitle: string | null
  excerpt: string | null
  content: string
  cover_image_url: string | null
  tags: string[]
  status: InsightStatus
  scheduled_at: string | null
  published_at: string | null
  ai_prompts: string[]
  ai_cards: AiCard[]
  author_id: string | null
  created_at: string
  updated_at: string
}

// The editable surface — mirrors studio.insights minus DB-managed columns.
export type InsightDraft = Pick<
  Insight,
  | 'title'
  | 'slug'
  | 'subtitle'
  | 'excerpt'
  | 'content'
  | 'cover_image_url'
  | 'tags'
  | 'status'
  | 'scheduled_at'
  | 'published_at'
  | 'ai_prompts'
  | 'ai_cards'
>

// ── Signal (LinkedIn content pipeline) ───────────────────────────────────────
export type ContentInsightStatus = 'raw' | 'used' | 'archived'

export interface ContentInsight {
  id: string
  summary: string
  detail: string | null
  sector: string | null
  metric: string | null
  source_type: string | null
  source_ref: string | null
  anonymised: boolean
  tags: string[]
  status: ContentInsightStatus
  created_at: string
}

export type ContentPostStatus =
  | 'idea'
  | 'drafted'
  | 'in_review'
  | 'approved'
  | 'scheduled'
  | 'posted'
  | 'archived'

export interface ContentPost {
  id: string
  insight_id: string | null
  source_insight_id: string | null
  body: string
  hook: string | null
  variant_label: string | null
  cta_type: string | null
  image_url: string | null
  status: ContentPostStatus
  scheduled_for: string | null
  posted_at: string | null
  linkedin_url: string | null
  notes: string | null
  created_at: string
  updated_at: string
}
