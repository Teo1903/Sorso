import { useEffect, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import { normalize } from '../lib/format'

export function Chip({
  active,
  onClick,
  children,
  small,
}: {
  active?: boolean
  onClick?: () => void
  children: ReactNode
  small?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 rounded-full border transition-colors ${small ? 'px-2.5 py-1 text-sm' : 'px-3.5 py-1.5'} ${
        active ? 'border-accent bg-accent text-white' : 'border-line bg-surface-2 text-text active:bg-line'
      }`}
    >
      {children}
    </button>
  )
}

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  )
}

/** Lista di chip con aggiunta libera e suggerimenti. */
export function TagInput({
  value,
  onChange,
  suggestions,
  placeholder,
  label,
}: {
  value: string[]
  onChange: (v: string[]) => void
  suggestions: string[]
  placeholder?: string
  label?: string
}) {
  const [text, setText] = useState('')
  const has = (s: string) => value.some((v) => normalize(v) === normalize(s))
  const add = (raw: string) => {
    const s = raw.trim().replace(/,$/, '').trim()
    if (s && !has(s)) onChange([...value, s])
    setText('')
  }
  const q = normalize(text)
  const visible = suggestions.filter((s) => !has(s) && (!q || normalize(s).includes(q))).slice(0, 12)
  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((v) => (
            <Chip key={v} active small onClick={() => onChange(value.filter((x) => x !== v))}>
              {v} ✕
            </Chip>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          className="field"
          value={text}
          aria-label={label ?? placeholder}
          placeholder={placeholder}
          enterKeyHint="done"
          onChange={(e) => {
            const v = e.target.value
            if (v.endsWith(',')) add(v)
            else setText(v)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add(text)
            }
          }}
          onBlur={() => text.trim() && add(text)}
        />
        {text.trim() && (
          <button type="button" className="rounded-xl bg-accent px-4 text-white" onClick={() => add(text)}>
            +
          </button>
        )}
      </div>
      {visible.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {visible.map((s) => (
            <Chip key={s} small onClick={() => add(s)}>
              + {s}
            </Chip>
          ))}
        </div>
      )}
    </div>
  )
}

/** URL di una foto salvata (miniatura o intera), revocato automaticamente. */
export function usePhotoUrl(photoId: string | undefined, size: 'thumb' | 'full'): string | undefined {
  const photo = useLiveQuery(() => (photoId ? db.photos.get(photoId) : undefined), [photoId])
  const blob = photo ? photo[size] : undefined
  return useBlobUrl(blob)
}

export function useBlobUrl(blob: Blob | undefined): string | undefined {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!blob) {
      setUrl(undefined)
      return
    }
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className="flex max-h-[92dvh] w-full max-w-xl flex-col rounded-t-3xl bg-surface"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" className="rounded-full px-3 py-1 text-muted" onClick={onClose} aria-label="Chiudi">
            ✕
          </button>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="pb-safe border-t border-line px-5 pt-3">{footer}</div>}
      </div>
    </div>
  )
}

export function Toast({ message, onDone }: { message: string | undefined; onDone: () => void }) {
  useEffect(() => {
    if (!message) return
    const t = setTimeout(onDone, 3500)
    return () => clearTimeout(t)
  }, [message, onDone])
  if (!message) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <div role="status" className="rounded-xl bg-text px-4 py-2.5 text-sm text-bg shadow-lg">
        {message}
      </div>
    </div>
  )
}
