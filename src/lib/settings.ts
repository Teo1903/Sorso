import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Category } from '../db/schema'
import type { Filters } from './filters'

export interface SavedFilter {
  id: string
  name: string
  filters: Filters
}

export interface Settings {
  subcategories: Record<Category, string[]>
  pairings: string[]
  reverseGeocoding: boolean
  lastBackupAt?: number
  entriesSinceBackup: number
  savedFilters: SavedFilter[]
  view: 'list' | 'grid'
  startOnNew: boolean
  lastCategory?: Category
}

export const DEFAULT_SETTINGS: Settings = {
  subcategories: {
    vino: ['Rosso', 'Bianco', 'Rosé', 'Bollicine', 'Dolce/Passito'],
    spritz: ['Aperol', 'Campari', 'Select', 'Hugo', 'Bianco', 'Altro'],
  },
  pairings: [
    'Aperitivo',
    'Salumi',
    'Formaggi',
    'Pesce',
    'Crudi',
    'Carne rossa',
    'Carne bianca',
    'Primi',
    'Pizza',
    'Funghi/tartufo',
    'Dolci',
    'Da solo',
  ],
  reverseGeocoding: true,
  entriesSinceBackup: 0,
  savedFilters: [],
  view: 'list',
  startOnNew: false,
}

export async function getSettings(): Promise<Settings> {
  const rows = await db.settings.toArray()
  const s: Record<string, unknown> = { ...DEFAULT_SETTINGS }
  for (const r of rows) s[r.key] = r.value
  return s as unknown as Settings
}

export async function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  await db.settings.put({ key, value })
}

export function useSettings(): Settings {
  const rows = useLiveQuery(() => db.settings.toArray(), [])
  const s: Record<string, unknown> = { ...DEFAULT_SETTINGS }
  for (const r of rows ?? []) s[r.key] = r.value
  return s as unknown as Settings
}
