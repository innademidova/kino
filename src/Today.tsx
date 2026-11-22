import { useMemo, useState } from 'react'
import { t } from './i18n'
import { KIND_EMOJI, LENGTHS, MOODS, MOOD_EMOJI, moodsOf, type Item, type Kind, type Length } from './lib'
import { useStore } from './store'
import { Icon } from './ui'
import { genresIn, ItemCard } from './Lists'

// "What to watch today": filters over "Want" + "Watching", and a random pick
export function Today() {
  const { items } = useStore()
  const pool = items.filter(x => x.status !== 'watched')
  const [kind, setKind] = useState<Kind | null>(null)
  const [genres, setGenres] = useState<string[]>([])
  const [length, setLength] = useState<Length | null>(null)
  const [moods, setMoods] = useState<string[]>([])
  const [pick, setPick] = useState<Item | null>(null)
  const flip = (list: string[], v: string) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v])

  const shown = useMemo(() => pool.filter(x =>
    (!kind || x.kind === kind) && (!genres.length || genres.some(g => x.genres.includes(g))) &&
    (!length || x.length === length) && (!moods.length || moods.some(m => moodsOf(x).moods.includes(m)))),
  [pool, kind, genres, length, moods])

  function roll() {
    if (!shown.length) return
    const others = shown.length > 1 ? shown.filter(x => x.id !== pick?.id) : shown
    setPick(others[Math.floor(Math.random() * others.length)])
  }
  const any = kind || genres.length || length || moods.length

  if (!pool.length) return <div className="content"><p className="empty">{t('today.empty')}</p></div>

  return (
    <div className="content today">
      <div className="card stack">
        <div className="field"><span>{t('today.mood')}</span>
          <div className="chips wrap">
            {MOODS.map(m => <button key={m} className={`chip ${moods.includes(m) ? 'on' : ''}`} onClick={() => setMoods(flip(moods, m))}>{MOOD_EMOJI[m]} {t('mood.' + m)}</button>)}
          </div>
        </div>
        <div className="field"><span>{t('today.what')}</span>
          <div className="chips wrap">
            {(['film', 'series'] as Kind[]).map(k => <button key={k} className={`chip ${kind === k ? 'on' : ''}`} onClick={() => setKind(kind === k ? null : k)}>{KIND_EMOJI[k]} {t('kind.' + k)}</button>)}
            {LENGTHS.map(l => <button key={l} className={`chip ${length === l ? 'on' : ''}`} onClick={() => setLength(length === l ? null : l)}>{t('length.any.' + l)}</button>)}
          </div>
        </div>
        {genresIn(pool).length > 0 && (
          <div className="field"><span>{t('item.genres')}</span>
            <div className="chips wrap">
              {genresIn(pool).map(g => <button key={g} className={`chip ${genres.includes(g) ? 'on' : ''}`} onClick={() => setGenres(flip(genres, g))}>{t('genre.' + g)}</button>)}
            </div>
          </div>
        )}
        <div className="row">
          <button className="btn primary roll" onClick={roll} disabled={!shown.length}><Icon name="dice" size={20} />{pick ? t('today.again') : t('today.random')}</button>
          {any ? <button className="btn ghost" onClick={() => { setKind(null); setGenres([]); setLength(null); setMoods([]); setPick(null) }}>{t('today.reset')}</button> : null}
        </div>
      </div>

      {pick && shown.some(x => x.id === pick.id) && (
        <div className="pick">
          <h3 className="section-title">🎲 {t('today.picked')}</h3>
          <div className="pick-card"><ItemCard item={pick} /></div>
        </div>
      )}

      <h3 className="section-title">{t('today.matches', { count: shown.length })}</h3>
      {shown.length === 0
        ? <p className="empty">{t('today.none')}</p>
        : <div className="film-grid">{shown.map(x => <ItemCard key={x.id} item={x} />)}</div>}
    </div>
  )
}
