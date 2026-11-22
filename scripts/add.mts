// Adds films/series from chat: looks each one up on Wikidata and inserts it for the owner.
//   node --experimental-strip-types scripts/add.mts spec.json
// spec.json: [{ "q": "Interstellar", "id": "Q13417189"?, "status": "want|watching|watched", "rating": 10?, "rewatch": true? }]
// "dry": true only prints the candidates. With "id" the Wikidata item is taken as is; without it, the first film/series found for "q".
// Wikimedia rate-limits hard: one title at a time, a User-Agent, pauses.
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const plain = globalThis.fetch
globalThis.fetch = ((u: string, o: RequestInit = {}) => plain(u, { ...o, headers: { 'User-Agent': 'kino-personal-app/1.0 (add script)' } })) as typeof fetch
const W = await import('../src/wiki.ts')
const B = await import('../src/books.ts')

const OWNER = '7b26ed3f-e90a-47cd-ba1d-fd7ff640f2f6'
const q = (v: unknown) => v == null ? 'null' : typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : String(v)
const spec = JSON.parse(readFileSync(process.argv[2], 'utf8')) as { q: string; id?: string; status?: string; rating?: number; rewatch?: boolean; dry?: boolean
  // books: "book": true, "q" = Open Library search (English works best), the rest overrides what it finds
  book?: boolean; title?: string; author?: string; series?: string; series_no?: number }[]

async function addBook(s: (typeof spec)[number]) {
  const found = s.q ? (await B.searchBooks(s.q, 1))[0] : undefined
  if (s.dry) { console.log('?', s.q, '|', found ? [found.title, found.author, found.year, found.series, found.series_no, found.pages, found.poster_url].join(' | ') : 'nothing'); return }
  const title = s.title ?? found?.title ?? s.q
  const sql = `insert into watch_items (user_id, kind, title, original_title, author, series, series_no, year, pages, length, genres, status,
    rating, poster_url, ol_key, wiki_url) select ${q(OWNER)}, 'book', ${q(title)}, ${q(found && found.title !== title ? found.title : null)},
    ${q(s.author ?? found?.author ?? null)}, ${q(s.series ?? found?.series ?? null)}, ${q(s.series_no ?? found?.series_no ?? null)},
    ${q(found?.year ?? null)}, ${q(found?.pages ?? null)}, ${q(found?.length ?? null)}, array[${(found?.genres ?? []).map(q).join(',')}]::text[],
    ${q(s.status ?? 'want')}, ${q(s.rating ?? null)}, ${q(found?.poster_url ?? null)}, ${q(found?.wikidata ?? null)}, ${q(found?.wiki_url ?? null)}
    where not exists (select 1 from watch_items where kind = 'book' and title = ${q(title)})`
  execFileSync('node', ['scripts/sql.mjs', sql], { stdio: 'ignore' })
  console.log('OK book', s.status ?? 'want', title, '|', found ? `${found.title} / ${found.author}` : 'not found', found?.poster_url ? 'cover' : 'no cover')
}

for (const s of spec) {
  if (s.book) { await addBook(s); await new Promise(ok => setTimeout(ok, 1500)); continue }
  if (s.dry) {
    for (const x of await W.searchTitles(s.q, 4)) console.log('?', s.q, '|', x.wikidata, x.title, x.year, x.kind, '|', x.description)
    await new Promise(ok => setTimeout(ok, 4000)); continue
  }
  const f = s.id ? await W.byId(s.id) : (await W.searchTitles(s.q, 1))[0]
  if (!f) { console.log('NOT FOUND', s.q); continue }
  const status = s.status ?? 'want'
  const sql = `insert into watch_items (user_id, title, original_title, kind, year, genres, status, rating, rewatch, runtime, length,
    poster_url, wikidata, wiki_url, watched_on) select ${q(OWNER)}, ${q(f.title)}, ${q(f.original_title)}, ${q(f.kind)}, ${q(f.year)},
    array[${f.genres.map(q).join(',')}]::text[], ${q(status)}, ${q(s.rating ?? null)}, ${s.rewatch ? 'true' : 'false'}, ${q(f.runtime)},
    ${q(f.length)}, ${q(f.poster_url)}, ${q(f.wikidata)}, ${q(f.wiki_url)}, null
    where not exists (select 1 from watch_items where wikidata = ${q(f.wikidata)})`
  execFileSync('node', ['scripts/sql.mjs', sql], { stdio: 'ignore' })
  console.log('OK', status, s.rating ?? '', f.title, f.year, f.kind, f.poster_url ? 'poster' : 'no poster')
  await new Promise(ok => setTimeout(ok, 4000))
}
