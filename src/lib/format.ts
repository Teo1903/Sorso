import type { Entry, Price } from '../db/schema'

const eur = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })
const num1 = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 1 })

export const formatEur = (n: number) => eur.format(n)
export const formatRating = (rating2x: number) => num1.format(rating2x / 2)

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function todayIso(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Accetta "12,50", "12.50", "€ 12", restituisce undefined se vuoto o non valido. */
export function parseDecimal(s: string): number | undefined {
  const cleaned = s.replace(/[€\s]/g, '').replace(',', '.')
  if (!cleaned) return undefined
  const n = Number(cleaned)
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : undefined
}

export function decimalToInput(n: number | undefined): string {
  return n === undefined ? '' : String(n).replace('.', ',')
}

/** Prezzo effettivamente pagato: lo scontato se presente, altrimenti il pieno. */
export function paidPrice(p?: Price): number | undefined {
  if (!p || p.unknown) return undefined
  return p.discounted ?? p.full
}

export function discountPct(p?: Price): number | undefined {
  if (!p || p.unknown || p.full === undefined || p.discounted === undefined || p.full <= 0) return undefined
  return Math.round((1 - p.discounted / p.full) * 100)
}

export function priceLabel(p?: Price): string {
  if (!p || p.unknown) return 'Prezzo non noto'
  const unit = p.unit === 'bottiglia' ? 'bott.' : p.unit
  if (p.discounted !== undefined && p.full !== undefined)
    return `${formatEur(p.discounted)} (pieno ${formatEur(p.full)}, −${discountPct(p)}%) / ${unit}`
  const v = p.full ?? p.discounted
  return v === undefined ? 'Prezzo non noto' : `${formatEur(v)} / ${unit}`
}

export function entryTitle(e: Entry): string {
  if (e.name) return e.name
  if (e.subcategory) return `${e.category === 'vino' ? 'Vino' : 'Spritz'} ${e.subcategory}`
  return e.category === 'vino' ? 'Vino senza nome' : 'Spritz senza nome'
}

/** minuscolo + senza accenti, per confronti e ricerca */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

export function uniqueSorted(values: (string | undefined)[]): string[] {
  const map = new Map<string, string>()
  for (const v of values) {
    if (!v || !v.trim()) continue
    const k = normalize(v)
    if (!map.has(k)) map.set(k, v.trim())
  }
  return [...map.values()].sort((a, b) => a.localeCompare(b, 'it'))
}
