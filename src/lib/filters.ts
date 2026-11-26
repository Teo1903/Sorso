import type { BuyAgain, Category, Entry } from '../db/schema'
import { distanceKm } from './geo'
import { normalize, paidPrice } from './format'

export interface Filters {
  categories: Category[]
  subcategories: string[]
  minRating2x?: number
  maxRating2x?: number
  minPrice?: number
  maxPrice?: number
  onlyDiscounted: boolean
  buyAgain: BuyAgain[]
  tags: string[]
  pairings: string[]
  regions: string[]
  grapes: string[]
  producers: string[]
  vintages: number[]
  shops: string[]
  dateFrom?: string
  dateTo?: string
  near?: { lat: number; lon: number; radiusKm: number }
}

export type SortKey = 'recent' | 'rating' | 'priceAsc' | 'priceDesc' | 'value'

export const SORTS: { id: SortKey; label: string }[] = [
  { id: 'recent', label: 'Più recenti' },
  { id: 'rating', label: 'Voto più alto' },
  { id: 'value', label: 'Qualità/prezzo' },
  { id: 'priceAsc', label: 'Prezzo crescente' },
  { id: 'priceDesc', label: 'Prezzo decrescente' },
]

export const EMPTY_FILTERS: Filters = {
  categories: [],
  subcategories: [],
  onlyDiscounted: false,
  buyAgain: [],
  tags: [],
  pairings: [],
  regions: [],
  grapes: [],
  producers: [],
  vintages: [],
  shops: [],
}

export function activeFilterCount(f: Filters): number {
  let n = 0
  const arrays = [
    f.categories,
    f.subcategories,
    f.buyAgain,
    f.tags,
    f.pairings,
    f.regions,
    f.grapes,
    f.producers,
    f.vintages,
    f.shops,
  ]
  for (const a of arrays) if (a.length) n++
  if (f.minRating2x !== undefined || f.maxRating2x !== undefined) n++
  if (f.minPrice !== undefined || f.maxPrice !== undefined) n++
  if (f.onlyDiscounted) n++
  if (f.dateFrom || f.dateTo) n++
  if (f.near) n++
  return n
}

const inList = (list: string[], v?: string) => !list.length || (!!v && list.some((x) => normalize(x) === normalize(v)))
const anyInList = (list: string[], values: string[]) =>
  !list.length || values.some((v) => list.some((x) => normalize(x) === normalize(v)))

export function applyFilters(entries: Entry[], f: Filters): Entry[] {
  return entries.filter((e) => {
    if (f.categories.length && !f.categories.includes(e.category)) return false
    if (!inList(f.subcategories, e.subcategory)) return false
    if (f.minRating2x !== undefined && e.rating2x < f.minRating2x) return false
    if (f.maxRating2x !== undefined && e.rating2x > f.maxRating2x) return false
    if (f.minPrice !== undefined || f.maxPrice !== undefined || f.onlyDiscounted) {
      const p = paidPrice(e.price)
      if (p === undefined) return false
      if (f.minPrice !== undefined && p < f.minPrice) return false
      if (f.maxPrice !== undefined && p > f.maxPrice) return false
      if (f.onlyDiscounted && (e.price?.discounted === undefined || e.price?.full === undefined)) return false
    }
    if (f.buyAgain.length && (!e.buyAgain || !f.buyAgain.includes(e.buyAgain))) return false
    if (!anyInList(f.tags, e.tags)) return false
    if (!anyInList(f.pairings, e.pairings)) return false
    if (!inList(f.regions, e.wine?.region)) return false
    if (!anyInList(f.grapes, e.wine?.grapes ?? [])) return false
    if (!inList(f.producers, e.wine?.producer)) return false
    if (f.vintages.length && (e.wine?.vintage === undefined || !f.vintages.includes(e.wine.vintage))) return false
    if (!inList(f.shops, e.boughtAt?.shopName)) return false
    if (f.dateFrom && e.consumedOn < f.dateFrom) return false
    if (f.dateTo && e.consumedOn > f.dateTo) return false
    if (f.near) {
      const near = f.near
      const points = [e.drankAt, e.boughtAt].filter(
        (p): p is { lat: number; lon: number } => p?.lat !== undefined && p?.lon !== undefined,
      )
      if (!points.some((p) => distanceKm(near, p) <= near.radiusKm)) return false
    }
    return true
  })
}

/** Voto / prezzo pieno (o scontato se il pieno manca). */
export function valueScore(e: Entry): number | undefined {
  if (!e.price || e.price.unknown) return undefined
  const p = e.price.full ?? e.price.discounted
  if (!p) return undefined
  return e.rating2x / 2 / p
}

const recentCmp = (a: Entry, b: Entry) =>
  b.consumedOn.localeCompare(a.consumedOn) || b.createdAt - a.createdAt

/** Ordina; le voci senza prezzo finiscono in fondo negli ordinamenti per prezzo. */
export function sortEntries(entries: Entry[], key: SortKey): Entry[] {
  const arr = [...entries]
  const withUndefinedLast = (va: number | undefined, vb: number | undefined, dir: 1 | -1) => {
    if (va === undefined && vb === undefined) return 0
    if (va === undefined) return 1
    if (vb === undefined) return -1
    return (va - vb) * dir
  }
  switch (key) {
    case 'recent':
      return arr.sort(recentCmp)
    case 'rating':
      return arr.sort((a, b) => b.rating2x - a.rating2x || recentCmp(a, b))
    case 'priceAsc':
      return arr.sort((a, b) => withUndefinedLast(paidPrice(a.price), paidPrice(b.price), 1) || recentCmp(a, b))
    case 'priceDesc':
      return arr.sort((a, b) => withUndefinedLast(paidPrice(a.price), paidPrice(b.price), -1) || recentCmp(a, b))
    case 'value':
      return arr.sort((a, b) => withUndefinedLast(valueScore(a), valueScore(b), -1) || recentCmp(a, b))
  }
}
