import { useMemo, useState } from 'react'
import { t } from './i18n'
import { GENRES, KIND_EMOJI, sectionOf, seriesBooks, sk, type Item, type Kind, type Section, type Status } from './lib'
import { useStore } from './store'
import { Icon, Poster } from './ui'

// "book 2 of 3": the total is the larger of her books in the series and the highest number
export function seriesPlace(items: Item[], item: Item) {
  const all = seriesBooks(items, item)
  if (!all.length) return null
  const total = Math.max(all.length, ...all.map(x => x.series_no ?? 0))
  // Only her one book of a series: the real total is unknown, so no "of N"
  return { all, total: all.length > 1 ? total : null, n: item.series_no }
}

// A series stays together, in reading order, where its first book would be
function keepSeriesTogether(list: Item[]) {
  const key = (x: Item) => x.kind === 'book' && x.series ? x.series.trim().toLowerCase() : null
  const done = new Set<string>()
  const out: Item[] = []
  for (const x of list) {
    const k = key(x)
    if (!k) { out.push(x); continue }
    if (done.has(k)) continue
    done.add(k)
    out.push(...list.filter(y => key(y) === k).sort((a, b) => (a.series_no ?? 99) - (b.series_no ?? 99)))
  }
  return out
}

export function ItemCard({ item }: { item: Item }) {
  const { items } = useStore()
  const place = item.kind === 'book' ? seriesPlace(items, item) : null
  return (
    <a className="film-card" href={`#/i/${item.id}`}>
      <Poster item={item}>
        {place && place.n && <span className="series-pill pill glass">📚 {place.total ? `${place.n}/${place.total}` : `#${place.n}`}</span>}
        <span className="cover-pills">
          {item.favorite && <span className="pill glass">❤️</span>}
          {item.rewatch && item.status !== 'watched' && <span className="pill glass">🔁</span>}
          {item.rating != null && <span className="pill glass star">★ {item.rating}</span>}
        </span>
      </Poster>
      <div className="film-card-body">
        <b>{item.title}</b>
        {place && <span className="series-line small">📚 {item.series}</span>}
        <span className="muted small">{(item.kind === 'book'
          ? [item.author]
          : [item.year, KIND_EMOJI[item.kind] + ' ' + t('kind.' + item.kind), item.where_to_watch]).filter(Boolean).join(' · ')}</span>
      </div>
    </a>
  )
}

type Sort = 'rating' | 'recent' | 'title' | 'year'

// Genres that are used in a list, most used first
export function genresIn(items: Item[]) {
  const n = new Map<string, number>()
  for (const i of items) for (const g of i.genres) n.set(g, (n.get(g) ?? 0) + 1)
  return GENRES.filter(g => n.has(g)).sort((a, b) => n.get(b)! - n.get(a)!)
}

export function ListScreen({ status, section, onAdd }: { status: Status; section: Section; onAdd: () => void }) {
  const { items } = useStore()
  const mine = items.filter(x => x.status === status && sectionOf(x) === section)
  const [query, setQuery] = useState('')
  const [genre, setGenre] = useState<string | null>(null)
  const [kind, setKind] = useState<Kind | null>(null)
  const [minRating, setMinRating] = useState(0)
  const [fav, setFav] = useState(false)
  const [sort, setSort] = useState<Sort>(status === 'watched' ? 'rating' : 'recent')
  const watched = status === 'watched'

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = mine.filter(x =>
      (!q || [x.title, x.original_title, x.author, x.series, x.note, x.source].some(s => s?.toLowerCase().includes(q))) &&
      (!genre || x.genres.includes(genre)) && (!kind || x.kind === kind) &&
      (!minRating || (x.rating ?? 0) >= minRating) && (!fav || x.favorite))
    const by: Record<Sort, (a: Item, b: Item) => number> = {
      rating: (a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (b.watched_on ?? '').localeCompare(a.watched_on ?? ''),
      recent: (a, b) => watched ? (b.watched_on ?? b.updated_at).localeCompare(a.watched_on ?? a.updated_at) : b.created_at.localeCompare(a.created_at),
      // Books of one series stay together and in order
      title: (a, b) => (a.series ?? a.title).localeCompare(b.series ?? b.title) || (a.series_no ?? 0) - (b.series_no ?? 0) || a.title.localeCompare(b.title),
      year: (a, b) => (b.year ?? 0) - (a.year ?? 0),
    }
    const sorted = list.sort(by[sort])
    return section === 'books' && sort !== 'rating' ? keepSeriesTogether(sorted) : sorted
  }, [mine, query, genre, kind, minRating, fav, sort, watched, section])

  if (mine.length === 0) return (
    <div className="content">
      <div className="empty-big">
        <div className="empty-mark">{section === 'books' ? '📚' : status === 'want' ? '🍿' : status === 'watching' ? '📺' : '🎞️'}</div>
        <p>{t(sk(section, 'list.empty.' + status))}</p>
        <button className="btn primary" onClick={onAdd}><Icon name="plus" size={18} />{t(sk(section, 'add.title'))}</button>
      </div>
    </div>
  )

  const genres = genresIn(mine)
  return (
    <div className="content">
      {mine.length > 6 && (
        <label className="search"><Icon name="search" size={18} />
          <input type="search" value={query} placeholder={t('list.search')} onChange={e => setQuery(e.target.value)} />
        </label>
      )}
      <div className="chips">
        {watched && <button className={`chip ${fav ? 'on' : ''}`} onClick={() => setFav(!fav)}>❤️ {t('item.favorite')}</button>}
        {(['film', 'series'] as Kind[]).filter(k => mine.some(x => x.kind === k)).length > 1 && (['film', 'series'] as Kind[]).map(k => (
          <button key={k} className={`chip ${kind === k ? 'on' : ''}`} onClick={() => setKind(kind === k ? null : k)}>{KIND_EMOJI[k]} {t('kinds.' + k)}</button>
        ))}
        {genres.map(g => (
          <button key={g} className={`chip ${genre === g ? 'on' : ''}`} onClick={() => setGenre(genre === g ? null : g)}>{t('genre.' + g)}</button>
        ))}
      </div>
      {watched && (
        <div className="list-tools">
          <div className="chips">
            {[0, 10, 9, 8, 7].map(n => (
              <button key={n} className={`chip ${minRating === n ? 'on' : ''}`} onClick={() => setMinRating(n)}>{n ? (n === 10 ? '★ 10' : `★ ${n}+`) : t('list.allRatings')}</button>
            ))}
          </div>
          <select value={sort} onChange={e => setSort(e.target.value as Sort)} aria-label={t('list.sort')}>
            {(['rating', 'recent', 'title', 'year'] as Sort[]).map(s => <option key={s} value={s}>{t(sk(section, 'sort.' + s))}</option>)}
          </select>
        </div>
      )}
      {shown.length === 0
        ? <p className="empty">{t('list.nothing')}</p>
        : <div className="film-grid">{shown.map(x => <ItemCard key={x.id} item={x} />)}</div>}
    </div>
  )
}
