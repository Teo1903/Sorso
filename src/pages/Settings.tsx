import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CATEGORIES, type Category } from '../db/schema'
import { setSetting, useSettings } from '../lib/settings'
import { exportBackup, exportCsv, importBackup } from '../lib/backup'
import { requestPersistence } from '../db/repo'
import { useAllEntries } from '../lib/hooks'
import { Section, TagInput, Toast } from '../components/ui'

function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1).replace('.', ',')} MB`
  return `${(n / 1024 ** 3).toFixed(2).replace('.', ',')} GB`
}

export default function Settings() {
  const settings = useSettings()
  const entries = useAllEntries()
  const [toast, setToast] = useState<string>()
  const [busy, setBusy] = useState<string>()
  const [storage, setStorage] = useState<{ usage?: number; quota?: number; persisted?: boolean }>({})
  const importRef = useRef<HTMLInputElement>(null)

  const refreshStorage = async () => {
    try {
      const est = await navigator.storage?.estimate?.()
      const persisted = await navigator.storage?.persisted?.()
      setStorage({ usage: est?.usage, quota: est?.quota, persisted })
    } catch {
      /* non supportato */
    }
  }
  useEffect(() => {
    refreshStorage()
  }, [entries?.length])

  const run = async (label: string, fn: () => Promise<string | undefined>) => {
    setBusy(label)
    try {
      const msg = await fn()
      if (msg) setToast(msg)
    } catch (e) {
      setToast((e as Error).message)
    } finally {
      setBusy(undefined)
      refreshStorage()
    }
  }

  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true

  return (
    <div className="mx-auto max-w-xl pb-16">
      <Toast message={toast} onDone={() => setToast(undefined)} />
      <header className="pt-safe sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-bg/95 px-4 pb-3 backdrop-blur">
        <Link to="/" className="py-1 text-muted">
          ‹ Archivio
        </Link>
        <h1 className="font-semibold">Impostazioni</h1>
      </header>

      <div className="space-y-8 px-4 pt-4">
        <Section title="Backup">
          <p className="text-sm text-muted">
            I dati sono salvati solo su questo dispositivo. Esporta un backup ogni tanto e conservalo su iCloud Drive, Google Drive o sul PC.
            {settings.lastBackupAt
              ? ` Ultimo backup: ${new Date(settings.lastBackupAt).toLocaleDateString('it-IT')}.`
              : ' Nessun backup ancora.'}
          </p>
          <div className="grid gap-2">
            <button
              type="button"
              disabled={!!busy}
              className="rounded-xl bg-accent py-3 font-semibold text-white disabled:opacity-60"
              onClick={() => run('export', async () => ((await exportBackup()) ? 'Backup creato ✓' : undefined))}
            >
              {busy === 'export' ? 'Preparo il backup…' : '⬆️ Esporta backup completo (.zip con foto)'}
            </button>
            <button
              type="button"
              disabled={!!busy}
              className="rounded-xl border border-line bg-surface py-3 disabled:opacity-60"
              onClick={() => importRef.current?.click()}
            >
              {busy === 'import' ? 'Importo…' : '⬇️ Importa backup'}
            </button>
            <input
              ref={importRef}
              type="file"
              accept=".zip,application/zip"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f)
                  run('import', async () => {
                    const r = await importBackup(f)
                    return `Importate ${r.added} nuove, ${r.updated} aggiornate, ${r.skipped} già presenti`
                  })
              }}
            />
            <button
              type="button"
              disabled={!!busy}
              className="rounded-xl border border-line bg-surface py-3 disabled:opacity-60"
              onClick={() => run('csv', async () => ((await exportCsv()) ? 'CSV esportato ✓' : undefined))}
            >
              📊 Esporta CSV per Excel (senza foto)
            </button>
          </div>
        </Section>

        <Section title="Spazio">
          <p className="text-sm">
            {entries?.length ?? 0} schede
            {storage.usage !== undefined && ` · ${formatBytes(storage.usage)} usati`}
            {storage.quota !== undefined && ` su ${formatBytes(storage.quota)} disponibili`}
          </p>
          <p className="text-sm text-muted">
            Archiviazione protetta: {storage.persisted ? 'sì ✓' : 'no'}
            {!storage.persisted && (
              <button
                type="button"
                className="ml-2 text-accent underline"
                onClick={() =>
                  run('persist', async () =>
                    (await requestPersistence())
                      ? 'Archiviazione protetta attivata ✓'
                      : 'Il browser non l\'ha concessa: installa l\'app nella schermata Home e fai backup regolari.',
                  )
                }
              >
                Richiedi
              </button>
            )}
          </p>
        </Section>

        {(['vino', 'spritz'] as Category[]).map((c) => (
          <Section key={c} title={`Sottocategorie ${CATEGORIES.find((x) => x.id === c)?.label}`}>
            <TagInput
              value={settings.subcategories[c]}
              onChange={(v) => setSetting('subcategories', { ...settings.subcategories, [c]: v })}
              suggestions={[]}
              placeholder="Aggiungi sottocategoria"
            />
          </Section>
        ))}

        <Section title="Abbinamenti suggeriti">
          <TagInput value={settings.pairings} onChange={(v) => setSetting('pairings', v)} suggestions={[]} placeholder="Aggiungi abbinamento" />
        </Section>

        {settings.savedFilters.length > 0 && (
          <Section title="Filtri salvati">
            <ul className="divide-y divide-line rounded-xl bg-surface">
              {settings.savedFilters.map((f) => (
                <li key={f.id} className="flex items-center justify-between px-4 py-3">
                  <span>★ {f.name}</span>
                  <button
                    type="button"
                    className="text-bad"
                    onClick={() => setSetting('savedFilters', settings.savedFilters.filter((x) => x.id !== f.id))}
                  >
                    Elimina
                  </button>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section title="Preferenze">
          <Toggle
            label="Suggerisci il nome del luogo dalla posizione"
            hint="Invia le coordinate a OpenStreetMap (Nominatim) solo quando tocchi «Usa posizione». È l'unico dato che esce dal telefono."
            checked={settings.reverseGeocoding}
            onChange={(v) => setSetting('reverseGeocoding', v)}
          />
          <Toggle
            label="Apri l'app direttamente su «Nuova recensione»"
            hint="All'avvio salta l'archivio e mostra subito i pulsanti Scatta foto / Galleria."
            checked={settings.startOnNew}
            onChange={(v) => setSetting('startOnNew', v)}
          />
        </Section>

        {!isStandalone && (
          <Section title="Installa sul telefono">
            <div className="space-y-2 rounded-xl bg-surface p-4 text-sm">
              <p>
                <b>iPhone (Safari):</b> tocca Condividi <span aria-hidden>⬆️</span> → «Aggiungi alla schermata Home».
              </p>
              <p>
                <b>Android (Chrome):</b> menu ⋮ → «Installa app» o «Aggiungi a schermata Home».
              </p>
              <p className="text-muted">
                Usa sempre l'app installata: su iPhone i dati dell'app installata sono separati da quelli di Safari. Se elimini l'icona, i dati
                vengono cancellati, quindi fai prima un backup.
              </p>
            </div>
          </Section>
        )}

        <p className="pb-4 text-center text-xs text-muted">Sorso v{__APP_VERSION__} · dati salvati solo su questo dispositivo</p>
      </div>
    </div>
  )
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl bg-surface p-4">
      <span className="space-y-1">
        <span className="block">{label}</span>
        {hint && <span className="block text-sm text-muted">{hint}</span>}
      </span>
      <input type="checkbox" className="mt-1 h-6 w-6 shrink-0 accent-[var(--accent)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}
