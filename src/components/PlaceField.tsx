import { useState } from 'react'
import type { GeoPoint } from '../db/schema'
import { getPosition, mapsUrl, reverseGeocode } from '../lib/geo'

export function PlaceField({
  value,
  onChange,
  placeholder,
  reverseGeocoding,
  suggestions,
  listId,
}: {
  value: GeoPoint
  onChange: (v: GeoPoint) => void
  placeholder: string
  reverseGeocoding: boolean
  suggestions: string[]
  listId: string
}) {
  const [status, setStatus] = useState<'idle' | 'locating' | 'error'>('idle')
  const [error, setError] = useState<string>()
  const hasCoords = value.lat !== undefined && value.lon !== undefined

  const locate = async () => {
    setStatus('locating')
    setError(undefined)
    try {
      const c = await getPosition()
      let label = value.label
      const next: GeoPoint = { ...value, lat: c.lat, lon: c.lon, accuracyM: c.accuracyM }
      onChange(next)
      setStatus('idle')
      if (!label && reverseGeocoding) {
        label = await reverseGeocode(c)
        if (label) onChange({ ...next, label })
      }
    } catch (e) {
      setStatus('error')
      setError((e as Error).message)
    }
  }

  return (
    <div className="space-y-2">
      <input
        className="field"
        list={listId}
        placeholder={placeholder}
        value={value.label ?? ''}
        onChange={(e) => onChange({ ...value, label: e.target.value || undefined })}
      />
      <datalist id={listId}>
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button
          type="button"
          onClick={locate}
          disabled={status === 'locating'}
          className="rounded-full border border-line bg-surface-2 px-3 py-1.5 active:bg-line disabled:opacity-60"
        >
          {status === 'locating' ? '📍 Cerco la posizione…' : hasCoords ? '📍 Aggiorna posizione' : '📍 Usa posizione'}
        </button>
        {hasCoords && (
          <>
            <a className="text-accent underline" href={mapsUrl({ lat: value.lat!, lon: value.lon! })} target="_blank" rel="noreferrer">
              Vedi su mappa
            </a>
            <span className="text-muted">±{value.accuracyM ?? '?'} m</span>
            <button
              type="button"
              className="text-muted underline"
              onClick={() => onChange({ label: value.label })}
            >
              Rimuovi posizione
            </button>
          </>
        )}
      </div>
      {error && <p className="text-sm text-warn">{error}</p>}
    </div>
  )
}
