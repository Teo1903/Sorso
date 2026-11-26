import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Entry } from '../db/schema'
import { uniqueSorted } from './format'
import { REGIONI, VITIGNI } from './constants'

export function useAllEntries(): Entry[] | undefined {
  return useLiveQuery(() => db.entries.toArray(), [])
}

export interface Suggestions {
  names: string[]
  producers: string[]
  regions: string[]
  regionsUsed: string[]
  grapes: string[]
  grapesUsed: string[]
  tags: string[]
  pairingsUsed: string[]
  places: string[]
  shops: string[]
  vintages: number[]
  appellations: string[]
}

export function useSuggestions(entries: Entry[] | undefined): Suggestions {
  return useMemo(() => {
    const es = entries ?? []
    const regionsUsed = uniqueSorted(es.map((e) => e.wine?.region))
    const grapesUsed = uniqueSorted(es.flatMap((e) => e.wine?.grapes ?? []))
    return {
      names: uniqueSorted(es.map((e) => e.name)),
      producers: uniqueSorted(es.map((e) => e.wine?.producer)),
      regions: uniqueSorted([...regionsUsed, ...REGIONI]),
      regionsUsed,
      grapes: uniqueSorted([...grapesUsed, ...VITIGNI]),
      grapesUsed,
      tags: uniqueSorted(es.flatMap((e) => e.tags)),
      pairingsUsed: uniqueSorted(es.flatMap((e) => e.pairings)),
      places: uniqueSorted(es.map((e) => e.drankAt?.label)),
      shops: uniqueSorted(es.map((e) => e.boughtAt?.shopName)),
      vintages: [...new Set(es.map((e) => e.wine?.vintage).filter((v): v is number => v !== undefined))].sort(
        (a, b) => b - a,
      ),
      appellations: uniqueSorted(es.map((e) => e.wine?.appellation)),
    }
  }, [entries])
}
