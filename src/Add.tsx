import { useEffect, useRef, useState } from 'react'
import { t } from './i18n'
import { extractUrl, guessTitle, KIND_EMOJI, STATUSES, todayISO, type Item, type Status } from './lib'
import { useStore } from './store'
import { findByUrl, searchTitles, type Found } from './wiki'
import { go, Icon, Img, PhotoButton, Sheet } from './ui'

// Fields filled from a Wikidata match
export function fromFound(f: Found): Partial<Item> {
  return {
    title: f.title, original_title: f.original_title, kind: f.kind, year: f.year, genres: f.genres,
    runtime: f.runtime, length: f.length, poster_url: f.poster_url, wikidata: f.wikidata, wiki_url: f.wiki_url,
  }
}

// Live search on Wikidata while she types: results with posters
export function useLookup(text: string) {
  const [results, setResults] = useState<Found[]>([])
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const q = text.trim()
    if (q.length < 2) { setResults([]); setBusy(false); return }
    let alive = true
    setBusy(true); setFailed(false)
    const id = setTimeout(async () => {
      try {
        const url = extractUrl(q)
        let list: Found[] = []
        if (url) {
          const hit = await findByUrl(url)
          if (hit) list = [hit]
          else { const g = guessTitle(url); if (g) list = await searchTitles(g) }
        } else list = await searchTitles(q)
        if (alive) setResults(list)
      } catch { if (alive) setFailed(true) }
      if (alive) setBusy(false)
    }, 550)
    return () => { alive = false; clearTimeout(id) }
  }, [text])
  return { results, busy, failed }
}

export function FoundRow({ f, onPick }: { f: Found; onPick: () => void }) {
  return (
    <button type="button" className="found" onClick={onPick}>
      <span className="found-poster">{f.poster_url ? <img src={f.poster_url} alt="" loading="lazy" /> : KIND_EMOJI[f.kind]}</span>
      <span className="grow">
        <b>{f.title}</b>
        <span className="small muted">{[f.year, t('kind.' + f.kind), f.original_title].filter(Boolean).join(' · ')}</span>
        {f.description && <span className="small muted found-desc">{f.description}</span>}
      </span>
      <Icon name="plus" size={20} />
    </button>
  )
}

export function QuickAdd({ status: initial, onClose }: { status: Status; onClose: () => void }) {
  const { addItem } = useStore()
  const [text, setText] = useState('')
  const [status, setStatus] = useState<Status>(initial)
  const [shot, setShot] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const { results, busy: searching, failed } = useLookup(text)
  useEffect(() => { input.current?.focus() }, [])

  async function save(found?: Found) {
    const raw = text.trim()
    if (!raw && !shot) return
    setBusy(true); setError('')
    const url = extractUrl(raw) || null
    const plain = url ? raw.replace(url, '').trim() : raw
    const title = found?.title || plain || (url ? guessTitle(url) : '') || ''
    try {
      const item = await addItem({
        ...(found ? fromFound(found) : {}),
        title: title || t('item.untitled'), status, url, photos: shot ? [shot] : [],
        watched_on: status === 'watched' ? todayISO() : null,
      })
      onClose()
      // Without a name she lands on the page to finish it
      if (!title || status === 'watched') go(`#/i/${item.id}`)
    } catch (e) { setError((e as Error).message); setBusy(false) }
  }

  return (
    <Sheet title={t('add.title')} onClose={onClose}>
      <form className="quick" onSubmit={e => { e.preventDefault(); save() }}>
        <input ref={input} value={text} placeholder={t('add.placeholder')} onChange={e => setText(e.target.value)} enterKeyHint="done" />
        <div className="chips">
          {STATUSES.map(s => <button type="button" key={s} className={`chip ${status === s ? 'on' : ''}`} onClick={() => setStatus(s)}>{t('tab.' + s)}</button>)}
        </div>
        {(searching || results.length > 0 || failed) && (
          <div className="found-list">
            {searching && results.length === 0 && <p className="small muted pad">{t('add.searching')}</p>}
            {failed && <p className="small muted pad">{t('add.offline')}</p>}
            {results.map(f => <FoundRow key={f.wikidata} f={f} onPick={() => !busy && save(f)} />)}
          </div>
        )}
        <div className="row">
          {shot
            ? <span className="shot"><Img path={shot} thumb /><button type="button" className="btn ghost compact" onClick={() => setShot(null)}><Icon name="close" size={16} /></button></span>
            : <PhotoButton multiple={false} label={t('add.screenshot')} onAdded={p => setShot(p[0])} />}
          <span className="grow" />
          <button className="btn primary" disabled={busy || (!text.trim() && !shot)}>{results.length ? t('add.saveAsIs') : t('common.save')}</button>
        </div>
        {results.length > 0 && <p className="hint">{t('add.pickHint')}</p>}
        {error && <p className="error">{error}</p>}
      </form>
    </Sheet>
  )
}

// Find a film on Wikipedia for an existing card (poster, year, genres…)
export function LookupSheet({ start, onPick, onClose }: { start: string; onPick: (f: Found) => void; onClose: () => void }) {
  const [text, setText] = useState(start)
  const { results, busy, failed } = useLookup(text)
  return (
    <Sheet title={t('lookup.title')} onClose={onClose}>
      <input value={text} onChange={e => setText(e.target.value)} placeholder={t('add.placeholder')} />
      <div className="found-list">
        {busy && results.length === 0 && <p className="small muted pad">{t('add.searching')}</p>}
        {failed && <p className="small muted pad">{t('add.offline')}</p>}
        {!busy && !failed && results.length === 0 && <p className="small muted pad">{t('lookup.none')}</p>}
        {results.map(f => <FoundRow key={f.wikidata} f={f} onPick={() => onPick(f)} />)}
      </div>
      <p className="hint">{t('lookup.hint')}</p>
    </Sheet>
  )
}
