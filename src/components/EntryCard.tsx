import { Link } from 'react-router-dom'
import { CATEGORIES, type Entry } from '../db/schema'
import { entryTitle, formatDate, formatEur, paidPrice } from '../lib/format'
import { RatingBadge } from './RatingStars'
import { usePhotoUrl } from './ui'

const BUY_DOT: Record<string, string> = { si: 'bg-ok', forse: 'bg-warn', no: 'bg-bad' }

export function EntryCard({ entry }: { entry: Entry }) {
  const url = usePhotoUrl(entry.photoId, 'thumb')
  const cat = CATEGORIES.find((c) => c.id === entry.category)
  const price = paidPrice(entry.price)
  const sub = [entry.subcategory, entry.wine?.producer, entry.wine?.vintage].filter(Boolean).join(' · ')
  return (
    <Link to={`/e/${entry.id}`} className="flex gap-3 rounded-2xl bg-surface p-2.5 active:bg-surface-2">
      <div className="flex h-20 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-2 text-2xl">
        {url ? <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" /> : cat?.emoji}
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate font-semibold">{entryTitle(entry)}</p>
          <RatingBadge rating2x={entry.rating2x} />
        </div>
        <p className="truncate text-sm text-muted">{sub || cat?.label}</p>
        <div className="mt-1 flex items-center gap-2 text-sm text-muted">
          {entry.buyAgain && <span className={`h-2.5 w-2.5 rounded-full ${BUY_DOT[entry.buyAgain]}`} aria-label={`Lo riprenderei: ${entry.buyAgain}`} />}
          <span>{formatDate(entry.consumedOn)}</span>
          {price !== undefined && (
            <span className="ml-auto text-text">
              {formatEur(price)}
              {entry.price?.discounted !== undefined && entry.price.full !== undefined && <span className="ml-1 text-ok">↓</span>}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

export function EntryTile({ entry }: { entry: Entry }) {
  const url = usePhotoUrl(entry.photoId, 'thumb')
  const cat = CATEGORIES.find((c) => c.id === entry.category)
  return (
    <Link to={`/e/${entry.id}`} className="relative block aspect-[3/4] overflow-hidden rounded-xl bg-surface">
      {url ? (
        <img src={url} alt={entryTitle(entry)} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="flex h-full items-center justify-center p-2 text-center text-sm text-muted">
          <span>
            <span className="block text-3xl">{cat?.emoji}</span>
            {entryTitle(entry)}
          </span>
        </div>
      )}
      <span className="absolute bottom-1 right-1 rounded-full bg-black/65 px-2 py-0.5 text-white">
        <RatingBadge rating2x={entry.rating2x} />
      </span>
    </Link>
  )
}
