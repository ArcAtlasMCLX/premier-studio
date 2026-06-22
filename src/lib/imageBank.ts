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

// User-facing styles. 'colourings' = full value-colour grade + wheel arcs (whole image);
// 'cutout' = the same but the subject is kept full-colour over the graded background.
// Both map to the edge function's style:'wheeled' (± cutout).
export type SpotStyle = 'standard' | 'colourings' | 'cutout'
export type WheelColor = 'auto' | 'blue' | 'green' | 'orange' | 'yellow'

export type Ratio = '16:9' | '1:1' | '4:5' | '1.91:1'

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

export interface SpotlightOpts {
  imageId: string
  ratio: Ratio
  headline?: string
  eyebrow?: string
  subhead?: string
  style?: SpotStyle
  color?: WheelColor
}

export interface SpotlightResult {
  url: string
  path: string | null
  color: WheelColor | null
  cutout: boolean
}

// Polish + brand + ratio an Image-Bank photo. Returns the public URL + storage path.
export async function spotlight(opts: SpotlightOpts): Promise<SpotlightResult> {
  const { data, error } = await supabase.functions.invoke('process-image', {
    body: {
      source: 'bank',
      imageId: opts.imageId,
      ratio: opts.ratio,
      headline: opts.headline,
      eyebrow: opts.eyebrow,
      subhead: opts.subhead,
      // Colourings + Cut-out both render as the edge function's 'wheeled' style;
      // only Cut-out triggers background removal.
      style: opts.style === 'standard' ? 'standard' : 'wheeled',
      color: opts.color ?? 'auto',
      cutout: opts.style === 'cutout',
    },
  })
  if (error) throw error
  if (!data?.url) throw new Error(data?.error || 'Spotlight failed')
  return {
    url: data.url as string,
    path: (data.path as string) ?? null,
    color: (data.color as WheelColor) ?? null,
    cutout: Boolean(data.cutout),
  }
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
