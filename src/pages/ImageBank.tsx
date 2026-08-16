import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  listImages,
  uploadImage,
  signedThumb,
  deleteImage,
  type ImageBankItem,
} from '../lib/imageBank'

export function ImageBank() {
  const [items, setItems] = useState<ImageBankItem[]>([])
  const [thumbs, setThumbs] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function refresh() {
    setLoading(true)
    try {
      const rows = await listImages()
      setItems(rows)
      const entries = await Promise.all(
        rows.map(async (r) =>
          // Spotlight outputs are public; uploaded sources need a signed URL.
          [r.id, r.public_url ?? (await signedThumb(r.storage_path)) ?? ''] as const,
        ),
      )
      setThumbs(Object.fromEntries(entries))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return
    setBusy(true)
    setError(null)
    try {
      for (const file of Array.from(files)) {
        await uploadImage(file)
      }
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function onDelete(item: ImageBankItem) {
    if (!confirm('Remove this image from the bank?')) return
    try {
      await deleteImage(item)
      setItems((xs) => xs.filter((x) => x.id !== item.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const uploads = items.filter((i) => !i.public_url)
  const spotlights = items.filter((i) => i.public_url)

  return (
    <div className="max-w-5xl mx-auto px-8 py-8">
      <div className="flex items-start justify-between gap-4 mb-2">
        <h1 className="font-head text-2xl font-bold text-navy">Image Bank</h1>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg"
            multiple
            onChange={onUpload}
            className="hidden"
            id="imgupload"
          />
          <label
            htmlFor="imgupload"
            className={`inline-block px-5 py-2.5 rounded-lg bg-teal text-navy font-head font-semibold cursor-pointer ${
              busy ? 'opacity-60 pointer-events-none' : ''
            }`}
          >
            {busy ? 'Uploading…' : '＋ Upload images'}
          </label>
        </div>
      </div>
      <p className="text-ink-soft text-sm mb-6">
        Upload reusable photos (PNG or JPEG — you can select several at once). The full-size
        original is kept here; open one in{' '}
        <Link to="/spotlight" className="text-teal-ink font-semibold">Spotlight</Link> to crop it to a
        ratio and apply the Premier brand treatment.
      </p>

      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-ink-soft text-sm">Loading…</p>
      ) : items.length === 0 ? (
        <div className="bg-white border border-line rounded-xl p-10 text-center text-ink-soft">
          No images yet — upload one to get started.
        </div>
      ) : (
        <div className="space-y-10">
          <section>
            <h2 className="font-head text-sm font-bold uppercase tracking-wide text-ink-soft mb-3">Your images</h2>
            {uploads.length === 0 ? (
              <p className="text-ink-soft text-sm">No source images yet — upload some to spotlight.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {uploads.map((item) => (
                  <BankCard key={item.id} item={item} thumb={thumbs[item.id]} onDelete={() => onDelete(item)} />
                ))}
              </div>
            )}
          </section>
          <section>
            <h2 className="font-head text-sm font-bold uppercase tracking-wide text-ink-soft mb-3">Spotlights</h2>
            {spotlights.length === 0 ? (
              <p className="text-ink-soft text-sm">No saved spotlights yet — spotlight an image, then “Save to bank”.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {spotlights.map((item) => (
                  <BankCard key={item.id} item={item} thumb={thumbs[item.id]} onDelete={() => onDelete(item)} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

function BankCard({
  item,
  thumb,
  onDelete,
}: {
  item: ImageBankItem
  thumb?: string
  onDelete: () => void
}) {
  return (
    <div className="bg-white border border-line rounded-xl overflow-hidden">
      <div className="aspect-square bg-surface">
        {thumb ? <img src={thumb} alt={item.alt_text ?? item.title ?? ''} className="w-full h-full object-cover" /> : null}
      </div>
      <div className="p-3">
        <div className="text-xs font-medium text-navy truncate" title={item.title ?? ''}>
          {item.title ?? 'Untitled'}
        </div>
        <div className="flex items-center gap-3 mt-2">
          {item.public_url ? (
            <a href={item.public_url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-teal-ink">
              Open ↗
            </a>
          ) : (
            <Link to={`/spotlight/${item.id}`} className="text-xs font-semibold text-teal-ink">✦ Spotlight</Link>
          )}
          <button onClick={onDelete} className="text-xs text-ink-soft hover:text-red-600">Delete</button>
        </div>
      </div>
    </div>
  )
}
