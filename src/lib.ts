import { createClient } from '@supabase/supabase-js'
import { t, locale } from './i18n'

// Publishable key of the Supabase project "Perfumes" (shared with the perfume diary): data is protected by RLS and login
export const supabase = createClient(
  'https://eyczhhvxuofvfeoqwfbg.supabase.co',
  'sb_publishable_cwDfk3jZoFSZAnyAsO2kjQ_zmUNoXog',
)

export type Kind = 'film' | 'series'
export type Status = 'want' | 'watching' | 'watched'
export type Length = 'short' | 'medium' | 'long'
export const STATUSES: Status[] = ['want', 'watching', 'watched']
export const LENGTHS: Length[] = ['short', 'medium', 'long']
export const GENRES = ['drama', 'comedy', 'romance', 'scifi', 'thriller', 'horror', 'crime', 'mystery', 'fantasy',
  'adventure', 'action', 'animation', 'family', 'history', 'war', 'documentary', 'musical'] as const
export type Genre = typeof GENRES[number]
export const MOODS = ['light', 'cry', 'think', 'scary'] as const
export const MOOD_EMOJI: Record<string, string> = { light: '☀️', cry: '😭', think: '🤔', scary: '😱' }
export const KIND_EMOJI: Record<Kind, string> = { film: '🎬', series: '📺' }
// Suggestions for "where to watch" (free text, these are just quick picks)
export const SERVICES = ['Netflix', 'Megogo', 'Sweet.tv', 'Kyivstar TV', 'Prime Video', 'Apple TV+', 'Disney+', 'HBO Max', 'YouTube']

export type Item = {
  id: string
  title: string
  original_title: string | null
  kind: Kind
  year: number | null
  genres: string[]
  status: Status
  favorite: boolean
  rewatch: boolean
  where_to_watch: string | null
  source: string | null
  url: string | null
  note: string | null
  poster_url: string | null
  photos: string[]
  rating: number | null
  impression: string | null
  length: Length | null
  runtime: number | null
  moods: string[]
  wikidata: string | null
  wiki_url: string | null
  watched_on: string | null
  created_at: string
  updated_at: string
}

export const todayISO = () => {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}
export const formatDate = (d: string) =>
  new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d + 'T00:00:00'))

// "2 h 49 min"
export function formatRuntime(min: number | null) {
  if (!min) return ''
  const h = Math.floor(min / 60), m = min % 60
  return h ? t('item.hm', { h, m }) : t('item.m', { m })
}

export const lengthLabel = (kind: Kind, l: Length) => t(`length.${kind}.${l}`)

// ---------- links ----------

export function normalizeUrl(raw: string) {
  const s = raw.trim()
  if (!s) return ''
  if (/^https?:\/\//i.test(s)) return s
  if (/^[\w-]+(\.[\w-]+)+(\/|$)/.test(s)) return 'https://' + s
  return s
}
export const isUrl = (s: string) => /^https?:\/\/\S+$/i.test(normalizeUrl(s))

// Pulls a link out of shared text ("Look at this! https://…")
export function extractUrl(text: string) {
  const m = text.match(/https?:\/\/\S+/i)
  return m ? m[0].replace(/[),.]+$/, '') : isUrl(text) ? normalizeUrl(text) : ''
}

export function hostOf(url: string) {
  try { return new URL(normalizeUrl(url)).hostname.replace(/^www\./, '') } catch { return '' }
}

// Title guessed from a link's path ("letterboxd.com/film/dear-john/" -> "Dear John"); empty for reels and the like
export function guessTitle(url: string) {
  try {
    const u = new URL(normalizeUrl(url))
    if (/instagram|tiktok|youtu|facebook|t\.me|threads/.test(u.hostname)) return ''
    const seg = u.pathname.split('/').filter(s => s && !/^(film|movie|movies|title|titles|watch|series|tv|ua|uk|en|wiki)$/i.test(s) && !/^\d+$/.test(s))
    const last = seg[seg.length - 1]
    if (!last || /^tt\d+$/.test(last)) return ''
    return decodeURIComponent(last).replace(/\.\w+$/, '').replace(/[-_+]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim()
  } catch { return '' }
}

// ---------- photos ----------

const FULL = 1600
const THUMB = 600
const BUCKET = 'watch'

const canvasOf = (w: number, h: number) => {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h))
  return c
}

// Stepped downscale keeps photos sharp
function downscale(src: CanvasImageSource & { width: number; height: number }, max: number) {
  let cur: CanvasImageSource = src
  let w = src.width, h = src.height
  const target = Math.min(1, max / Math.max(w, h))
  const tw = w * target, th = h * target
  while (w / 2 >= tw) {
    w /= 2; h /= 2
    const c = canvasOf(w, h); const ctx = c.getContext('2d')!
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(cur, 0, 0, c.width, c.height); cur = c
  }
  const c = canvasOf(tw, th); const ctx = c.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(cur, 0, 0, c.width, c.height)
  return c
}

function toBlob(c: HTMLCanvasElement, type: string, q?: number) {
  return new Promise<Blob>((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error(t('error.photo')))), type, q))
}
async function encode(c: HTMLCanvasElement) {
  const webp = await toBlob(c, 'image/webp', 0.88)
  return webp.type === 'image/webp' ? webp : toBlob(c, 'image/jpeg', 0.88)
}
const extOf = (b: Blob) => (b.type === 'image/webp' ? 'webp' : 'jpg')

// Thumbnail path of a photo: <uuid>.webp -> <uuid>_t.webp
export const thumbOf = (path: string) => path.replace(/\.(\w+)$/, '_t.$1')

// Compresses and uploads a photo (full + thumbnail); returns the full photo's path
export async function uploadPhoto(file: Blob) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error(t('error.signIn'))
  const bitmap = await createImageBitmap(file)
  const full = await encode(downscale(bitmap, FULL))
  const thumb = await encode(downscale(bitmap, THUMB))
  bitmap.close?.()
  const path = `${user.id}/${crypto.randomUUID()}.${extOf(full)}`
  for (const [p, blob] of [[path, full], [thumbOf(path), thumb]] as const) {
    const { error } = await supabase.storage.from(BUCKET).upload(p, blob, { contentType: blob.type })
    if (error) throw error
  }
  return path
}

export async function removePhotos(...paths: (string | null | undefined)[]) {
  const list = paths.filter((p): p is string => !!p).flatMap(p => [p, thumbOf(p)])
  if (list.length) await supabase.storage.from(BUCKET).remove(list)
}

// Signed URLs, requested in batches and cached for most of their 24h life
const signed = new Map<string, { url: string; until: number }>()
let pending: { path: string; resolve: (u: string) => void }[] = []
let timer: number | null = null

export function signedUrl(path: string): Promise<string> {
  const hit = signed.get(path)
  if (hit && hit.until > Date.now()) return Promise.resolve(hit.url)
  return new Promise(resolve => {
    pending.push({ path, resolve })
    if (timer == null) timer = window.setTimeout(flush, 10)
  })
}
export const cachedUrl = (path: string) => {
  const hit = signed.get(path)
  return hit && hit.until > Date.now() ? hit.url : null
}

async function flush() {
  const batch = pending; pending = []; timer = null
  const paths = [...new Set(batch.map(b => b.path))]
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 86400)
  const until = Date.now() + 20 * 3600000
  for (const row of data ?? []) if (row.path && row.signedUrl) signed.set(row.path, { url: row.signedUrl, until })
  for (const b of batch) b.resolve(signed.get(b.path)?.url ?? '')
}

// Soft gradient cover for trips without a photo, stable for the same title
export function gradientFor(seed: string) {
  let h = 0
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const a = h % 360, b = (a + 40 + (h >> 9) % 60) % 360
  return `linear-gradient(135deg, hsl(${a} 55% 62%), hsl(${b} 60% 45%))`
}


// Moods guessed from genres, used until she picks moods herself
const MOOD_FROM_GENRE: Record<string, string> = {
  comedy: 'light', family: 'light', animation: 'light', musical: 'light', adventure: 'light',
  drama: 'cry', romance: 'cry', war: 'cry',
  scifi: 'think', mystery: 'think', documentary: 'think', history: 'think', crime: 'think',
  horror: 'scary', thriller: 'scary',
}
export function moodsOf(item: Pick<Item, 'moods' | 'genres'>) {
  if (item.moods.length) return { moods: item.moods, guessed: false }
  return { moods: [...new Set(item.genres.map(g => MOOD_FROM_GENRE[g]).filter(Boolean))], guessed: true }
}
