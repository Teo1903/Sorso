import { db, type Entry } from './schema'
import { getSettings, setSetting } from '../lib/settings'

export function newId(): string {
  if ('randomUUID' in crypto) return crypto.randomUUID()
  // fallback per contesti non sicuri (http in rete locale)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

/** Salva una scheda (nuova o modificata) con la sua foto eventuale. */
export async function saveEntry(
  entry: Entry,
  photo?: { full: Blob; thumb: Blob } | null, // undefined = invariata, null = rimuovi
): Promise<void> {
  const isNew = !(await db.entries.get(entry.id))
  await db.transaction('rw', db.entries, db.photos, async () => {
    if (photo === null && entry.photoId) {
      await db.photos.delete(entry.photoId)
      entry.photoId = undefined
    } else if (photo) {
      const oldPhotoId = entry.photoId
      const photoId = newId()
      await db.photos.put({ id: photoId, full: photo.full, thumb: photo.thumb })
      entry.photoId = photoId
      if (oldPhotoId && oldPhotoId !== photoId) {
        const stillUsed = await db.entries.filter((e) => e.photoId === oldPhotoId && e.id !== entry.id).count()
        if (!stillUsed) await db.photos.delete(oldPhotoId)
      }
    }
    entry.updatedAt = Date.now()
    await db.entries.put(entry)
  })
  if (isNew) {
    const s = await getSettings()
    await setSetting('entriesSinceBackup', s.entriesSinceBackup + 1)
  }
}

export async function deleteEntry(id: string): Promise<void> {
  await db.transaction('rw', db.entries, db.photos, async () => {
    const e = await db.entries.get(id)
    if (!e) return
    await db.entries.delete(id)
    if (e.photoId) {
      const stillUsed = await db.entries.filter((x) => x.photoId === e.photoId).count()
      if (!stillUsed) await db.photos.delete(e.photoId)
    }
  })
}

/** Chiede al browser di non cancellare i dati in automatico. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}
