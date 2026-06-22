import { supabase } from './supabase'
import type { AiCard } from '../types'

// Thin client for the studio-assistant edge function. The user's session token is
// attached automatically by supabase-js; the function gates on studio.is_author().

// Generate 5 "Ask AI" cards tailored to the article. The author then picks 2 or 4.
export async function generatePrompts(input: {
  title: string
  excerpt: string
  content: string
}): Promise<AiCard[]> {
  const { data, error } = await supabase.functions.invoke('generate-prompts', { body: input })
  if (error) throw error
  return (data?.cards ?? []) as AiCard[]
}

export async function suggestTags(title: string, excerpt: string): Promise<string[]> {
  const { data, error } = await supabase.functions.invoke('studio-assistant', {
    body: { mode: 'tags', title, excerpt },
  })
  if (error) throw error
  return (data?.tags ?? []) as string[]
}

export async function assistWrite(
  messages: { role: 'user' | 'assistant'; content: string }[],
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('studio-assistant', {
    body: { messages },
  })
  if (error) throw error
  return (data?.suggestion ?? '') as string
}

// Generate a cover image (returns a public URL). Needs the generate-image function
// deployed + OPENAI_API_KEY set.
export async function generateCover(title: string, excerpt: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('generate-image', {
    body: { title, excerpt },
  })
  if (error) throw error
  return (data?.url ?? '') as string
}
