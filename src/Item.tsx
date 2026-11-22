import { useState } from 'react'
import { t } from './i18n'
import {
  formatRuntime, GENRES, KIND_EMOJI, LENGTHS, lengthLabel, MOODS, MOOD_EMOJI, moodsOf, SERVICES, STATUSES, todayISO, type Item,
} from './lib'
import { useStore } from './store'
import { AutoField, ConfirmDelete, Icon, LinkChip, PhotoGrid, Poster, Segmented, Stars, go } from './ui'
import { fromFound, LookupSheet } from './Add'

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v])

export function ItemPage({ item }: { item: Item }) {
  const { updateItem, deleteItem } = useStore()
  const [lookup, setLookup] = useState(false)
  const [error, setError] = useState('')
  const save = (patch: Partial<Item>) => updateItem(item.id, patch).catch(e => setError((e as Error).message))
  const back = () => (history.length > 1 ? history.back() : go(item.status === 'want' ? '#/' : '#/' + item.status))
  const mood = moodsOf(item)
  const untitled = item.title === t('item.untitled')

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
            <p className="item-meta">
              {[item.year, KIND_EMOJI[item.kind] + ' ' + t('kind.' + item.kind), formatRuntime(item.runtime)].filter(Boolean).join(' · ')}
            </p>
            {item.genres.length > 0 && <p className="small muted">{item.genres.map(g => t('genre.' + g)).join(', ')}</p>}
            <div className="row">
              {item.url && <LinkChip url={item.url} />}
              {item.wiki_url && <LinkChip url={item.wiki_url} label={t('link.wiki')} />}
              {item.where_to_watch && <span className="tag">📺 {item.where_to_watch}</span>}
            </div>
            <button className="btn soft compact" onClick={() => setLookup(true)}><Icon name="search" size={16} />{t(item.wikidata ? 'lookup.again' : 'lookup.button')}</button>
          </div>
        </div>
        {error && <p className="error">{error}</p>}

        <Segmented value={item.status} onChange={setStatus} options={STATUSES.map(s => ({ id: s, label: t('tab.' + s) }))} />

        {item.status === 'watched' && (
          <div className="card stack watched-card">
            <div className="rating-row">
              <Stars value={item.rating} onChange={v => save({ rating: v })} />
              <b className="rating-num">{item.rating ? `${item.rating}/10` : ''}</b>
            </div>
            <AutoField value={item.impression} placeholder={t('item.impressionPlaceholder')} onSave={v => save({ impression: v })} />
            <label className="field inline"><span>{t('item.watchedOn')}</span>
              <input type="date" value={item.watched_on ?? ''} onChange={e => save({ watched_on: e.target.value || null })} />
            </label>
          </div>
        )}

        <div className="card stack">
          <div className="field"><span>{t('item.kind')}</span>
            <Segmented value={item.kind} onChange={k => save({ kind: k })} options={(['film', 'series'] as const).map(k => ({ id: k, label: KIND_EMOJI[k] + ' ' + t('kind.' + k) }))} />
          </div>
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
            <label className="field"><span>{t('item.where')}</span>
              <AutoField list="services" value={item.where_to_watch} placeholder="Netflix…" onSave={v => save({ where_to_watch: v })} />
              <datalist id="services">{SERVICES.map(s => <option key={s} value={s} />)}</datalist>
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
            <label className="check"><input type="checkbox" checked={item.rewatch} onChange={e => save({ rewatch: e.target.checked })} />🔁 {t('item.rewatch')}</label>
          )}
        </div>

        <div className="card stack">
          <h4>{t('item.photos')}</h4>
          <PhotoGrid paths={item.photos} onChange={photos => save({ photos })} />
          {item.poster_url && <button className="btn ghost compact" onClick={() => save({ poster_url: null })}>{t('item.removePoster')}</button>}
        </div>

        <div className="form-foot">
          <span className="muted small">{t('item.added', { date: new Date(item.created_at).toLocaleDateString() })}</span>
          <ConfirmDelete onConfirm={async () => { await deleteItem(item.id); back() }} />
        </div>
      </div>
      {lookup && (
        <LookupSheet start={untitled ? '' : item.original_title ?? item.title} onClose={() => setLookup(false)} onPick={f => {
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
