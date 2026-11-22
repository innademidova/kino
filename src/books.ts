// Free book lookup through Open Library (no account, no key, CORS allowed).
// Gives the title, author, year, pages, series and a cover. Ukrainian editions are rare there,
// so the cover is usually the original edition's.
import type { Found } from './wiki'
import type { Genre, Length } from './lib'

const SUBJECT_WORDS: [RegExp, Genre][] = [
  [/fantasy|magic|witch/, 'fantasy'], [/romance|love stor/, 'romance'], [/thriller|suspense/, 'thriller'],
  [/mystery|detective/, 'mystery'], [/crime|murder/, 'crime'], [/horror/, 'horror'], [/science fiction|dystopia/, 'scifi'],
  [/historical/, 'history'], [/war\b/, 'war'], [/adventure/, 'adventure'], [/humor|comic/, 'comedy'], [/drama/, 'drama'],
]

export const bookLength = (pages: number | null): Length | null =>
  pages == null ? null : pages < 250 ? 'short' : pages <= 450 ? 'medium' : 'long'

type Doc = {
  key: string; title: string; author_name?: string[]; first_publish_year?: number; cover_i?: number
  number_of_pages_median?: number; subject?: string[]; series_name?: string[]; series_position?: string[]
}

const FIELDS = 'key,title,author_name,first_publish_year,cover_i,number_of_pages_median,subject,series_name,series_position'

function toFound(d: Doc): Found {
  const subjects = (d.subject ?? []).join(' | ').toLowerCase()
  const genres = [...new Set(SUBJECT_WORDS.filter(([re]) => re.test(subjects)).map(([, g]) => g))].slice(0, 4)
  const pages = d.number_of_pages_median ?? null
  return {
    wikidata: d.key, title: d.title, original_title: null, kind: 'book', year: d.first_publish_year ?? null,
    genres, runtime: null, length: bookLength(pages),
    poster_url: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg` : null,
    wiki_url: `https://openlibrary.org${d.key}`,
    description: (d.author_name ?? []).slice(0, 2).join(', '),
    author: d.author_name?.[0] ?? null, pages,
    series: d.series_name?.[0] ?? null,
    series_no: d.series_position?.[0] && /^\d+$/.test(d.series_position[0]) ? Number(d.series_position[0]) : null,
  }
}

export async function searchBooks(text: string, limit = 6): Promise<Found[]> {
  const q = text.trim()
  if (q.length < 2) return []
  const p = new URLSearchParams({ q, limit: String(limit), fields: FIELDS })
  const r = await fetch(`https://openlibrary.org/search.json?${p}`)
  if (!r.ok) throw new Error(String(r.status))
  const d = await r.json() as { docs?: Doc[] }
  return (d.docs ?? []).map(toFound)
}
