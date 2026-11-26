import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { BUY_AGAIN, CATEGORIES, db, type Category, type Entry, type GeoPoint, type Price } from '../db/schema'
import { newId, saveEntry } from '../db/repo'
import { getSettings, setSetting, useSettings } from '../lib/settings'
import { processPhoto } from '../lib/image'
import { decimalToInput, normalize, parseDecimal, todayIso, uniqueSorted } from '../lib/format'
import { useAllEntries, useSuggestions } from '../lib/hooks'
import { RatingStars } from '../components/RatingStars'
import { PriceInput } from '../components/PriceInput'
import { PlaceField } from '../components/PlaceField'
import { HiddenPhotoInput, takePendingPhoto } from '../components/PhotoPicker'
import { Chip, Section, TagInput, Toast, useBlobUrl, usePhotoUrl } from '../components/ui'

type PhotoState =
  | { kind: 'unchanged' }
  | { kind: 'new'; full: Blob; thumb: Blob }
  | { kind: 'removed' }

const DRAFT_KEY = 'new'
const DRAFT_MAX_AGE = 24 * 3600 * 1000

function blankEntry(category?: Category): Entry {
  const now = Date.now()
  return {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    consumedOn: todayIso(),
    category: category ?? 'vino',
    rating2x: 0,
    price: { unknown: false, unit: category === 'spritz' ? 'drink' : 'bottiglia' },
    pairings: [],
    tags: [],
  }
}

export default function EntryForm() {
  const { id: editId } = useParams()
  const [params] = useSearchParams()
  const fromId = params.get('from')
  const wantsCamera = params.get('camera') === '1'
  const navigate = useNavigate()
  const settings = useSettings()
  const entries = useAllEntries()
  const sug = useSuggestions(entries)

  const [entry, setEntry] = useState<Entry>()
  const [photo, setPhoto] = useState<PhotoState>({ kind: 'unchanged' })
  const [busyPhoto, setBusyPhoto] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [toast, setToast] = useState<string>()
  const [restoredDraft, setRestoredDraft] = useState(false)
  const [showWine, setShowWine] = useState(false)
  const [showBought, setShowBought] = useState(false)
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const isNew = !editId

  const handleFile = useCallback(async (f: Blob) => {
    setBusyPhoto(true)
    try {
      const p = await processPhoto(f)
      setPhoto({ kind: 'new', ...p })
    } catch {
      setToast('Non riesco a leggere questa foto.')
    } finally {
      setBusyPhoto(false)
    }
  }, [])

  // caricamento iniziale
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const s = await getSettings()
      if (editId) {
        const e = await db.entries.get(editId)
        if (!cancelled) {
          if (!e) navigate('/', { replace: true })
          else {
            setEntry(structuredClone(e))
            setShowWine(!!e.wine && Object.values(e.wine).some((v) => (Array.isArray(v) ? v.length : v !== undefined && v !== '')))
            setShowBought(!!e.boughtAt)
          }
        }
        return
      }
      if (fromId) {
        const src = await db.entries.get(fromId)
        if (src && !cancelled) {
          const now = Date.now()
          setEntry({
            ...structuredClone(src),
            id: newId(),
            createdAt: now,
            updatedAt: now,
            consumedOn: todayIso(),
            rating2x: src.rating2x,
            notes: '',
            drankAt: undefined,
            sourceEntryId: src.sourceEntryId ?? src.id,
          })
          setShowWine(!!src.wine)
          setShowBought(!!src.boughtAt)
          return
        }
      }
      const pending = takePendingPhoto()
      if (pending) {
        await db.drafts.delete(DRAFT_KEY)
        if (!cancelled) {
          setEntry(blankEntry(s.lastCategory))
          handleFile(pending)
        }
        return
      }
      const draft = await db.drafts.get(DRAFT_KEY)
      if (draft && Date.now() - draft.savedAt < DRAFT_MAX_AGE && !cancelled) {
        setEntry({ ...blankEntry(s.lastCategory), ...draft.entry } as Entry)
        if (draft.photo) setPhoto({ kind: 'new', ...draft.photo })
        setShowWine(!!draft.entry.wine)
        setShowBought(!!draft.entry.boughtAt)
        setRestoredDraft(true)
        return
      }
      if (!cancelled) setEntry(blankEntry(s.lastCategory))
    })()
    return () => {
      cancelled = true
    }
  }, [editId, fromId, navigate, handleFile])

  // bozza automatica (solo nuove schede)
  useEffect(() => {
    if (!entry || !isNew || fromId) return
    const t = setTimeout(() => {
      db.drafts.put({
        key: DRAFT_KEY,
        entry,
        photo: photo.kind === 'new' ? { full: photo.full, thumb: photo.thumb } : undefined,
        savedAt: Date.now(),
      })
    }, 400)
    return () => clearTimeout(t)
  }, [entry, photo, isNew, fromId])

  const existingPhotoUrl = usePhotoUrl(photo.kind === 'unchanged' ? entry?.photoId : undefined, 'full')
  const newPhotoUrl = useBlobUrl(photo.kind === 'new' ? photo.full : undefined)
  const previewUrl = photo.kind === 'new' ? newPhotoUrl : photo.kind === 'removed' ? undefined : existingPhotoUrl

  if (!entry) return <div className="p-6 text-muted">Caricamento…</div>

  const set = <K extends keyof Entry>(k: K, v: Entry[K]) => setEntry((e) => (e ? { ...e, [k]: v } : e))
  const setWine = (patch: Partial<NonNullable<Entry['wine']>>) =>
    setEntry((e) => (e ? { ...e, wine: { grapes: [], ...e.wine, ...patch } } : e))

  const changeCategory = (c: Category) => {
    setEntry((e) => {
      if (!e) return e
      const subs = settings.subcategories[c]
      const keepSub = e.subcategory && subs.some((s) => normalize(s) === normalize(e.subcategory!))
      const priceUntouched = !e.price || (e.price.full === undefined && e.price.discounted === undefined)
      return {
        ...e,
        category: c,
        subcategory: keepSub ? e.subcategory : undefined,
        price: priceUntouched
          ? { ...(e.price ?? { unknown: false }), unknown: e.price?.unknown ?? false, unit: c === 'spritz' ? 'drink' : 'bottiglia' }
          : e.price,
      }
    })
  }

  const cleanEntry = (e: Entry): Entry => {
    const out: Entry = { ...e, name: e.name?.trim() || undefined, notes: e.notes?.trim() || undefined }
    if (out.price && !out.price.unknown && out.price.full === undefined && out.price.discounted === undefined) {
      out.price = undefined
    }
    if (out.price && out.price.full === undefined && out.price.discounted !== undefined) {
      // un solo prezzo inserito nel campo "scontato": lo trattiamo come prezzo pieno
      out.price = { ...out.price, full: out.price.discounted, discounted: undefined }
    }
    if (out.category !== 'vino') out.wine = undefined
    if (out.wine) {
      const w = { ...out.wine, producer: out.wine.producer?.trim() || undefined, region: out.wine.region?.trim() || undefined, appellation: out.wine.appellation?.trim() || undefined }
      const empty = !w.producer && !w.region && !w.appellation && w.vintage === undefined && w.abv === undefined && !w.grapes.length
      out.wine = empty ? undefined : w
    }
    const cleanPlace = <T extends GeoPoint>(p?: T): T | undefined => {
      if (!p) return undefined
      const label = p.label?.trim() || undefined
      const has = label || p.lat !== undefined || ('shopName' in p && (p as { shopName?: string }).shopName?.trim())
      return has ? { ...p, label } : undefined
    }
    out.drankAt = cleanPlace(out.drankAt)
    out.boughtAt = cleanPlace(out.boughtAt)
    if (out.boughtAt) out.boughtAt.shopName = out.boughtAt.shopName?.trim() || undefined
    return out
  }

  const validate = (e: Entry): string[] => {
    const errs: string[] = []
    if (!e.rating2x) errs.push('Dai un voto (tocca le stelle).')
    if (e.price && !e.price.unknown && e.price.full !== undefined && e.price.discounted !== undefined && e.price.discounted > e.price.full)
      errs.push('Il prezzo scontato è più alto del pieno.')
    if (e.wine?.vintage !== undefined && (e.wine.vintage < 1900 || e.wine.vintage > new Date().getFullYear() + 1))
      errs.push('Annata non valida.')
    return errs
  }

  const onSave = async () => {
    const e = cleanEntry(entry)
    const errs = validate(e)
    setErrors(errs)
    if (errs.length) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setSaving(true)
    try {
      const p = photo.kind === 'new' ? { full: photo.full, thumb: photo.thumb } : photo.kind === 'removed' ? null : undefined
      await saveEntry(e, p)
      await setSetting('lastCategory', e.category)
      // nuove sottocategorie/abbinamenti entrano nelle liste
      if (e.subcategory && !settings.subcategories[e.category].some((s) => normalize(s) === normalize(e.subcategory!))) {
        await setSetting('subcategories', { ...settings.subcategories, [e.category]: [...settings.subcategories[e.category], e.subcategory] })
      }
      const newPairings = e.pairings.filter((p) => !settings.pairings.some((x) => normalize(x) === normalize(p)))
      if (newPairings.length) await setSetting('pairings', [...settings.pairings, ...newPairings])
      if (isNew) await db.drafts.delete(DRAFT_KEY)
      navigate(`/e/${e.id}`, { replace: true, state: { saved: true } })
    } catch (err) {
      setSaving(false)
      setToast(`Salvataggio non riuscito: ${(err as Error).message}`)
    }
  }

  const onCancel = async () => {
    if (isNew && !fromId) await db.drafts.delete(DRAFT_KEY)
    if (window.history.length > 1) navigate(-1)
    else navigate('/', { replace: true })
  }

  const subs = settings.subcategories[entry.category]
  const pairingOptions = uniqueSorted([...settings.pairings, ...sug.pairingsUsed])
  const price: Price = entry.price ?? { unknown: false, unit: entry.category === 'spritz' ? 'drink' : 'bottiglia' }

  return (
    <div className="mx-auto max-w-xl pb-32">
      <Toast message={toast} onDone={() => setToast(undefined)} />
      <header className="pt-safe sticky top-0 z-20 flex items-center justify-between border-b border-line bg-bg/95 px-4 pb-3 backdrop-blur">
        <button type="button" className="py-1 text-muted" onClick={onCancel}>
          Annulla
        </button>
        <h1 className="font-semibold">{editId ? 'Modifica' : fromId ? 'Bevuto di nuovo' : 'Nuova recensione'}</h1>
        <button type="button" className="py-1 font-semibold text-accent disabled:opacity-50" onClick={onSave} disabled={saving || busyPhoto}>
          Salva
        </button>
      </header>

      <div className="space-y-6 px-4 pt-4">
        {restoredDraft && (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-accent-soft px-4 py-3 text-sm">
            <span>Ho recuperato la scheda che stavi compilando.</span>
            <button
              type="button"
              className="shrink-0 underline"
              onClick={async () => {
                await db.drafts.delete(DRAFT_KEY)
                setEntry(blankEntry(settings.lastCategory))
                setPhoto({ kind: 'unchanged' })
                setRestoredDraft(false)
              }}
            >
              Ricomincia
            </button>
          </div>
        )}

        {errors.length > 0 && (
          <div role="alert" className="rounded-xl border border-bad px-4 py-3 text-sm text-bad">
            {errors.map((e) => (
              <p key={e}>{e}</p>
            ))}
          </div>
        )}

        {/* FOTO */}
        <div>
          <HiddenPhotoInput ref={cameraRef} camera onFile={handleFile} />
          <HiddenPhotoInput ref={galleryRef} onFile={handleFile} />
          {previewUrl ? (
            <div className="relative overflow-hidden rounded-2xl bg-surface">
              <img src={previewUrl} alt="Foto della bevanda" className="max-h-[50dvh] w-full object-contain" />
              <div className="absolute inset-x-0 bottom-0 flex justify-end gap-2 bg-gradient-to-t from-black/70 p-3">
                <button type="button" className="rounded-full bg-black/60 px-3 py-1.5 text-sm text-white" onClick={() => cameraRef.current?.click()}>
                  📷 Rifai
                </button>
                <button type="button" className="rounded-full bg-black/60 px-3 py-1.5 text-sm text-white" onClick={() => galleryRef.current?.click()}>
                  🖼️ Galleria
                </button>
                <button type="button" className="rounded-full bg-black/60 px-3 py-1.5 text-sm text-white" onClick={() => setPhoto({ kind: 'removed' })}>
                  🗑️
                </button>
              </div>
            </div>
          ) : (
            <div className={`grid grid-cols-2 gap-3 ${wantsCamera ? '' : ''}`}>
              <button
                type="button"
                className="flex h-32 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-accent bg-accent-soft text-lg font-medium"
                onClick={() => cameraRef.current?.click()}
              >
                <span className="text-3xl">📷</span>Scatta foto
              </button>
              <button
                type="button"
                className="flex h-32 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-line bg-surface text-lg"
                onClick={() => galleryRef.current?.click()}
              >
                <span className="text-3xl">🖼️</span>Dalla galleria
              </button>
            </div>
          )}
          {busyPhoto && <p className="mt-2 text-sm text-muted">Preparo la foto…</p>}
        </div>

        {/* CATEGORIA */}
        <Section title="Categoria">
          <div className="flex gap-2">
            {CATEGORIES.map((c) => (
              <Chip key={c.id} active={entry.category === c.id} onClick={() => changeCategory(c.id)}>
                {c.emoji} {c.label}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {subs.map((s) => (
              <Chip key={s} small active={entry.subcategory === s} onClick={() => set('subcategory', entry.subcategory === s ? undefined : s)}>
                {s}
              </Chip>
            ))}
          </div>
        </Section>

        {/* NOME */}
        <Section title="Nome">
          <input
            className="field"
            list="names-list"
            placeholder={entry.category === 'vino' ? 'es. Lambrusco Grasparossa' : 'es. Select al Bar Centrale'}
            value={entry.name ?? ''}
            onChange={(e) => set('name', e.target.value)}
          />
          <datalist id="names-list">
            {sug.names.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </Section>

        {/* VOTO */}
        <Section title="Voto">
          <RatingStars value2x={entry.rating2x || undefined} onChange={(v) => set('rating2x', v)} />
          <p className="text-xs text-muted">Tocca o trascina; la metà sinistra di una stella vale mezzo punto.</p>
        </Section>

        {/* PREZZO */}
        <Section title="Prezzo">
          <PriceInput value={price} onChange={(p) => set('price', p)} />
        </Section>

        {/* LO RIPRENDEREI */}
        <Section title="Lo riprenderei?">
          <div className="grid grid-cols-3 gap-2">
            {BUY_AGAIN.map((b) => {
              const active = entry.buyAgain === b.id
              const color = b.id === 'si' ? 'bg-ok' : b.id === 'forse' ? 'bg-warn' : 'bg-bad'
              return (
                <button
                  key={b.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => set('buyAgain', active ? undefined : b.id)}
                  className={`rounded-xl border py-3 text-lg font-medium ${active ? `${color} border-transparent text-white` : 'border-line bg-surface-2'}`}
                >
                  {b.label}
                </button>
              )
            })}
          </div>
        </Section>

        {/* SENSAZIONI */}
        <Section title="Sensazioni">
          <textarea
            className="field min-h-28"
            placeholder="Profumi, gusto, corpo, persistenza… cosa ti ha colpito?"
            value={entry.notes ?? ''}
            onChange={(e) => set('notes', e.target.value)}
          />
        </Section>

        {/* ABBINAMENTI */}
        <Section title="Abbinamenti consigliati">
          <TagInput value={entry.pairings} onChange={(v) => set('pairings', v)} suggestions={pairingOptions} placeholder="Aggiungi un abbinamento" />
        </Section>

        {/* TAG */}
        <Section title="Tag">
          <TagInput value={entry.tags} onChange={(v) => set('tags', v)} suggestions={sug.tags} placeholder="es. regalo, cena con amici" />
        </Section>

        {/* DETTAGLI VINO */}
        {entry.category === 'vino' && (
          <Section
            title="Dettagli vino"
            right={
              <button type="button" className="text-sm text-accent" onClick={() => setShowWine((v) => !v)}>
                {showWine ? 'Nascondi' : 'Mostra'}
              </button>
            }
          >
            {showWine && (
              <div className="space-y-3">
                <input
                  className="field"
                  list="producers-list"
                  placeholder="Cantina / produttore"
                  value={entry.wine?.producer ?? ''}
                  onChange={(e) => setWine({ producer: e.target.value })}
                />
                <datalist id="producers-list">
                  {sug.producers.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    className="field"
                    inputMode="numeric"
                    placeholder="Annata"
                    value={entry.wine?.vintage ?? ''}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 4)
                      setWine({ vintage: v ? Number(v) : undefined })
                    }}
                  />
                  <input
                    className="field"
                    inputMode="decimal"
                    placeholder="Grado % vol"
                    defaultValue={decimalToInput(entry.wine?.abv)}
                    onChange={(e) => setWine({ abv: parseDecimal(e.target.value) })}
                  />
                </div>
                <input
                  className="field"
                  list="regions-list"
                  placeholder="Regione / zona"
                  value={entry.wine?.region ?? ''}
                  onChange={(e) => setWine({ region: e.target.value })}
                />
                <datalist id="regions-list">
                  {sug.regions.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
                <input
                  className="field"
                  list="appellations-list"
                  placeholder="Denominazione (es. Chianti Classico DOCG)"
                  value={entry.wine?.appellation ?? ''}
                  onChange={(e) => setWine({ appellation: e.target.value })}
                />
                <datalist id="appellations-list">
                  {sug.appellations.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
                <TagInput
                  value={entry.wine?.grapes ?? []}
                  onChange={(v) => setWine({ grapes: v })}
                  suggestions={sug.grapes}
                  placeholder="Vitigno/i"
                />
              </div>
            )}
          </Section>
        )}

        {/* DOVE BEVUTO */}
        <Section title="Dove l'ho bevuto">
          <PlaceField
            value={entry.drankAt ?? {}}
            onChange={(v) => set('drankAt', v)}
            placeholder="Locale, ristorante, casa…"
            reverseGeocoding={settings.reverseGeocoding}
            suggestions={sug.places}
            listId="places-list"
          />
        </Section>

        {/* DOVE COMPRATO */}
        <Section
          title="Dove l'ho comprato"
          right={
            <button type="button" className="text-sm text-accent" onClick={() => setShowBought((v) => !v)}>
              {showBought ? 'Nascondi' : 'Aggiungi'}
            </button>
          }
        >
          {showBought && (
            <div className="space-y-3">
              <input
                className="field"
                list="shops-list"
                placeholder="Negozio, enoteca, supermercato, cantina…"
                value={entry.boughtAt?.shopName ?? ''}
                onChange={(e) => set('boughtAt', { ...entry.boughtAt, shopName: e.target.value })}
              />
              <datalist id="shops-list">
                {sug.shops.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
              <PlaceField
                value={{ lat: entry.boughtAt?.lat, lon: entry.boughtAt?.lon, accuracyM: entry.boughtAt?.accuracyM, label: entry.boughtAt?.label }}
                onChange={(v) => set('boughtAt', { shopName: entry.boughtAt?.shopName, ...v })}
                placeholder="Indirizzo o città (facoltativo)"
                reverseGeocoding={settings.reverseGeocoding}
                suggestions={[]}
                listId="bought-places-list"
              />
            </div>
          )}
        </Section>

        {/* DATA */}
        <Section title="Data">
          <input
            type="date"
            className="field"
            value={entry.consumedOn}
            max={todayIso()}
            onChange={(e) => e.target.value && set('consumedOn', e.target.value)}
          />
        </Section>
      </div>

      <div className="bottom-safe fixed inset-x-0 z-20 mx-auto flex max-w-xl px-4">
        <button
          type="button"
          onClick={onSave}
          disabled={saving || busyPhoto}
          className="w-full rounded-2xl bg-accent py-4 text-lg font-semibold text-white shadow-lg disabled:opacity-60"
        >
          {saving ? 'Salvo…' : busyPhoto ? 'Preparo la foto…' : 'Salva'}
        </button>
      </div>
    </div>
  )
}
