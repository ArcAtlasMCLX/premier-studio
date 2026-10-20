import { supabase } from './supabase'

export interface ImageBankItem {
  id: string
  storage_path: string
  public_url: string | null
  title: string | null
  alt_text: string | null
  tags: string[]
  width: number | null
  height: number | null
  mime_type: string | null
  uploaded_by: string | null
  created_at: string
}

const BUCKET = 'studio-images'
// The compositor can't decode WebP/HEIC, so we guard uploads at the source.
const ACCEPTED = ['image/png', 'image/jpeg']

export async function listImages(): Promise<ImageBankItem[]> {
  const { data, error } = await supabase
    .from('image_bank')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as ImageBankItem[]
}

async function readDims(file: File): Promise<{ width: number; height: number }> {
  try {
    const bmp = await createImageBitmap(file)
    const dims = { width: bmp.width, height: bmp.height }
    bmp.close?.()
    return dims
  } catch {
    return { width: 0, height: 0 }
  }
}

export async function uploadImage(file: File, title?: string): Promise<ImageBankItem> {
  if (!ACCEPTED.includes(file.type)) {
    throw new Error('Please upload a PNG or JPEG — WebP/HEIC aren’t supported.')
  }
  const { data: userData } = await supabase.auth.getUser()
  const ext = file.type === 'image/png' ? 'png' : 'jpg'
  const path = `${crypto.randomUUID()}.${ext}`
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type })
  if (upErr) throw upErr
  const { width, height } = await readDims(file)
  const { data, error } = await supabase
    .from('image_bank')
    .insert({
      storage_path: path,
      title: title || file.name,
      mime_type: file.type,
      width,
      height,
      uploaded_by: userData.user?.id ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return data as ImageBankItem
}

// studio-images is private, so thumbnails need a short-lived signed URL.
export async function signedThumb(path: string, expires = 3600): Promise<string | null> {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, expires)
  return data?.signedUrl ?? null
}

export async function deleteImage(item: ImageBankItem): Promise<void> {
  // Uploaded sources live in the private studio-images bucket — remove the object too.
  // Spotlight outputs (public_url set) live in studio-insights and may be referenced
  // as a cover/signal, so only drop the bank row, not the underlying file.
  if (!item.public_url) {
    await supabase.storage.from(BUCKET).remove([item.storage_path])
  }
  const { error } = await supabase.from('image_bank').delete().eq('id', item.id)
  if (error) throw error
}

export interface SpotlightResult {
  url: string
  path: string | null
}

// supabase-js collapses every non-2xx from an edge function into the same opaque
// message ("Edge Function returned a non-2xx status code"). Dig the real status +
// reason out of error.context (the underlying Response) and phrase it for a human,
// always tagged with a "Code: N2XX·<status>" reference so a support report is precise.
async function friendlyFunctionError(error: unknown): Promise<string> {
  const ctx = (error as { context?: Response }).context
  let status = 0
  let reason = ''
  if (ctx && typeof ctx.status === 'number') {
    status = ctx.status
    try {
      const body = await ctx.clone().json()
      if (body?.error) reason = typeof body.error === 'string' ? body.error : JSON.stringify(body.error)
    } catch {
      // No JSON body — e.g. a 546 where the isolate was killed mid-request.
    }
  }
  const code = status ? `Code: N2XX·${status}` : 'Code: N2XX'
  if (reason) return `${reason} (${code})`
  if (status === 546) {
    return `That photo was too large or complex to process — try a smaller image. (${code})`
  }
  if (status === 504 || status === 408) return `The image service timed out — please try again. (${code})`
  if (status === 429) return `The image service is busy right now — wait a moment and try again. (${code})`
  if (status >= 500) return `The image service hit a problem — please try again. (${code})`
  return `Couldn’t cut out the subject — please try again. (${code})`
}

// The raw source photo, as bytes, from the private bucket. Spotlight draws it on a
// canvas, and a Blob keeps the canvas untainted (a cross-origin <img> would block export).
export async function downloadSource(path: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path)
  if (error || !data) throw new Error('Could not read the source image')
  return data
}

// Ask the edge function for the background-removed subject only (Replicate, ~5–10 s).
// Compositing then happens in the browser — see lib/spotlightCanvas.ts.
// Returns the subject PNG plus its public URL, so the workshop can remember the
// cut-out per photo and reload it without another Replicate call.
export async function cutoutSubject(imageId: string): Promise<{ blob: Blob; url: string }> {
  const { data, error } = await supabase.functions.invoke('process-image', {
    body: { op: 'cutout', source: 'bank', imageId },
  })
  if (error) throw new Error(await friendlyFunctionError(error))
  if (!data?.subjectUrl) {
    throw new Error(String(data?.error || 'Couldn’t cut out the subject — please try again.'))
  }
  const url = data.subjectUrl as string
  return { blob: await fetchSubject(url), url }
}

export async function fetchSubject(url: string): Promise<Blob> {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Could not fetch the cut-out subject')
  return res.blob()
}

// Store a finished Spotlight PNG (rendered in the browser) in the public bucket.
export async function uploadSpotlight(png: Blob): Promise<SpotlightResult> {
  const path = `spotlights/spotlight-${Date.now()}.png`
  const { error } = await supabase.storage
    .from('studio-insights')
    .upload(path, png, { contentType: 'image/png', upsert: false })
  if (error) throw error
  const { data } = supabase.storage.from('studio-insights').getPublicUrl(path)
  return { url: data.publicUrl, path }
}

// Spotlight outputs live in the public studio-insights bucket. Derive the path from
// the public URL when the function didn't return one (older deploy).
function spotlightPath(url: string, path: string | null): string {
  if (path) return path
  const marker = '/studio-insights/'
  const i = url.indexOf(marker)
  return i >= 0 ? url.slice(i + marker.length) : url
}

// Save a finished Spotlight back into the bank so it's listed, reusable and copyable.
export async function saveSpotlightToBank(result: SpotlightResult, title?: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser()
  const { error } = await supabase.from('image_bank').insert({
    storage_path: spotlightPath(result.url, result.path),
    public_url: result.url,
    title: title || 'Spotlight',
    mime_type: 'image/png',
    uploaded_by: userData.user?.id ?? null,
  })
  if (error) throw error
}
