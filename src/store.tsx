import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase, removePhotos, type Item } from './lib'

type Store = {
  items: Item[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  addItem: (row: Partial<Item> & { title: string }) => Promise<Item>
  updateItem: (id: string, patch: Partial<Item>) => Promise<void>
  deleteItem: (id: string) => Promise<void>
}

const Ctx = createContext<Store | null>(null)
export const useStore = () => useContext(Ctx)!

export function StoreProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const { data, error } = await supabase.from('watch_items').select('*').order('created_at', { ascending: false })
    if (error) setError(error.message)
    else { setItems(data as Item[]); setError(null) }
    setLoading(false)
  }, [])

  useEffect(() => {
    reload()
    // Fresh data when the app comes back to the screen (changes made on another device)
    const onVisible = () => { if (document.visibilityState === 'visible') reload() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [reload])

  const value = useMemo<Store>(() => ({
    items, loading, error, reload,
    async addItem(row) {
      const { data, error } = await supabase.from('watch_items').insert(row).select().single()
      if (error) throw error
      setItems(list => [data as Item, ...list])
      return data as Item
    },
    async updateItem(id, patch) {
      setItems(list => list.map(x => (x.id === id ? { ...x, ...patch } : x)))
      const { error } = await supabase.from('watch_items').update(patch).eq('id', id)
      if (error) { await reload(); throw error }
    },
    async deleteItem(id) {
      const item = items.find(x => x.id === id)
      setItems(list => list.filter(x => x.id !== id))
      const { error } = await supabase.from('watch_items').delete().eq('id', id)
      if (error) { await reload(); throw error }
      await removePhotos(...(item?.photos ?? []))
    },
  }), [items, loading, error, reload])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
