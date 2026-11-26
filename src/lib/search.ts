import MiniSearch from 'minisearch'
import type { Entry } from '../db/schema'
import { normalize } from './format'

interface Doc {
  id: string
  name: string
  sub: string
  producer: string
  grapes: string
  region: string
  appellation: string
  notes: string
  pairings: string
  tags: string
  place: string
  shop: string
}

function toDoc(e: Entry): Doc {
  return {
    id: e.id,
    name: e.name ?? '',
    sub: [e.category, e.subcategory].filter(Boolean).join(' '),
    producer: e.wine?.producer ?? '',
    grapes: (e.wine?.grapes ?? []).join(' '),
    region: e.wine?.region ?? '',
    appellation: e.wine?.appellation ?? '',
    notes: e.notes ?? '',
    pairings: e.pairings.join(' '),
    tags: e.tags.join(' '),
    place: e.drankAt?.label ?? '',
    shop: [e.boughtAt?.shopName, e.boughtAt?.label].filter(Boolean).join(' '),
  }
}

export function buildIndex(entries: Entry[]): MiniSearch<Doc> {
  const ms = new MiniSearch<Doc>({
    fields: ['name', 'sub', 'producer', 'grapes', 'region', 'appellation', 'notes', 'pairings', 'tags', 'place', 'shop'],
    storeFields: [],
    processTerm: (t) => normalize(t) || null,
    searchOptions: {
      boost: { name: 3, producer: 2, grapes: 1.5, region: 1.5, tags: 1.5 },
      fuzzy: (term) => (term.length >= 5 ? 0.2 : term.length >= 4 ? 1 : 0),
      prefix: true,
      combineWith: 'AND',
    },
  })
  ms.addAll(entries.map(toDoc))
  return ms
}

/** Restituisce gli id che corrispondono alla ricerca, in ordine di pertinenza. */
export function searchIds(index: MiniSearch<Doc>, query: string): string[] {
  const q = query.trim()
  if (!q) return []
  return index.search(q).map((r) => String(r.id))
}
