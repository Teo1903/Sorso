import { useState } from 'react'
import { PRICE_UNITS, type Price } from '../db/schema'
import { decimalToInput, discountPct, parseDecimal } from '../lib/format'
import { Chip } from './ui'

export function PriceInput({ value, onChange }: { value: Price; onChange: (p: Price) => void }) {
  const [fullText, setFullText] = useState(decimalToInput(value.full))
  const [discText, setDiscText] = useState(decimalToInput(value.discounted))
  const pct = discountPct(value)
  const invalid = value.full !== undefined && value.discounted !== undefined && value.discounted > value.full

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {PRICE_UNITS.map((u) => (
          <Chip key={u.id} small active={!value.unknown && value.unit === u.id} onClick={() => onChange({ ...value, unknown: false, unit: u.id })}>
            {u.label}
          </Chip>
        ))}
        <Chip small active={value.unknown} onClick={() => onChange({ ...value, unknown: !value.unknown })}>
          Non so
        </Chip>
      </div>
      {!value.unknown && (
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-sm text-muted">Prezzo pieno €</span>
            <input
              className="field"
              inputMode="decimal"
              placeholder="es. 12,50"
              value={fullText}
              onChange={(e) => {
                setFullText(e.target.value)
                onChange({ ...value, full: parseDecimal(e.target.value) })
              }}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm text-muted">Scontato € (se c'è)</span>
            <input
              className={`field ${invalid ? '!border-bad' : ''}`}
              inputMode="decimal"
              placeholder="facoltativo"
              value={discText}
              onChange={(e) => {
                setDiscText(e.target.value)
                onChange({ ...value, discounted: parseDecimal(e.target.value) })
              }}
            />
          </label>
        </div>
      )}
      {!value.unknown && invalid && <p className="text-sm text-bad">Lo scontato è più alto del pieno: controlla i valori.</p>}
      {!value.unknown && !invalid && pct !== undefined && pct > 0 && (
        <p className="text-sm text-ok">Sconto del {pct}%</p>
      )}
    </div>
  )
}
