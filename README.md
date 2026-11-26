# Sorso 🍷🍹

App personale (PWA) per recensire vini e spritz: scatti una foto, dai un voto da 1 a 10 con mezze stelle, segni il prezzo (pieno, scontato o "non so"), le sensazioni e gli abbinamenti. Tutto resta archiviato **solo sul telefono** ed è ricercabile con filtri.

## Funzioni

- **Foto rapida**: il pulsante "Nuova recensione" apre direttamente la fotocamera; in alternativa si sceglie una foto dalla galleria o si crea la scheda senza foto. Le foto vengono compresse (1600px + miniatura).
- **Scheda**: categoria (Vino / Spritz) e sottocategoria, nome, voto 1–10 a mezze stelle, prezzo pieno/scontato con unità (bottiglia, calice, drink) o "Non so", "Lo riprenderei?" (Sì/Forse/No), sensazioni, abbinamenti, tag, dettagli del vino (cantina, annata, vitigni, regione, denominazione, grado), dove l'hai bevuto (GPS + nome) e dove l'hai comprato, data.
- **Archivio**: elenco o griglia, ricerca istantanea che tollera i refusi e ignora gli accenti, filtri combinabili (categoria, voto, prezzo, solo scontati, lo riprenderei, tag, abbinamenti, regione, vitigno, cantina, annata, negozio, periodo, vicino a me) e **filtri salvati**. Ordinamento per data, voto, prezzo e qualità/prezzo.
- **Bevuto di nuovo**: duplica una scheda per rivalutarla; nel dettaglio compare lo storico dei voti.
- **Bozza automatica** se l'app si chiude mentre compili.
- **Backup**: export/import `.zip` completo (dati + foto) e export CSV per Excel. Promemoria quando è ora di fare un backup.
- **Offline**: funziona senza rete una volta installata.
- **Privacy**: nessun server, nessun account. L'unica chiamata esterna, facoltativa e disattivabile, è il suggerimento del nome del luogo da OpenStreetMap quando tocchi "Usa posizione".

## Installazione sul telefono

Apri l'indirizzo dell'app pubblicata:

- **iPhone**: in Safari tocca Condividi → *Aggiungi alla schermata Home*.
- **Android**: in Chrome, menu ⋮ → *Installa app*. Tenendo premuta l'icona compare la scorciatoia "Nuova recensione".

> ⚠️ Su iPhone i dati dell'app installata sono separati da quelli di Safari, e **se elimini l'icona vengono cancellati**. Fai un backup ogni tanto (Impostazioni → Esporta backup) e salvalo su iCloud Drive o Google Drive.

## Sviluppo

Requisiti: Node.js 20+.

```bash
npm install
npm run dev        # server di sviluppo
npm run build      # genera icone + build di produzione in dist/
npm run preview    # prova la build (anche offline/PWA) su http://localhost:4173
```

Per provarla sul telefono durante lo sviluppo servono HTTPS (GPS e service worker): usa la versione pubblicata, oppure un tunnel come `cloudflared tunnel --url http://localhost:4173`.

## Pubblicazione

Ogni push su `main` avvia la GitHub Action `.github/workflows/deploy.yml`, che compila l'app e la pubblica sul branch `gh-pages`. La prima volta, su GitHub vai in **Settings → Pages → Build and deployment**, scegli *Deploy from a branch* → `gh-pages` / `(root)` e salva. L'app sarà su `https://<utente>.github.io/sorso/`.

## Tecnologie

Vite · React · TypeScript · Tailwind CSS · Dexie (IndexedDB) · MiniSearch · JSZip · vite-plugin-pwa (Workbox).

```
src/
├─ db/        schema.ts (modello dati Dexie), repo.ts (salvataggio, eliminazione)
├─ lib/       filtri, ricerca, backup, foto, geolocalizzazione, impostazioni, formati
├─ components/ voto a stelle, prezzo, luogo, filtri, schede, UI di base
└─ pages/     Archivio, Nuova/Modifica, Dettaglio, Impostazioni
assets/       SVG delle icone (le PNG in public/ si generano con `npm run icons`)
docs/         specifica funzionale
```

Il voto è salvato come intero `rating2x` (2–20) per evitare problemi con i decimali nei filtri.
