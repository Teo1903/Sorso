import type JSZip from 'jszip'
import { db, type Entry } from '../db/schema'
import { getSettings, setSetting, type Settings } from './settings'
import { formatDate, todayIso, uniqueSorted } from './format'

const FORMAT = 'sorso-backup'
const VERSION = 1

interface BackupData {
  format: typeof FORMAT
  version: number
  exportedAt: string
  entries: Entry[]
  settings: Pick<Settings, 'subcategories' | 'pairings' | 'savedFilters'>
}

export async function buildBackupZip(): Promise<File> {
  const { default: JSZipCtor } = await import('jszip')
  const zip = new JSZipCtor()
  const entries = await db.entries.toArray()
  const settings = await getSettings()
  const data: BackupData = {
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    entries,
    settings: {
      subcategories: settings.subcategories,
      pairings: settings.pairings,
      savedFilters: settings.savedFilters,
    },
  }
  zip.file('data.json', JSON.stringify(data, null, 2))
  const photos = zip.folder('photos')!
  await db.photos.each((p) => {
    photos.file(`${p.id}.jpg`, p.full)
    photos.file(`${p.id}.thumb.jpg`, p.thumb)
  })
  const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' }) // le JPEG sono già compresse
  return new File([blob], `sorso-backup-${todayIso()}.zip`, { type: 'application/zip' })
}

/**
 * Condivide (iPhone/Android: "Salva su File", Drive…) o scarica il file.
 * Restituisce false se l'utente annulla.
 */
export async function shareOrDownload(file: File): Promise<boolean> {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name })
      return true
    } catch (err) {
      if ((err as Error).name === 'AbortError') return false
      // altri errori: si prova con il download classico
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
  return true
}

export async function exportBackup(): Promise<boolean> {
  const file = await buildBackupZip()
  const ok = await shareOrDownload(file)
  if (ok) {
    await setSetting('lastBackupAt', Date.now())
    await setSetting('entriesSinceBackup', 0)
  }
  return ok
}

export interface ImportResult {
  added: number
  updated: number
  skipped: number
}

export async function importBackup(file: Blob): Promise<ImportResult> {
  let zip: JSZip
  try {
    const { default: JSZipCtor } = await import('jszip')
    zip = await JSZipCtor.loadAsync(file)
  } catch {
    throw new Error('Il file non è un backup valido (zip non leggibile).')
  }
  const json = await zip.file('data.json')?.async('string')
  if (!json) throw new Error('Il file non contiene data.json: non è un backup di Sorso.')
  const data = JSON.parse(json) as BackupData
  if (data.format !== FORMAT) throw new Error('Formato di backup non riconosciuto.')

  const result: ImportResult = { added: 0, updated: 0, skipped: 0 }

  // foto: si caricano solo quelle che mancano
  const neededPhotoIds = new Set(data.entries.map((e) => e.photoId).filter((x): x is string => !!x))
  for (const id of neededPhotoIds) {
    if (await db.photos.get(id)) continue
    const full = await zip.file(`photos/${id}.jpg`)?.async('blob')
    const thumb = await zip.file(`photos/${id}.thumb.jpg`)?.async('blob')
    if (full && thumb) {
      await db.photos.put({
        id,
        full: new Blob([full], { type: 'image/jpeg' }),
        thumb: new Blob([thumb], { type: 'image/jpeg' }),
      })
    }
  }

  await db.transaction('rw', db.entries, async () => {
    for (const incoming of data.entries) {
      const existing = await db.entries.get(incoming.id)
      if (!existing) {
        await db.entries.put(incoming)
        result.added++
      } else if (incoming.updatedAt > existing.updatedAt) {
        await db.entries.put(incoming)
        result.updated++
      } else {
        result.skipped++
      }
    }
  })

  // impostazioni: unione delle liste
  const s = await getSettings()
  if (data.settings) {
    await setSetting('subcategories', {
      vino: uniqueSorted([...s.subcategories.vino, ...(data.settings.subcategories?.vino ?? [])]),
      spritz: uniqueSorted([...s.subcategories.spritz, ...(data.settings.subcategories?.spritz ?? [])]),
    })
    const pairings = [...s.pairings]
    for (const p of data.settings.pairings ?? []) if (!pairings.some((x) => x.toLowerCase() === p.toLowerCase())) pairings.push(p)
    await setSetting('pairings', pairings)
    const saved = [...s.savedFilters]
    for (const f of data.settings.savedFilters ?? []) if (!saved.some((x) => x.id === f.id)) saved.push(f)
    await setSetting('savedFilters', saved)
  }
  return result
}

const csvCell = (v: unknown): string => {
  if (v === undefined || v === null) return ''
  const s = typeof v === 'number' ? String(v).replace('.', ',') : String(v)
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** CSV con separatore ";" e BOM: si apre correttamente in Excel italiano. */
export async function exportCsv(): Promise<boolean> {
  const entries = (await db.entries.toArray()).sort((a, b) => b.consumedOn.localeCompare(a.consumedOn))
  const header = [
    'Data',
    'Categoria',
    'Sottocategoria',
    'Nome',
    'Voto',
    'Prezzo pieno',
    'Prezzo scontato',
    'Unità prezzo',
    'Prezzo non noto',
    'Lo riprenderei',
    'Sensazioni',
    'Abbinamenti',
    'Tag',
    'Cantina',
    'Annata',
    'Vitigni',
    'Regione',
    'Denominazione',
    'Grado',
    'Dove bevuto',
    'Lat bevuto',
    'Lon bevuto',
    'Negozio',
    'Luogo acquisto',
  ]
  const rows = entries.map((e) => [
    formatDate(e.consumedOn),
    e.category,
    e.subcategory,
    e.name,
    e.rating2x / 2,
    e.price?.full,
    e.price?.discounted,
    e.price?.unit,
    e.price?.unknown ? 'sì' : '',
    e.buyAgain,
    e.notes,
    e.pairings.join(', '),
    e.tags.join(', '),
    e.wine?.producer,
    e.wine?.vintage,
    e.wine?.grapes.join(', '),
    e.wine?.region,
    e.wine?.appellation,
    e.wine?.abv,
    e.drankAt?.label,
    e.drankAt?.lat,
    e.drankAt?.lon,
    e.boughtAt?.shopName,
    e.boughtAt?.label,
  ])
  const csv = '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(';')).join('\r\n')
  const file = new File([csv], `sorso-${todayIso()}.csv`, { type: 'text/csv' })
  return shareOrDownload(file)
}
