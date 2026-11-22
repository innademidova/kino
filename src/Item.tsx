import { useState } from 'react'
import { t } from './i18n'
import {
  formatDate, formatRuntime, GENRES, sectionOf, sk, KIND_EMOJI, LENGTHS, lengthLabel, MOODS, MOOD_EMOJI, moodsOf, SERVICES, STATUSES, todayISO, type Item,
} from './lib'
import { useStore } from './store'
import { AutoField, ConfirmDelete, Icon, LinkChip, PhotoGrid, Poster, Segmented, Stars, go } from './ui'
import { fromFound, LookupSheet } from './Add'
import { seriesPlace } from './Lists'

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v])

export function ItemPage({ item }: { item: Item }) {
  const { items, updateItem, deleteItem } = useStore()
  const [lookup, setLookup] = useState(false)
  const [error, setError] = useState('')
  const save = (patch: Partial<Item>) => updateItem(item.id, patch).catch(e => setError((e as Error).message))
  const back = () => (history.length > 1 ? history.back() : go(item.status === 'want' ? '#/' : '#/' + item.status))
  const place = seriesPlace(items, item)
  const seriesLine = item.series && place ? `${item.series}${place.n ? ' · ' + (place.total ? t('item.bookOf', { n: place.n, total: place.total }) : t('item.bookNo', { n: place.n })) : ''}` : ''
  const mood = moodsOf(item)
  const untitled = item.title === t('item.untitled')
  const section = sectionOf(item)
  const book = item.kind === 'book'

  function setStatus(status: Item['status']) {
    save({ status, ...(status === 'watched' && !item.watched_on ? { watched_on: todayISO() } : {}) })
  }

  return (
    <div className="page item-page">
      <header className="top">
        <button className="round" onClick={back} aria-label={t('common.back')}><Icon name="back" /></button>
        <span className="grow" />
        <button className={`round heart ${item.favorite ? 'on' : ''}`} onClick={() => save({ favorite: !item.favorite })} aria-label={t('item.favorite')}>
          <Icon name="heart" fill={item.favorite} />
        </button>
      </header>
      <div className="content">
        <div className="item-head">
          <Poster item={item} className="item-poster" thumb={false} />
          <div className="item-title stack">
            <AutoField className="title-input" value={untitled ? '' : item.title} placeholder={t('item.titlePlaceholder')} onSave={v => save({ title: v ?? t('item.untitled') })} />
            {item.original_title && <p className="muted">{item.original_title}</p>}
            {book && item.author && <p className="item-meta">{item.author}</p>}
            {seriesLine && <button type="button" className="series-line link-btn" onClick={() => document.getElementById('series')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>📚 {seriesLine}</button>}
            <p className={book ? 'small muted' : 'item-meta'}>
              {(book ? [item.year, item.pages && t('item.pagesN', { n: item.pages })]
                : [item.year, KIND_EMOJI[item.kind] + ' ' + t('kind.' + item.kind), formatRuntime(item.runtime)]).filter(Boolean).join(' · ')}
            </p>
            {item.genres.length > 0 && <p className="small muted">{item.genres.map(g => t('genre.' + g)).join(', ')}</p>}
            <div className="row">
              {item.url && <LinkChip url={item.url} />}
              {item.wiki_url && <LinkChip url={item.wiki_url} label={t(book ? 'link.openLibrary' : 'link.wiki')} />}
              {item.where_to_watch && <span className="tag">📺 {item.where_to_watch}</span>}
            </div>
            <button className="btn soft compact" onClick={() => setLookup(true)}><Icon name="search" size={16} />{t(sk(section, item.wikidata || item.ol_key ? 'lookup.again' : 'lookup.button'))}</button>
          </div>
        </div>
        {error && <p className="error">{error}</p>}

        <Segmented value={item.status} onChange={setStatus} options={STATUSES.map(s => ({ id: s, label: t(sk(section, 'tab.' + s)) }))} />

        {item.status === 'watched' && (
          <div className="card stack watched-card">
            <div className="rating-row">
              <Stars value={item.rating} onChange={v => save({ rating: v })} />
              <b className="rating-num">{item.rating ? `${item.rating}/10` : ''}</b>
            </div>
            <AutoField value={item.impression} placeholder={t('item.impressionPlaceholder')} onSave={v => save({ impression: v })} />
            <label className="field inline"><span>{t(sk(section, 'item.watchedOn'))}</span>
              <input type="date" value={item.watched_on ?? ''} onChange={e => save({ watched_on: e.target.value || null })} />
            </label>
          </div>
        )}

        {place && place.all.length > 1 && (
          <div className="card stack series-card" id="series">
            <div>
              <h4>📚 {t('item.seriesTitle', { name: item.series ?? '' })}</h4>
              <p className="small muted">{t('item.seriesCount', { count: place.all.length })}</p>
            </div>
            <div className="series-row">
              {place.all.map(x => {
                const here = x.id === item.id
                const inner = <>
                  <Poster item={x} className="series-cover">
                    {x.status === 'watched' && <span className="cover-pills"><span className="pill glass">✓{x.rating ? ' ★ ' + x.rating : ''}</span></span>}
                  </Poster>
                  <span className="small"><b>{x.series_no ? `${x.series_no}. ` : ''}</b>{x.title}</span>
                  {here && <span className="small muted">{t('item.thisBook')}</span>}
                </>
                return here
                  ? <div key={x.id} className="series-book here">{inner}</div>
                  : <a key={x.id} className="series-book" href={`#/i/${x.id}`} onClick={e => { e.preventDefault(); location.replace(`#/i/${x.id}`); scrollTo(0, 0) }}>{inner}</a>
              })}
            </div>
          </div>
        )}

        <div className="card stack">
          {book && (
            <>
              <label className="field"><span>{t('item.author')}</span>
                <AutoField value={item.author} onSave={v => save({ author: v })} />
              </label>
              <div className="two">
                <label className="field"><span>{t('item.series')}</span>
                  <AutoField value={item.series} onSave={v => save({ series: v })} />
                </label>
                <label className="field"><span>{t('item.seriesNo')}</span>
                  <AutoField type="number" value={item.series_no?.toString() ?? null} onSave={v => save({ series_no: v ? Number(v) : null })} />
                </label>
              </div>
            </>
          )}
          {!book && <div className="field"><span>{t('item.kind')}</span>
            <Segmented value={item.kind} onChange={k => save({ kind: k })} options={(['film', 'series'] as const).map(k => ({ id: k, label: KIND_EMOJI[k] + ' ' + t('kind.' + k) }))} />
          </div>}
          <div className="field"><span>{t('item.length')}</span>
            <div className="chips wrap">
              {LENGTHS.map(l => <button key={l} className={`chip ${item.length === l ? 'on' : ''}`} onClick={() => save({ length: item.length === l ? null : l })}>{lengthLabel(item.kind, l)}</button>)}
            </div>
          </div>
          <div className="field"><span>{t('item.mood')}{mood.guessed && mood.moods.length > 0 && <em className="guess"> · {t('item.moodGuessed')}</em>}</span>
            <div className="chips wrap">
              {MOODS.map(m => (
                <button key={m} className={`chip ${mood.moods.includes(m) ? (mood.guessed ? 'guessed' : 'on') : ''}`}
                  onClick={() => save({ moods: toggle(mood.guessed ? [] : item.moods, m) })}>{MOOD_EMOJI[m]} {t('mood.' + m)}</button>
              ))}
            </div>
          </div>
          <div className="field"><span>{t('item.genres')}</span>
            <div className="chips wrap">
              {GENRES.map(g => <button key={g} className={`chip small-chip ${item.genres.includes(g) ? 'on' : ''}`} onClick={() => save({ genres: toggle(item.genres, g) })}>{t('genre.' + g)}</button>)}
            </div>
          </div>
          <div className="two">
            <label className="field"><span>{t('item.year')}</span>
              <AutoField type="number" value={item.year?.toString() ?? null} onSave={v => save({ year: v ? Number(v) : null })} />
            </label>
            {book && (
              <label className="field"><span>{t('item.pages')}</span>
                <AutoField type="number" value={item.pages?.toString() ?? null} onSave={v => save({ pages: v ? Number(v) : null })} />
              </label>
            )}
            <label className="field"><span>{t(sk(section, 'item.where'))}</span>
              <AutoField list="services" value={item.where_to_watch} placeholder={book ? t('book.item.wherePlaceholder') : 'Netflix…'} onSave={v => save({ where_to_watch: v })} />
              {!book && <datalist id="services">{SERVICES.map(s => <option key={s} value={s} />)}</datalist>}
            </label>
          </div>
          <label className="field"><span>{t('item.source')}</span>
            <AutoField value={item.source} placeholder={t('item.sourcePlaceholder')} onSave={v => save({ source: v })} />
          </label>
          <label className="field"><span>{t('item.url')}</span>
            <AutoField type="url" value={item.url} placeholder="https://…" onSave={v => save({ url: v })} />
          </label>
          <label className="field"><span>{t('item.note')}</span>
            <AutoField multiline value={item.note} onSave={v => save({ note: v })} />
          </label>
          {item.status !== 'watched' && (
            <label className="check"><input type="checkbox" checked={item.rewatch} onChange={e => save({ rewatch: e.target.checked })} />🔁 {t(sk(section, 'item.rewatch'))}</label>
          )}
        </div>

        <div className="card stack">
          <h4>{t('item.photos')}</h4>
          <PhotoGrid paths={item.photos} onChange={photos => save({ photos })} />
          {item.poster_url && <button className="btn ghost compact" onClick={() => save({ poster_url: null })}>{t('item.removePoster')}</button>}
        </div>

        <div className="form-foot">
          <span className="muted small">{t('item.added', { date: formatDate(item.created_at.slice(0, 10)) })}</span>
          <ConfirmDelete onConfirm={async () => { await deleteItem(item.id); back() }} />
        </div>
      </div>
      {lookup && (
        <LookupSheet section={section} start={untitled ? '' : [item.original_title ?? item.title, book ? item.author : ''].filter(Boolean).join(' ')} onClose={() => setLookup(false)} onPick={f => {
          const data = fromFound(f)
          // Her own choices stay: title, genres and length only fill in when empty
          save({
            ...data,
            title: untitled ? data.title : item.title,
            genres: item.genres.length ? item.genres : data.genres,
            length: item.length ?? data.length,
            year: item.year ?? data.year,
            poster_url: data.poster_url ?? item.poster_url,
          })
          setLookup(false)
        }} />
      )}
    </div>
  )
}
