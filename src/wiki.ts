// Free film/series lookup through Wikidata + Wikipedia (no account, no key; CORS via origin=*).
// Gives the Ukrainian title, original title, year, kind, genres, runtime and a poster link.
import type { Genre, Kind, Length } from './lib'

const WD = 'https://www.wikidata.org/w/api.php'
const api = async (base: string, params: Record<string, string>) => {
  const q = new URLSearchParams({ format: 'json', origin: '*', ...params })
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(`${base}?${q}`)
    if (r.ok) return r.json()
    // Wikimedia rate-limits bursts: wait a little and try again
    if (r.status !== 429 || attempt >= 4) throw new Error(String(r.status))
    const wait = Number(r.headers.get('retry-after')) * 1000 || 1000 * (attempt + 1)
    await new Promise(ok => setTimeout(ok, Math.min(wait, 20000)))
  }
}

export type Found = {
  wikidata: string
  title: string
  original_title: string | null
  kind: Kind
  year: number | null
  genres: Genre[]
  runtime: number | null
  length: Length | null
  poster_url: string | null
  wiki_url: string | null
  description: string
  // books only
  author?: string | null
  pages?: number | null
  series?: string | null
  series_no?: number | null
}

const FILM = new Set(['Q11424', 'Q24862', 'Q506240', 'Q202866', 'Q93204', 'Q229390', 'Q24869', 'Q17517379', 'Q20650540'])
const SERIES = new Set(['Q5398426', 'Q1259759', 'Q581714', 'Q526877', 'Q63952888', 'Q117467246', 'Q15416', 'Q7725310', 'Q3464665', 'Q21191270'])
const MINISERIES = 'Q1259759'

// English genre labels from Wikidata ("romantic drama film") -> the app's genres
const GENRE_WORDS: [RegExp, Genre][] = [
  [/drama/, 'drama'], [/comed/, 'comedy'], [/science fiction|sci-fi|space/, 'scifi'], [/thriller|suspense/, 'thriller'],
  [/horror/, 'horror'], [/romance|romantic/, 'romance'], [/animat|anime|cartoon/, 'animation'], [/documentar/, 'documentary'],
  [/crime|gangster|heist|detective/, 'crime'], [/fantasy/, 'fantasy'], [/adventure/, 'adventure'], [/action|martial/, 'action'],
  [/family|children/, 'family'], [/histor|biograph|period/, 'history'], [/mystery/, 'mystery'], [/\bwar\b/, 'war'],
  [/musical|music/, 'musical'],
]

type Claim = { mainsnak: { datavalue?: { value: any } } }
type Entity = {
  id: string
  labels?: Record<string, { value: string }>
  descriptions?: Record<string, { value: string }>
  claims?: Record<string, Claim[]>
  sitelinks?: Record<string, { title: string }>
}
const values = (e: Entity, p: string) => (e.claims?.[p] ?? []).map(c => c.mainsnak.datavalue?.value).filter(v => v != null)
const ids = (e: Entity, p: string) => values(e, p).map((v: { id: string }) => v.id)

function kindOf(e: Entity): Kind | null {
  const types = ids(e, 'P31')
  if (types.some(x => SERIES.has(x))) return 'series'
  if (types.some(x => FILM.has(x))) return 'film'
  return null
}

function yearOf(e: Entity) {
  const times = [...values(e, 'P577'), ...values(e, 'P580')].map((v: { time: string }) => Number(v.time.slice(1, 5))).filter(Boolean)
  return times.length ? Math.min(...times) : null
}

function runtimeOf(e: Entity) {
  const v = values(e, 'P2047')[0] as { amount: string; unit: string } | undefined
  if (!v) return null
  const n = Math.abs(Number(v.amount))
  return Math.round(v.unit.endsWith('Q7727') ? n : v.unit.endsWith('Q25235') ? n * 60 : v.unit.endsWith('Q11574') ? n / 60 : n)
}

function lengthOf(e: Entity, kind: Kind, runtime: number | null): Length | null {
  if (kind === 'film') return runtime == null ? null : runtime < 100 ? 'short' : runtime <= 140 ? 'medium' : 'long'
  if (ids(e, 'P31').includes(MINISERIES)) return 'short'
  const seasons = Number((values(e, 'P2437')[0] as { amount: string } | undefined)?.amount ?? 0)
  return !seasons ? null : seasons <= 1 ? 'short' : seasons <= 3 ? 'medium' : 'long'
}

async function entities(list: string[], props = 'labels|descriptions|claims|sitelinks') {
  if (!list.length) return [] as Entity[]
  const d = await api(WD, { action: 'wbgetentities', ids: list.join('|'), props, languages: 'uk|en', sitefilter: 'enwiki|ukwiki' })
  return list.map(id => d.entities?.[id]).filter(Boolean) as Entity[]
}

// Posters: a free poster on Commons (P3383) if there is one, else the lead image of the Wikipedia article.
// Batched: two requests per wiki for the whole list (Wikimedia rate-limits bursts).
async function postersOf(list: Entity[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  for (const e of list) {
    const commons = values(e, 'P3383')[0] as string | undefined
    if (commons) out.set(e.id, `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(commons)}?width=500`)
  }
  for (const wiki of ['enwiki', 'ukwiki']) {
    const todo = list.filter(e => !out.has(e.id) && e.sitelinks?.[wiki])
    if (!todo.length) continue
    const base = `https://${wiki.slice(0, 2)}.wikipedia.org/w/api.php`
    try {
      const p = await api(base, { action: 'query', titles: todo.map(e => e.sitelinks![wiki].title).join('|'), prop: 'pageprops', ppprop: 'page_image', redirects: '1' })
      const norm = new Map<string, string>()
      for (const n of [...(p.query?.normalized ?? []), ...(p.query?.redirects ?? [])]) norm.set(n.from, n.to)
      const fileOf = new Map<string, string>()
      for (const pg of Object.values(p.query?.pages ?? {}) as { title: string; pageprops?: { page_image?: string } }[])
        if (pg.pageprops?.page_image) fileOf.set(pg.title, pg.pageprops.page_image)
      const files = new Map<string, string>()
      for (const e of todo) {
        let tt = e.sitelinks![wiki].title
        while (norm.has(tt)) tt = norm.get(tt)!
        const f = fileOf.get(tt)
        if (f) files.set(e.id, 'File:' + f.replace(/_/g, ' '))
      }
      if (!files.size) continue
      const i = await api(base, { action: 'query', titles: [...new Set(files.values())].join('|'), prop: 'imageinfo', iiprop: 'url', iiurlwidth: '500' })
      const urlOf = new Map<string, string>()
      for (const pg of Object.values(i.query?.pages ?? {}) as { title: string; imageinfo?: { thumburl?: string }[] }[])
        if (pg.imageinfo?.[0]?.thumburl) urlOf.set(pg.title, pg.imageinfo[0].thumburl.replace(/\?.*$/, ''))
      const iNorm = new Map<string, string>((i.query?.normalized ?? []).map((n: { from: string; to: string }) => [n.from, n.to]))
      for (const [id, f] of files) { const u = urlOf.get(iNorm.get(f) ?? f); if (u) out.set(id, u) }
    } catch { /* try the next wiki */ }
  }
  return out
}

async function genresOf(list: Entity[]) {
  const all = [...new Set(list.flatMap(e => ids(e, 'P136')))]
  const labels = new Map<string, string>()
  for (let i = 0; i < all.length; i += 50) {
    const d = await api(WD, { action: 'wbgetentities', ids: all.slice(i, i + 50).join('|'), props: 'labels', languages: 'en' })
    for (const [id, e] of Object.entries(d.entities ?? {})) labels.set(id, (e as Entity).labels?.en?.value ?? '')
  }
  return (e: Entity) => {
    const out = new Set<Genre>()
    for (const id of ids(e, 'P136')) for (const [re, g] of GENRE_WORDS) if (re.test(labels.get(id) ?? '')) out.add(g)
    return [...out]
  }
}

async function build(list: Entity[], limit = 99): Promise<Found[]> {
  const films = list.map(e => [e, kindOf(e)] as const).filter((x): x is [Entity, Kind] => x[1] != null).slice(0, limit)
  const genre = await genresOf(films.map(x => x[0]))
  const posters = await postersOf(films.map(x => x[0]))
  return films.map(([e, kind]) => {
    const runtime = runtimeOf(e)
    const uk = e.labels?.uk?.value, en = e.labels?.en?.value
    const original = (values(e, 'P1476')[0] as { text: string } | undefined)?.text ?? en ?? null
    const title = uk ?? en ?? original ?? e.id
    const wiki = e.sitelinks?.ukwiki ? ['uk', e.sitelinks.ukwiki.title] : e.sitelinks?.enwiki ? ['en', e.sitelinks.enwiki.title] : null
    return {
      wikidata: e.id, title, kind, runtime,
      original_title: original && original !== title ? original : null,
      year: yearOf(e), genres: genre(e), length: lengthOf(e, kind, runtime),
      poster_url: posters.get(e.id) ?? null,
      wiki_url: wiki ? `https://${wiki[0]}.wikipedia.org/wiki/${encodeURIComponent(wiki[1].replace(/ /g, '_'))}` : null,
      description: e.descriptions?.uk?.value ?? e.descriptions?.en?.value ?? '',
    }
  })
}

// Search by title (Ukrainian or English); films and series only, best matches first
export async function searchTitles(text: string, limit = 6): Promise<Found[]> {
  const q = text.trim()
  if (q.length < 2) return []
  const prefix = (l: string) => api(WD, { action: 'wbsearchentities', search: q, language: l, uselang: l, type: 'item', limit: '12' })
    .then(d => (d.search ?? []).map((x: { id: string }) => x.id) as string[]).catch(() => [] as string[])
  // Full-text search limited to films and series finds "Sunrise on the Reaping" inside a longer title
  const types = [...FILM, ...SERIES].slice(0, 12).map(x => 'P31=' + x).join('|')
  const words = api(WD, { action: 'query', list: 'search', srsearch: `${q} haswbstatement:${types}`, srlimit: '8' })
    .then(d => (d.query?.search ?? []).map((x: { title: string }) => x.title) as string[]).catch(() => [] as string[])
  const [uk, en, text2] = await Promise.all([prefix('uk'), prefix('en'), words])
  const order = [...new Set([...uk, ...en, ...text2])].slice(0, 20)
  return build(await entities(order), limit)
}

// Film from a link: IMDb, Letterboxd, Netflix and Wikipedia links are matched exactly
export async function findByUrl(url: string): Promise<Found | null> {
  const rules: [RegExp, string][] = [
    [/imdb\.com\/(?:[a-z]{2}\/)?title\/(tt\d+)/, 'P345'],
    [/letterboxd\.com\/film\/([\w-]+)/, 'P6127'],
    [/netflix\.com\/(?:[a-z-]+\/)?(?:title|watch)\/(\d+)/, 'P1874'],
  ]
  for (const [re, prop] of rules) {
    const m = url.match(re)
    if (!m) continue
    const d = await api(WD, { action: 'query', list: 'search', srsearch: `haswbstatement:${prop}=${m[1]}`, srlimit: '1' })
    const id = d.query?.search?.[0]?.title
    if (id) return (await build(await entities([id])))[0] ?? null
  }
  const wiki = url.match(/\/\/(\w+)\.(?:m\.)?wikipedia\.org\/wiki\/([^?#]+)/)
  if (wiki) {
    const d = await api(WD, { action: 'wbgetentities', sites: wiki[1] + 'wiki', titles: decodeURIComponent(wiki[2]).replace(/_/g, ' '), props: 'info' })
    const id = Object.keys(d.entities ?? {}).find(k => k.startsWith('Q'))
    if (id) return (await build(await entities([id])))[0] ?? null
  }
  return null
}

// One film by its Wikidata id
export async function byId(id: string) {
  return (await build(await entities([id])))[0] ?? null
}
