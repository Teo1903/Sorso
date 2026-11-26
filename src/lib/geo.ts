export interface Coords {
  lat: number
  lon: number
  accuracyM: number
}

export function getPosition(timeoutMs = 15000): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocalizzazione non disponibile su questo dispositivo'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          lat: round6(p.coords.latitude),
          lon: round6(p.coords.longitude),
          accuracyM: Math.round(p.coords.accuracy),
        }),
      (err) => {
        const msg =
          err.code === err.PERMISSION_DENIED
            ? 'Permesso posizione negato. Puoi scrivere il luogo a mano.'
            : err.code === err.TIMEOUT
              ? 'Posizione non trovata in tempo. Riprova o scrivi il luogo a mano.'
              : 'Posizione non disponibile.'
        reject(new Error(msg))
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 60000 },
    )
  })
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6

/** Distanza in km (formula dell'emisenoverso). */
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

let lastGeocodeAt = 0

/**
 * Suggerisce un nome per il luogo tramite Nominatim (OpenStreetMap).
 * Rispetta la policy: max 1 richiesta al secondo, solo su azione dell'utente.
 */
export async function reverseGeocode(c: { lat: number; lon: number }): Promise<string | undefined> {
  if (!navigator.onLine) return undefined
  const wait = 1100 - (Date.now() - lastGeocodeAt)
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastGeocodeAt = Date.now()
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${c.lat}&lon=${c.lon}&zoom=18&addressdetails=1&accept-language=it`
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return undefined
    const data = (await res.json()) as {
      name?: string
      address?: Record<string, string>
    }
    const a = data.address ?? {}
    const place = data.name || a.amenity || a.shop || a.restaurant || a.bar || a.cafe || a.pub
    const street = [a.road, a.house_number].filter(Boolean).join(' ')
    const town = a.city || a.town || a.village || a.suburb
    const parts = [place, place ? undefined : street, town].filter(Boolean)
    return parts.length ? parts.join(', ') : undefined
  } catch {
    return undefined
  }
}

/** Link universale: su iPhone e Android apre l'app Mappe/Google Maps se installata. */
export function mapsUrl(c: { lat: number; lon: number }): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${c.lat},${c.lon}`)}`
}
