import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAllEntries, useSuggestions } from '../lib/hooks'
import { setSetting, useSettings } from '../lib/settings'
import { activeFilterCount, applyFilters, EMPTY_FILTERS, sortEntries, SORTS, type Filters, type SortKey } from '../lib/filters'
import { buildIndex, searchIds } from '../lib/search'
import { exportBackup } from '../lib/backup'
import { newId } from '../db/repo'
import { EntryCard, EntryTile } from '../components/EntryCard'
import { FilterSheet } from '../components/FilterSheet'
import { HiddenPhotoInput, setPendingPhoto } from '../components/PhotoPicker'
import { Chip, Toast } from '../components/ui'

const STATE_KEY = 'sorso.archive'

interface ArchiveState {
  query: string
  filters: Filters
  sort: SortKey
}

function loadState(): ArchiveState {
  try {
    const raw = sessionStorage.getItem(STATE_KEY)
    if (raw) {
      const s = JSON.parse(raw) as ArchiveState
      return { ...s, filters: { ...EMPTY_FILTERS, ...s.filters } }
    }
  } catch {
    /* ignora */
  }
  return { query: '', filters: EMPTY_FILTERS, sort: 'recent' }
}

export default function Archive() {
  const navigate = useNavigate()
  const entries = useAllEntries()
  const settings = useSettings()
  const sug = useSuggestions(entries)
  const [state, setState] = useState<ArchiveState>(loadState)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [toast, setToast] = useState<string>()
  const [backingUp, setBackingUp] = useState(false)
  const galleryRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      sessionStorage.setItem(STATE_KEY, JSON.stringify(state))
    } catch {
      /* ignora */
    }
  }, [state])

  const index = useMemo(() => (entries ? buildIndex(entries) : undefined), [entries])

  const results = useMemo(() => {
    if (!entries || !index) return []
    let list = applyFilters(entries, state.filters)
    if (state.query.trim()) {
      const ids = new Set(searchIds(index, state.query))
      list = list.filter((e) => ids.has(e.id))
    }
    return sortEntries(list, state.sort)
  }, [entries, index, state])

  const nFilters = activeFilterCount(state.filters)

  const onPhoto = (f: File) => {
    setPendingPhoto(f)
    navigate('/new')
  }

  const saveFilter = async (f: Filters) => {
    const name = window.prompt('Nome del filtro (es. "Rossi ≥ 8 sotto 15 €")')?.trim()
    if (!name) return
    await setSetting('savedFilters', [...settings.savedFilters, { id: newId(), name, filters: f }])
    setToast(`Filtro "${name}" salvato`)
  }

  const daysSinceBackup = settings.lastBackupAt ? (Date.now() - settings.lastBackupAt) / 86400000 : Infinity
  const total = entries?.length ?? 0
  const needsBackup =
    total > 0 && (settings.entriesSinceBackup >= 20 || (daysSinceBackup > 30 && settings.entriesSinceBackup > 0) || (!settings.lastBackupAt && total >= 5))

  const doBackup = async () => {
    setBackingUp(true)
    try {
      if (await exportBackup()) setToast('Backup creato ✓')
    } catch (e) {
      setToast(`Backup non riuscito: ${(e as Error).message}`)
    } finally {
      setBackingUp(false)
    }
  }

  const isActiveSaved = (f: Filters) => JSON.stringify(f) === JSON.stringify(state.filters)

  return (
    <div className="mx-auto max-w-xl pb-36">
      <Toast message={toast} onDone={() => setToast(undefined)} />
      <header className="pt-safe sticky top-0 z-20 space-y-3 border-b border-line bg-bg/95 px-4 pb-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">
            Sorso <span className="text-base font-normal text-muted">· {total}</span>
          </h1>
          <Link to="/settings" className="rounded-full p-2 text-xl" aria-label="Impostazioni">
            ⚙️
          </Link>
        </div>
        <input
          type="search"
          className="field"
          placeholder="Cerca nome, cantina, vitigno, note, tag…"
          value={state.query}
          onChange={(e) => setState((s) => ({ ...s, query: e.target.value }))}
          aria-label="Cerca"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 ${nFilters ? 'border-accent bg-accent-soft' : 'border-line bg-surface-2'}`}
          >
            Filtri
            {nFilters > 0 && <span className="rounded-full bg-accent px-1.5 text-xs text-white">{nFilters}</span>}
          </button>
          <select
            className="min-w-0 flex-1 rounded-full border border-line bg-surface-2 px-3 py-1.5"
            value={state.sort}
            onChange={(e) => setState((s) => ({ ...s, sort: e.target.value as SortKey }))}
            aria-label="Ordina"
          >
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="rounded-full border border-line bg-surface-2 px-3 py-1.5"
            onClick={() => setSetting('view', settings.view === 'list' ? 'grid' : 'list')}
            aria-label={settings.view === 'list' ? 'Vista griglia' : 'Vista elenco'}
          >
            {settings.view === 'list' ? '▦' : '☰'}
          </button>
        </div>
        {(settings.savedFilters.length > 0 || nFilters > 0) && (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {nFilters > 0 && (
              <Chip small onClick={() => setState((s) => ({ ...s, filters: EMPTY_FILTERS }))}>
                ✕ Azzera filtri
              </Chip>
            )}
            {settings.savedFilters.map((sf) => (
              <Chip
                key={sf.id}
                small
                active={isActiveSaved(sf.filters)}
                onClick={() => setState((s) => ({ ...s, filters: isActiveSaved(sf.filters) ? EMPTY_FILTERS : { ...EMPTY_FILTERS, ...sf.filters } }))}
              >
                ★ {sf.name}
              </Chip>
            ))}
          </div>
        )}
      </header>

      <main className="space-y-3 px-4 pt-3">
        {needsBackup && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-warn px-4 py-3 text-sm">
            <span>
              {settings.lastBackupAt ? `${settings.entriesSinceBackup} schede nuove dall'ultimo backup.` : 'Non hai ancora fatto un backup.'} I dati
              sono solo su questo telefono.
            </span>
            <button type="button" disabled={backingUp} className="shrink-0 rounded-lg bg-warn px-3 py-1.5 font-semibold text-black" onClick={doBackup}>
              {backingUp ? '…' : 'Backup'}
            </button>
          </div>
        )}

        {entries === undefined ? (
          <p className="text-muted">Caricamento…</p>
        ) : total === 0 ? (
          <div className="space-y-3 py-16 text-center">
            <p className="text-5xl">🍷🍹</p>
            <p className="text-lg font-semibold">Ancora nessuna recensione</p>
            <p className="text-muted">Tocca il pulsante qui sotto, fotografa la bottiglia o lo spritz e dai il tuo voto.</p>
          </div>
        ) : results.length === 0 ? (
          <div className="space-y-2 py-12 text-center">
            <p className="text-lg">Nessun risultato</p>
            <button
              type="button"
              className="text-accent underline"
              onClick={() => setState((s) => ({ ...s, query: '', filters: EMPTY_FILTERS }))}
            >
              Azzera ricerca e filtri
            </button>
          </div>
        ) : (
          <>
            {(nFilters > 0 || state.query) && <p className="text-sm text-muted">{results.length} risultati</p>}
            {settings.view === 'list' ? (
              <div className="space-y-2">
                {results.map((e) => (
                  <EntryCard key={e.id} entry={e} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {results.map((e) => (
                  <EntryTile key={e.id} entry={e} />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* pulsanti rapidi: il tocco apre direttamente la fotocamera */}
      <div className="bottom-safe fixed inset-x-0 z-30 mx-auto flex max-w-xl items-center justify-center gap-3 px-4">
        <HiddenPhotoInput ref={galleryRef} onFile={onPhoto} />
        <label
          htmlFor="fab-camera"
          className="flex h-16 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-accent text-lg font-semibold text-white shadow-xl active:scale-[0.98]"
        >
          <span className="text-2xl">📷</span> Nuova recensione
        </label>
        <HiddenPhotoInput id="fab-camera" camera onFile={onPhoto} />
        <button
          type="button"
          onClick={() => galleryRef.current?.click()}
          className="flex h-16 w-16 items-center justify-center rounded-full border border-line bg-surface text-2xl shadow-xl"
          aria-label="Nuova da galleria"
        >
          🖼️
        </button>
        <Link
          to="/new"
          className="flex h-16 w-16 items-center justify-center rounded-full border border-line bg-surface text-xl shadow-xl"
          aria-label="Nuova senza foto"
        >
          ✏️
        </Link>
      </div>

      <FilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        value={state.filters}
        onApply={(filters) => setState((s) => ({ ...s, filters }))}
        onSave={saveFilter}
        sug={sug}
        settings={settings}
      />
    </div>
  )
}
