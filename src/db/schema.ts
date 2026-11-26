import Dexie, { type EntityTable } from 'dexie'

export type Category = 'vino' | 'spritz'
export type PriceUnit = 'bottiglia' | 'calice' | 'drink'
export type BuyAgain = 'si' | 'forse' | 'no'

export interface GeoPoint {
  lat?: number
  lon?: number
  accuracyM?: number
  label?: string
}

export interface Price {
  unknown: boolean
  full?: number
  discounted?: number
  unit: PriceUnit
}

export interface WineDetails {
  producer?: string
  vintage?: number
  grapes: string[]
  region?: string
  appellation?: string
  abv?: number
}

export interface Entry {
  id: string
  createdAt: number
  updatedAt: number
  consumedOn: string // YYYY-MM-DD

  category: Category
  subcategory?: string
  name?: string

  rating2x: number // 2..20 → voto = rating2x / 2

  price?: Price
  notes?: string
  pairings: string[]
  buyAgain?: BuyAgain
  tags: string[]

  wine?: WineDetails
  drankAt?: GeoPoint
  boughtAt?: GeoPoint & { shopName?: string }

  photoId?: string
  sourceEntryId?: string
}

export interface Photo {
  id: string
  full: Blob
  thumb: Blob
}

export interface SettingRow {
  key: string
  value: unknown
}

export interface Draft {
  key: string
  entry: Partial<Entry>
  photo?: { full: Blob; thumb: Blob }
  savedAt: number
}

export const db = new Dexie('sorso') as Dexie & {
  entries: EntityTable<Entry, 'id'>
  photos: EntityTable<Photo, 'id'>
  settings: EntityTable<SettingRow, 'key'>
  drafts: EntityTable<Draft, 'key'>
}

db.version(1).stores({
  entries: 'id, updatedAt, consumedOn, category',
  photos: 'id',
  settings: 'key',
  drafts: 'key',
})

export const CATEGORIES: { id: Category; label: string; emoji: string }[] = [
  { id: 'vino', label: 'Vino', emoji: '🍷' },
  { id: 'spritz', label: 'Spritz', emoji: '🍹' },
]

export const PRICE_UNITS: { id: PriceUnit; label: string }[] = [
  { id: 'bottiglia', label: 'Bottiglia' },
  { id: 'calice', label: 'Calice' },
  { id: 'drink', label: 'Drink' },
]

export const BUY_AGAIN: { id: BuyAgain; label: string }[] = [
  { id: 'si', label: 'Sì' },
  { id: 'forse', label: 'Forse' },
  { id: 'no', label: 'No' },
]
