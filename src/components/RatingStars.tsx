import { useId, useRef } from 'react'
import { formatRating } from '../lib/format'

const STAR_PATH =
  'M12 2.5l2.94 6.18 6.78.86-4.98 4.69 1.26 6.72L12 17.67l-6 3.28 1.26-6.72L2.28 9.54l6.78-.86L12 2.5z'

function Star({ fill, size, uid }: { fill: 0 | 0.5 | 1; size: number; uid: string }) {
  const clipId = `${uid}-half`
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <defs>
        <clipPath id={clipId}>
          <rect x="0" y="0" width="12" height="24" />
        </clipPath>
      </defs>
      <path d={STAR_PATH} fill="none" stroke="var(--muted)" strokeOpacity="0.55" strokeWidth="1.6" />
      {fill === 1 && <path d={STAR_PATH} fill="var(--gold)" stroke="var(--gold)" strokeWidth="1.2" />}
      {fill === 0.5 && (
        <path d={STAR_PATH} fill="var(--gold)" stroke="var(--gold)" strokeWidth="1.2" clipPath={`url(#${clipId})`} />
      )}
    </svg>
  )
}

/** Voto da 1 a 10 stelle con mezze stelle. Il valore è rating2x (2..20). */
export function RatingStars({
  value2x,
  onChange,
}: {
  value2x: number | undefined
  onChange: (v2x: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const uid = useId().replace(/:/g, '')
  const dragging = useRef(false)

  const fromPointer = (clientX: number) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width)
    const v2x = Math.min(20, Math.max(2, Math.ceil((x / rect.width) * 20)))
    if (v2x !== value2x) onChange(v2x)
  }

  const v = value2x ?? 0
  return (
    <div className="flex items-center gap-3">
      <div
        ref={ref}
        role="slider"
        tabIndex={0}
        aria-label="Voto"
        aria-valuemin={1}
        aria-valuemax={10}
        aria-valuenow={value2x ? value2x / 2 : undefined}
        aria-valuetext={value2x ? `${formatRating(value2x)} su 10` : 'nessun voto'}
        className="flex flex-1 touch-none select-none justify-between py-1 outline-none focus-visible:ring-2 focus-visible:ring-accent"
        onPointerDown={(e) => {
          dragging.current = true
          ;(e.target as Element).setPointerCapture?.(e.pointerId)
          fromPointer(e.clientX)
        }}
        onPointerMove={(e) => dragging.current && fromPointer(e.clientX)}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onChange(Math.min(20, (value2x ?? 1) + 1))
          if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onChange(Math.max(2, (value2x ?? 3) - 1))
        }}
      >
        {Array.from({ length: 10 }, (_, i) => {
          const fill: 0 | 0.5 | 1 = v >= (i + 1) * 2 ? 1 : v === i * 2 + 1 ? 0.5 : 0
          return <Star key={i} fill={fill} size={30} uid={`${uid}${i}`} />
        })}
      </div>
      <div className="w-12 text-right text-2xl font-bold tabular-nums">{value2x ? formatRating(value2x) : '–'}</div>
    </div>
  )
}

export function RatingBadge({ rating2x, big }: { rating2x: number; big?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 font-semibold tabular-nums ${big ? 'text-xl' : 'text-sm'}`}>
      <svg width={big ? 20 : 14} height={big ? 20 : 14} viewBox="0 0 24 24" aria-hidden="true">
        <path d={STAR_PATH} fill="var(--gold)" />
      </svg>
      {formatRating(rating2x)}
    </span>
  )
}
