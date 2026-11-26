import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { BUY_AGAIN, CATEGORIES, db, type Entry } from '../db/schema'
import { deleteEntry } from '../db/repo'
import { entryTitle, formatDate, normalize, priceLabel } from '../lib/format'
import { mapsUrl } from '../lib/geo'
import { useAllEntries } from '../lib/hooks'
import { RatingBadge } from '../components/RatingStars'
import { Toast, usePhotoUrl } from '../components/ui'

function sameDrink(a: Entry, b: Entry): boolean {
  if (a.id === b.id || a.category !== b.category) return false
  if (a.sourceEntryId && (a.sourceEntryId === b.id || a.sourceEntryId === b.sourceEntryId)) return true
  if (b.sourceEntryId === a.id) return true
  if (!a.name || !b.name || normalize(a.name) !== normalize(b.name)) return false
  const pa = a.wine?.producer ? normalize(a.wine.producer) : ''
  const pb = b.wine?.producer ? normalize(b.wine.producer) : ''
  return !pa || !pb || pa === pb
}

export default function EntryDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const entry = useLiveQuery(() => (id ? db.entries.get(id) : undefined), [id], null)
  const all = useAllEntries()
  const photoUrl = usePhotoUrl(entry?.photoId ?? undefined, 'full')
  const [zoom, setZoom] = useState(false)
  const [toast, setToast] = useState<string | undefined>(
    (location.state as { saved?: boolean } | null)?.saved ? 'Salvato ✓' : undefined,
  )

  const history = useMemo(() => {
    if (!entry || !all) return []
    return all.filter((e) => sameDrink(entry, e)).sort((a, b) => b.consumedOn.localeCompare(a.consumedOn))
  }, [entry, all])

  if (entry === null) return <div className="p-6 text-muted">Caricamento…</div>
  if (!entry)
    return (
      <div className="space-y-4 p-6">
        <p>Scheda non trovata.</p>
        <Link to="/" className="text-accent underline">
          Torna all'archivio
        </Link>
      </div>
    )

  const cat = CATEGORIES.find((c) => c.id === entry.category)
  const buy = BUY_AGAIN.find((b) => b.id === entry.buyAgain)
  const buyColor = entry.buyAgain === 'si' ? 'bg-ok' : entry.buyAgain === 'forse' ? 'bg-warn' : 'bg-bad'

  const onDelete = async () => {
    if (!window.confirm(`Eliminare "${entryTitle(entry)}"? L'operazione non si può annullare.`)) return
    await deleteEntry(entry.id)
    navigate('/', { replace: true })
  }

  const back = () => {
    if (location.key !== 'default') navigate(-1)
    else navigate('/', { replace: true })
  }

  return (
    <div className="mx-auto max-w-xl pb-28">
      <Toast message={toast} onDone={() => setToast(undefined)} />
      <header className="pt-safe sticky top-0 z-20 flex items-center justify-between border-b border-line bg-bg/95 px-4 pb-3 backdrop-blur">
        <button type="button" className="py-1 text-muted" onClick={back}>
          ‹ Archivio
        </button>
        <Link to={`/e/${entry.id}/edit`} className="py-1 font-semibold text-accent">
          Modifica
        </Link>
      </header>

      {photoUrl && (
        <button type="button" className="block w-full bg-surface" onClick={() => setZoom(true)} aria-label="Ingrandisci foto">
          <img src={photoUrl} alt={entryTitle(entry)} className="max-h-[55dvh] w-full object-contain" />
        </button>
      )}

      <div className="space-y-6 px-4 pt-4">
        <div className="space-y-2">
          <p className="text-sm text-muted">
            {cat?.emoji} {cat?.label}
            {entry.subcategory ? ` · ${entry.subcategory}` : ''} · {formatDate(entry.consumedOn)}
          </p>
          <h1 className="text-2xl font-bold leading-tight">{entryTitle(entry)}</h1>
          {entry.wine?.producer && (
            <p className="text-muted">
              {entry.wine.producer}
              {entry.wine.vintage ? ` · ${entry.wine.vintage}` : ''}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <RatingBadge rating2x={entry.rating2x} big />
            {buy && <span className={`rounded-full px-3 py-1 text-sm font-medium text-white ${buyColor}`}>Lo riprenderei: {buy.label}</span>}
          </div>
          <p className="text-lg">{priceLabel(entry.price)}</p>
        </div>

        {entry.notes && (
          <Block title="Sensazioni">
            <p className="whitespace-pre-wrap leading-relaxed">{entry.notes}</p>
          </Block>
        )}

        {entry.pairings.length > 0 && (
          <Block title="Abbinamenti">
            <Pills items={entry.pairings} />
          </Block>
        )}

        {entry.tags.length > 0 && (
          <Block title="Tag">
            <Pills items={entry.tags.map((t) => `#${t}`)} />
          </Block>
        )}

        {entry.wine && (
          <Block title="Dettagli vino">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
              <Row k="Cantina" v={entry.wine.producer} />
              <Row k="Annata" v={entry.wine.vintage?.toString()} />
              <Row k="Vitigni" v={entry.wine.grapes.join(', ')} />
              <Row k="Regione" v={entry.wine.region} />
              <Row k="Denominazione" v={entry.wine.appellation} />
              <Row k="Grado" v={entry.wine.abv !== undefined ? `${String(entry.wine.abv).replace('.', ',')}% vol` : undefined} />
            </dl>
          </Block>
        )}

        {entry.drankAt && (
          <Block title="Dove l'ho bevuto">
            <Place p={entry.drankAt} />
          </Block>
        )}

        {entry.boughtAt && (
          <Block title="Dove l'ho comprato">
            {entry.boughtAt.shopName && <p className="font-medium">{entry.boughtAt.shopName}</p>}
            <Place p={entry.boughtAt} />
          </Block>
        )}

        {history.length > 0 && (
          <Block title="Altre volte">
            <ul className="divide-y divide-line rounded-xl bg-surface">
              {history.map((h) => (
                <li key={h.id}>
                  <Link to={`/e/${h.id}`} className="flex items-center justify-between px-4 py-3">
                    <span>{formatDate(h.consumedOn)}</span>
                    <RatingBadge rating2x={h.rating2x} />
                  </Link>
                </li>
              ))}
            </ul>
          </Block>
        )}

        <div className="grid grid-cols-2 gap-3 pt-2">
          <Link to={`/new?from=${entry.id}`} className="rounded-2xl bg-accent py-3.5 text-center font-semibold text-white">
            🔁 Bevuto di nuovo
          </Link>
          <button type="button" onClick={onDelete} className="rounded-2xl border border-bad py-3.5 font-semibold text-bad">
            Elimina
          </button>
        </div>
      </div>

      {zoom && photoUrl && (
        <button type="button" className="fixed inset-0 z-50 flex items-center justify-center bg-black" onClick={() => setZoom(false)} aria-label="Chiudi foto">
          <img src={photoUrl} alt="" className="max-h-full max-w-full object-contain" />
        </button>
      )}
    </div>
  )
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      {children}
    </section>
  )
}

function Pills({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((i) => (
        <span key={i} className="rounded-full bg-surface-2 px-3 py-1 text-sm">
          {i}
        </span>
      ))}
    </div>
  )
}

function Row({ k, v }: { k: string; v?: string }) {
  if (!v) return null
  return (
    <>
      <dt className="text-muted">{k}</dt>
      <dd>{v}</dd>
    </>
  )
}

function Place({ p }: { p: { label?: string; lat?: number; lon?: number } }) {
  return (
    <div className="space-y-1">
      {p.label && <p>{p.label}</p>}
      {p.lat !== undefined && p.lon !== undefined && (
        <a href={mapsUrl({ lat: p.lat, lon: p.lon })} target="_blank" rel="noreferrer" className="text-accent underline">
          📍 Apri in Mappe
        </a>
      )}
    </div>
  )
}
