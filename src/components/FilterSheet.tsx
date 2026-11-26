import { useEffect, useState } from 'react'
import { BUY_AGAIN, CATEGORIES, type Category } from '../db/schema'
import { EMPTY_FILTERS, type Filters } from '../lib/filters'
import { decimalToInput, parseDecimal, uniqueSorted } from '../lib/format'
import { getPosition } from '../lib/geo'
import type { Suggestions } from '../lib/hooks'
import type { Settings } from '../lib/settings'
import { Chip, Section, Sheet } from './ui'

const RATING_OPTIONS = Array.from({ length: 19 }, (_, i) => i + 2) // 2..20 (rating2x)
const RADII = [1, 5, 20, 50]

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v]
}

export function FilterSheet({
  open,
  onClose,
  value,
  onApply,
  onSave,
  sug,
  settings,
}: {
  open: boolean
  onClose: () => void
  value: Filters
  onApply: (f: Filters) => void
  onSave: (f: Filters) => void
  sug: Suggestions
  settings: Settings
}) {
  const [f, setF] = useState<Filters>(value)
  const [minPriceText, setMinPriceText] = useState('')
  const [maxPriceText, setMaxPriceText] = useState('')
  const [locating, setLocating] = useState(false)
  const [geoError, setGeoError] = useState<string>()

  useEffect(() => {
    if (open) {
      setF(value)
      setMinPriceText(decimalToInput(value.minPrice))
      setMaxPriceText(decimalToInput(value.maxPrice))
      setGeoError(undefined)
    }
  }, [open, value])

  const subOptions = uniqueSorted(
    (f.categories.length ? f.categories : (['vino', 'spritz'] as Category[])).flatMap((c) => settings.subcategories[c]),
  )
  const showWine = !f.categories.length || f.categories.includes('vino')

  const setNear = async (radiusKm: number) => {
    if (f.near?.radiusKm === radiusKm) {
      setF({ ...f, near: undefined })
      return
    }
    if (f.near) {
      setF({ ...f, near: { ...f.near, radiusKm } })
      return
    }
    setLocating(true)
    setGeoError(undefined)
    try {
      const c = await getPosition()
      setF((prev) => ({ ...prev, near: { lat: c.lat, lon: c.lon, radiusKm } }))
    } catch (e) {
      setGeoError((e as Error).message)
    } finally {
      setLocating(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Filtri"
      footer={
        <div className="flex gap-2">
          <button type="button" className="rounded-xl border border-line px-4 py-3" onClick={() => setF(EMPTY_FILTERS)}>
            Azzera
          </button>
          <button type="button" className="rounded-xl border border-line px-4 py-3" onClick={() => onSave(f)}>
            Salva…
          </button>
          <button
            type="button"
            className="flex-1 rounded-xl bg-accent py-3 font-semibold text-white"
            onClick={() => {
              onApply(f)
              onClose()
            }}
          >
            Applica
          </button>
        </div>
      }
    >
      <Section title="Categoria">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <Chip key={c.id} active={f.categories.includes(c.id)} onClick={() => setF({ ...f, categories: toggle(f.categories, c.id) })}>
              {c.emoji} {c.label}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {subOptions.map((s) => (
            <Chip key={s} small active={f.subcategories.includes(s)} onClick={() => setF({ ...f, subcategories: toggle(f.subcategories, s) })}>
              {s}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="Voto">
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-sm text-muted">Da</span>
            <select
              className="field"
              value={f.minRating2x ?? ''}
              onChange={(e) => setF({ ...f, minRating2x: e.target.value ? Number(e.target.value) : undefined })}
            >
              <option value="">Qualsiasi</option>
              {RATING_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  ≥ {String(r / 2).replace('.', ',')}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm text-muted">A</span>
            <select
              className="field"
              value={f.maxRating2x ?? ''}
              onChange={(e) => setF({ ...f, maxRating2x: e.target.value ? Number(e.target.value) : undefined })}
            >
              <option value="">Qualsiasi</option>
              {RATING_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  ≤ {String(r / 2).replace('.', ',')}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Section>

      <Section title="Prezzo pagato (€)">
        <div className="grid grid-cols-2 gap-3">
          <input
            className="field"
            inputMode="decimal"
            placeholder="Min"
            value={minPriceText}
            onChange={(e) => {
              setMinPriceText(e.target.value)
              setF({ ...f, minPrice: parseDecimal(e.target.value) })
            }}
          />
          <input
            className="field"
            inputMode="decimal"
            placeholder="Max"
            value={maxPriceText}
            onChange={(e) => {
              setMaxPriceText(e.target.value)
              setF({ ...f, maxPrice: parseDecimal(e.target.value) })
            }}
          />
        </div>
        <Chip small active={f.onlyDiscounted} onClick={() => setF({ ...f, onlyDiscounted: !f.onlyDiscounted })}>
          Solo scontati
        </Chip>
      </Section>

      <Section title="Lo riprenderei">
        <div className="flex gap-2">
          {BUY_AGAIN.map((b) => (
            <Chip key={b.id} active={f.buyAgain.includes(b.id)} onClick={() => setF({ ...f, buyAgain: toggle(f.buyAgain, b.id) })}>
              {b.label}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="Vicino a me">
        <div className="flex flex-wrap gap-2">
          {RADII.map((r) => (
            <Chip key={r} small active={f.near?.radiusKm === r} onClick={() => setNear(r)}>
              {r} km
            </Chip>
          ))}
        </div>
        {locating && <p className="text-sm text-muted">Cerco la posizione…</p>}
        {geoError && <p className="text-sm text-warn">{geoError}</p>}
      </Section>

      <ChipGroup title="Tag" options={sug.tags} selected={f.tags} onChange={(tags) => setF({ ...f, tags })} />
      <ChipGroup title="Abbinamenti" options={sug.pairingsUsed} selected={f.pairings} onChange={(pairings) => setF({ ...f, pairings })} />

      {showWine && (
        <>
          <ChipGroup title="Regione" options={sug.regionsUsed} selected={f.regions} onChange={(regions) => setF({ ...f, regions })} />
          <ChipGroup title="Vitigno" options={sug.grapesUsed} selected={f.grapes} onChange={(grapes) => setF({ ...f, grapes })} />
          <ChipGroup title="Cantina" options={sug.producers} selected={f.producers} onChange={(producers) => setF({ ...f, producers })} />
          {sug.vintages.length > 0 && (
            <Section title="Annata">
              <div className="flex flex-wrap gap-2">
                {sug.vintages.map((v) => (
                  <Chip key={v} small active={f.vintages.includes(v)} onClick={() => setF({ ...f, vintages: toggle(f.vintages, v) })}>
                    {v}
                  </Chip>
                ))}
              </div>
            </Section>
          )}
        </>
      )}

      <ChipGroup title="Negozio" options={sug.shops} selected={f.shops} onChange={(shops) => setF({ ...f, shops })} />

      <Section title="Periodo">
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-sm text-muted">Dal</span>
            <input type="date" className="field" value={f.dateFrom ?? ''} onChange={(e) => setF({ ...f, dateFrom: e.target.value || undefined })} />
          </label>
          <label className="space-y-1">
            <span className="text-sm text-muted">Al</span>
            <input type="date" className="field" value={f.dateTo ?? ''} onChange={(e) => setF({ ...f, dateTo: e.target.value || undefined })} />
          </label>
        </div>
      </Section>
    </Sheet>
  )
}

function ChipGroup({
  title,
  options,
  selected,
  onChange,
}: {
  title: string
  options: string[]
  selected: string[]
  onChange: (v: string[]) => void
}) {
  if (!options.length) return null
  return (
    <Section title={title}>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Chip key={o} small active={selected.includes(o)} onClick={() => onChange(toggle(selected, o))}>
            {o}
          </Chip>
        ))}
      </div>
    </Section>
  )
}
