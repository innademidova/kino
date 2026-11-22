import { useEffect, useLayoutEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { t, lang, LANGUAGES, remember } from './i18n'
import { sectionOf, sk, supabase, type Section, type Status } from './lib'
import { StoreProvider, useStore } from './store'
import { Icon, Sheet, useHash } from './ui'
import { ListScreen } from './Lists'
import { ItemPage } from './Item'
import { Today } from './Today'
import { QuickAdd } from './Add'

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  if (session === undefined) return <div className="splash">🎬</div>
  if (!session) return <Login />
  return <StoreProvider><Routes /></StoreProvider>
}

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) setError(t('login.failed'))
    setBusy(false)
  }
  return (
    <form className="login" onSubmit={submit}>
      <div className="login-mark">🎬</div>
      <h1>{t('app.name')}</h1>
      <p className="muted">{t('login.text')}</p>
      <input type="email" autoComplete="email" placeholder={t('login.email')} value={email} onChange={e => setEmail(e.target.value)} />
      <input type="password" autoComplete="current-password" placeholder={t('login.password')} value={password} onChange={e => setPassword(e.target.value)} />
      {error && <p className="error">{error}</p>}
      <button className="btn primary wide" disabled={busy}>{t('login.go')}</button>
    </form>
  )
}

// Scroll position per screen, so going back lands where she was
const scrolls = new Map<string, number>()
let lastScreen = ''

const TABS: { id: string; hash: string; icon: string; status?: Status }[] = [
  { id: 'want', hash: '#/', icon: 'bookmark', status: 'want' },
  { id: 'watching', hash: '#/watching', icon: 'play', status: 'watching' },
  { id: 'watched', hash: '#/watched', icon: 'eye', status: 'watched' },
  { id: 'today', hash: '#/today', icon: 'dice' },
]

// Films or books: remembered on this device
function loadSection(): Section {
  try { return localStorage.getItem('section') === 'books' ? 'books' : 'kino' } catch { return 'kino' }
}

function Routes() {
  const hash = useHash()
  const [section, setSectionState] = useState<Section>(loadSection)
  const setSection = (s: Section) => { setSectionState(s); try { localStorage.setItem('section', s) } catch { /* private mode */ } }
  const { items, loading, error } = useStore()
  const [adding, setAdding] = useState(false)
  const [settings, setSettings] = useState(false)
  const parts = hash.replace(/^#\/?/, '').split('/')

  useLayoutEffect(() => {
    if (hash !== lastScreen) window.scrollTo(0, scrolls.get(hash) ?? 0)
    lastScreen = hash
    const save = () => scrolls.set(hash, scrollY)
    addEventListener('scroll', save, { passive: true })
    return () => removeEventListener('scroll', save)
  }, [hash, loading])

  if (loading) return <div className="splash">🎬</div>
  if (parts[0] === 'i') {
    const item = items.find(x => x.id === parts[1])
    if (!item) return <div className="page content"><p className="empty">{t('common.notFound')}</p><a className="btn soft" href="#/">{t('common.back')}</a></div>
    return <ItemPage item={item} />
  }
  const tab = TABS.find(x => x.id === parts[0]) ?? TABS[0]

  return (
    <div className="page with-nav">
      <header className="top home-top">
        <div className="grow">
          <h1>{t(sk(section, 'tab.' + tab.id))}</h1>
          <p className="muted small">{t('app.name')}</p>
        </div>
        <div className="segmented section-switch">
          {(['kino', 'books'] as Section[]).map(s => (
            <button key={s} className={s === section ? 'on' : ''} onClick={() => setSection(s)}>{t('section.' + s)}</button>
          ))}
        </div>
        <button className="round" onClick={() => setSettings(true)} aria-label={t('settings.title')}><Icon name="settings" /></button>
      </header>
      {error && <p className="error content">{error}</p>}
      {tab.status ? <ListScreen key={tab.id + section} section={section} status={tab.status} onAdd={() => setAdding(true)} /> : <Today key={section} section={section} />}
      <button className="fab" onClick={() => setAdding(true)} aria-label={t(sk(section, 'add.title'))}><Icon name="plus" size={26} /></button>
      <nav className="tabbar">
        {TABS.map(x => (
          <a key={x.id} href={x.hash} className={x.id === tab.id ? 'on' : ''}>
            <Icon name={x.icon} size={22} />
            <span>{t(sk(section, 'tab.' + x.id))}</span>
            {x.status && <span className="tab-count">{items.filter(i => i.status === x.status && sectionOf(i) === section).length || ''}</span>}
          </a>
        ))}
      </nav>
      {adding && <QuickAdd status={tab.status ?? 'want'} section={section} onClose={() => setAdding(false)} />}
      {settings && <Settings onClose={() => setSettings(false)} />}
    </div>
  )
}

function Settings({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title={t('settings.title')} onClose={onClose}>
      <div className="field">
        <span>{t('settings.language')}</span>
        <div className="segmented">
          {LANGUAGES.map(l => (
            <button key={l} className={l === lang ? 'on' : ''} onClick={() => { if (remember(l)) location.reload() }}>{t('languages.' + l)}</button>
          ))}
        </div>
      </div>
      <p className="muted small">{t('settings.install')}</p>
      <p className="muted small">{t('settings.posters')}</p>
      <div className="sheet-foot">
        <button className="btn ghost" onClick={() => supabase.auth.signOut()}>{t('settings.signOut')}</button>
      </div>
    </Sheet>
  )
}
