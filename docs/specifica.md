# Sorso — app personale per recensire vini e spritz

> Nome provvisorio. Documento di specifica per sviluppare una PWA personale: si fa la foto al vino o allo spritz, si recensisce e si archivia, poi si ritrova con ricerca e filtri.

---

## 1. Scelte di base (decise)

| Tema | Scelta | Motivo |
|---|---|---|
| Piattaforma | **PWA** (web app installabile) | Un solo codice per iPhone e Android, nessuno store, si installa dal browser |
| Archivio | **Solo sul telefono** (IndexedDB) + **backup manuale** | Offline, privato, gratuito |
| Riconoscimento etichetta | **No**, inserimento manuale | Semplice, zero costi, nessun dato inviato fuori |
| Categorie v1 | **Vino** e **Spritz** (con sottocategorie) | Lista configurabile: altre categorie si aggiungono senza cambiare il modello dati |
| Extra | "Lo riprenderei" + tag, dettagli vino, luogo via GPS, negozio/luogo d'acquisto (opzionale) | — |

---

## 2. Funzionalità

### 2.1 Accesso rapido alla fotocamera
- Pulsante grande **"+"** sempre visibile nella home, che apre direttamente la fotocamera posteriore.
- Secondo pulsante **"Dalla galleria"** per caricare una foto già scattata.
- **Android**: scorciatoia "Nuova recensione" con pressione lunga sull'icona (`shortcuts` del manifest).
- **iPhone**: le scorciatoie del manifest non sono supportate. In alternativa l'app si apre già sulla schermata "Nuova" se l'ultima apertura risale a più di X minuti fa (impostazione attivabile).

Implementazione:
```html
<!-- Fotocamera diretta -->
<input type="file" accept="image/*" capture="environment">
<!-- Galleria (senza capture: il sistema propone galleria/fotocamera/file) -->
<input type="file" accept="image/*">
```

### 2.2 Scheda recensione
Un'unica pagina scorrevole. I campi obbligatori sono solo **categoria** e **voto**: si salva in 10 secondi e si completa dopo.

| Campo | Tipo | Note |
|---|---|---|
| Foto | immagine | Compressa e con miniatura (vedi §4.3). Opzionale ma consigliata |
| Categoria | chip: `Vino` / `Spritz` | Obbligatoria |
| Sottocategoria | chip | Vino: Rosso, Bianco, Rosé, Bollicine, Dolce/Passito · Spritz: Aperol, Campari, Select, Hugo, Bianco, Altro |
| Nome | testo | Es. "Lambrusco Grasparossa" o "Spritz Select al bar X". Suggerimenti dai nomi già inseriti |
| **Voto** | 1–10 stelle, **anche mezze** (passo 0,5) | 10 stelle: tocco sulla metà sinistra = mezza stella. Salvato come intero 2–20 |
| Prezzo | due campi o "Non so" | **Pieno** e **Scontato** (opzionale). Unità: `bottiglia` / `calice` / `drink`. Calcolo automatico della % di sconto |
| Sensazioni | testo libero multilinea | Il commento su gusto e impressioni |
| Abbinamenti consigliati | chip + testo libero | Suggerimenti rapidi (salumi, formaggi, pesce, carne rossa, pizza, dolci, aperitivo…) più quelli già usati |
| Lo riprenderei | `Sì` / `Forse` / `No` | Tre pulsanti grandi |
| Tag | chip liberi | Autocompletamento dai tag esistenti (es. "regalo", "cena con amici", "da cantina") |
| Dettagli vino | sezione espandibile, solo se categoria = Vino | Cantina, annata, vitigno/i, regione, denominazione (DOC/DOCG…), grado alcolico |
| Dove l'ho bevuto | GPS + nome locale | Pulsante "Usa posizione": salva lat/lon. Il nome del locale si scrive o arriva dal reverse geocoding (§4.5) |
| Dove l'ho comprato | opzionale | Nome negozio/enoteca/supermercato + posizione facoltativa ("usa posizione attuale" o testo) |
| Data | data | Di default oggi, modificabile |

### 2.3 Archivio, ricerca e filtri
- **Vista elenco** (miniatura, nome, voto, prezzo, data) e **vista griglia** (solo foto).
- **Ricerca testuale** istantanea, tollerante agli errori di battitura, su nome, cantina, vitigno, regione, commento, abbinamenti, tag, locale e negozio.
- **Filtri** (chip sopra l'elenco, combinabili):
  - categoria e sottocategoria
  - intervallo di voto (es. ≥ 7,5)
  - intervallo di prezzo e "solo scontati"
  - lo riprenderei (Sì / Forse / No)
  - tag
  - regione, vitigno, annata, cantina (solo vino)
  - periodo (data da–a)
  - **vicino a me** (raggio 1 / 5 / 20 km, calcolato in locale)
  - negozio d'acquisto
- **Ordinamento**: più recenti, voto, prezzo, **rapporto qualità/prezzo** (voto / prezzo pieno).
- **Filtri salvati** (fase 1.1): es. "Rossi ≥ 8 sotto 15 €".

### 2.4 Altre azioni
- Dettaglio con foto a schermo intero.
- **Modifica** ed **elimina** (con conferma).
- **"Bevuto di nuovo"**: duplica la scheda (stesso vino, nuova data, nuovo voto e foto) per vedere com'è cambiato il giudizio nel tempo. Nel dettaglio si vede lo storico dei voti per lo stesso nome/cantina.

### 2.5 Backup
- **Esporta**: file `.zip` con `data.json` e la cartella `photos/`. Si condivide con la Web Share API (su iPhone: "Salva su File", iCloud Drive, Google Drive…).
- **Importa**: unione per `id`; in caso di conflitto vince `updatedAt` più recente.
- **Esporta CSV** (senza foto) per aprirlo in Excel.
- **Promemoria backup**: banner dopo 20 nuove schede oppure 30 giorni dall'ultimo export.

---

## 3. Modello dati

```ts
type Category = 'vino' | 'spritz';            // estendibile
type PriceUnit = 'bottiglia' | 'calice' | 'drink';
type BuyAgain = 'si' | 'forse' | 'no';

interface GeoPoint {
  lat: number;
  lon: number;
  accuracyM?: number;
  label?: string;          // nome del locale/negozio o indirizzo
}

interface Entry {
  id: string;              // crypto.randomUUID()
  createdAt: number;       // epoch ms
  updatedAt: number;
  consumedOn: string;      // 'YYYY-MM-DD'

  category: Category;
  subcategory?: string;
  name?: string;

  rating2x: number;        // 2..20 → voto = rating2x / 2 (1,0 … 10,0)

  price?: {
    unknown: boolean;      // true = "Non so"
    full?: number;         // EUR
    discounted?: number;   // EUR, <= full
    unit: PriceUnit;
  };

  notes?: string;          // sensazioni
  pairings: string[];
  buyAgain?: BuyAgain;
  tags: string[];

  wine?: {
    producer?: string;
    vintage?: number;
    grapes: string[];
    region?: string;
    appellation?: string;  // DOC/DOCG/IGT…
    abv?: number;
  };

  drankAt?: GeoPoint;
  boughtAt?: GeoPoint & { shopName?: string };

  photoId?: string;        // riferimento alla tabella photos
  sourceEntryId?: string;  // se creata con "Bevuto di nuovo"
}

interface Photo {
  id: string;
  full: Blob;              // max 1600px lato lungo, JPEG/WebP qualità ~0.8
  thumb: Blob;             // ~300px per elenchi e griglie
}
```

Indici IndexedDB (Dexie):
```ts
db.version(1).stores({
  entries: 'id, updatedAt, consumedOn, category, subcategory, rating2x, buyAgain, *tags, *pairings, wine.producer, wine.region, wine.vintage, *wine.grapes',
  photos: 'id',
  settings: 'key'
});
```

Note:
- Il voto è salvato come **intero doppio** (`rating2x`) per evitare problemi con i decimali nei filtri e negli ordinamenti.
- Foto e dati in tabelle separate: elenco e ricerca restano veloci anche con centinaia di schede.

---

## 4. Architettura tecnica

### 4.1 Stack
| Ruolo | Libreria |
|---|---|
| Build | **Vite** + **TypeScript** |
| UI | **React** (o Preact per un bundle più leggero) |
| Stile | **Tailwind CSS** |
| Database locale | **Dexie.js** + `dexie-react-hooks` (query reattive) |
| Ricerca full-text | **MiniSearch** (fuzzy, prefissi, in memoria, indicizzato all'avvio) |
| PWA / offline | **vite-plugin-pwa** (Workbox, precache della shell) |
| Compressione foto | Canvas/`createImageBitmap`, oppure `browser-image-compression` |
| Backup zip | **JSZip** |
| Routing | `react-router` (poche rotte) |

### 4.2 Schermate e rotte
```
/            Archivio (ricerca + filtri + elenco/griglia) + pulsante "+"
/new         Nuova scheda (apre la fotocamera all'ingresso)
/e/:id       Dettaglio
/e/:id/edit  Modifica
/settings    Backup/import, categorie e sottocategorie, abbinamenti predefiniti, preferenze
```

### 4.3 Foto
1. Lettura del file da `<input>`.
2. Correzione dell'orientamento EXIF (`createImageBitmap(file, { imageOrientation: 'from-image' })`).
3. Ridimensionamento a 1600px (full) e 300px (thumb), poi `canvas.toBlob('image/jpeg', 0.8)`.
4. Salvataggio dei Blob in IndexedDB. **Non** salvare in base64: occupa il 33% in più.
5. Visualizzazione con `URL.createObjectURL()`, ricordando di revocare l'URL.

### 4.4 Persistenza e limiti (importante su iPhone)
- All'avvio chiamare `navigator.storage.persist()` per chiedere che i dati non vengano cancellati automaticamente.
- Mostrare lo spazio usato con `navigator.storage.estimate()` nelle impostazioni.
- **iPhone**: installare l'app con Safari → Condividi → "Aggiungi alla schermata Home". I dati della PWA installata sono separati da quelli di Safari, e **se si elimina l'icona dalla Home si perdono**: il backup è indispensabile.
- Le foto compresse pesano circa 200–400 KB l'una: 1.000 schede ≈ 300 MB, gestibile.

### 4.5 Geolocalizzazione
- `navigator.geolocation.getCurrentPosition` richiede **HTTPS** e il permesso dell'utente. La posizione si chiede solo quando si tocca "Usa posizione", mai in automatico all'avvio.
- Si salvano lat/lon/accuratezza; il nome del locale si scrive a mano.
- **Reverse geocoding (opzionale)**: se online, suggerimento del nome/indirizzo tramite Nominatim (OpenStreetMap), rispettando la sua policy (max 1 richiesta/s, identificazione dell'app). È l'unica chiamata verso l'esterno, disattivabile nelle impostazioni.
- Il filtro "vicino a me" calcola la distanza con la formula dell'emisenoverso (haversine), tutto in locale.
- Nel dettaglio, link "Apri in Mappe" (`https://maps.google.com/?q=lat,lon` o `maps://` su iOS).

### 4.6 Ricerca
- All'avvio si costruisce un indice MiniSearch sui campi testuali (nome, cantina, vitigni, regione, note, abbinamenti, tag, locale, negozio), aggiornato a ogni salvataggio.
- Opzioni: `fuzzy: 0.2`, `prefix: true`, `combineWith: 'AND'`. Normalizzare accenti e maiuscole (`"rosé"` = `"rose"`).
- I filtri strutturati si applicano su Dexie/array in memoria, poi si interseca il risultato con la ricerca testuale.

### 4.7 Manifest PWA (estratto)
```json
{
  "name": "Sorso — recensioni vini e spritz",
  "short_name": "Sorso",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#1b1215",
  "theme_color": "#7a1f2b",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "shortcuts": [
    { "name": "Nuova recensione", "url": "/new", "icons": [{ "src": "/icon-new.png", "sizes": "96x96" }] }
  ]
}
```
Su iPhone servono anche `<link rel="apple-touch-icon">` e `<meta name="apple-mobile-web-app-capable" content="yes">` in `index.html`.

### 4.8 Hosting
Basta un hosting statico gratuito con HTTPS: **GitHub Pages**, **Cloudflare Pages** o **Netlify**. Il server distribuisce solo il codice; **i dati non passano mai dal server** e restano sul telefono.

---

## 5. Struttura del progetto
```
sorso/
├─ index.html
├─ vite.config.ts           # vite-plugin-pwa configurato qui
├─ public/                  # icone, manifest assets
└─ src/
   ├─ main.tsx
   ├─ App.tsx               # router
   ├─ db/
   │  ├─ schema.ts          # Dexie + tipi
   │  └─ repo.ts            # CRUD entries/photos
   ├─ lib/
   │  ├─ image.ts           # compressione + miniature
   │  ├─ geo.ts             # posizione, haversine, reverse geocoding
   │  ├─ search.ts          # indice MiniSearch
   │  ├─ backup.ts          # export/import zip, CSV
   │  └─ format.ts          # prezzi, voti, date (it-IT)
   ├─ components/
   │  ├─ RatingStars.tsx    # 10 stelle con mezze
   │  ├─ PriceInput.tsx     # pieno/scontato/non so + unità
   │  ├─ ChipSelect.tsx     # categorie, sottocategorie, tag, abbinamenti
   │  ├─ PhotoPicker.tsx    # fotocamera / galleria
   │  ├─ PlaceField.tsx     # GPS + nome
   │  ├─ FilterBar.tsx
   │  └─ EntryCard.tsx
   └─ pages/
      ├─ Archive.tsx
      ├─ EntryForm.tsx      # usata sia per /new sia per /edit
      ├─ EntryDetail.tsx
      └─ Settings.tsx
```

---

## 6. Dettagli UI
- **Mobile-first**, con pollice in basso: pulsante "+" e "Salva" nella parte bassa dello schermo.
- **RatingStars**: 10 stelle su una riga (o 2×5 su schermi stretti), con il numero accanto ("7,5"). Si può trascinare il dito per scorrere il voto. Accessibile con `role="slider"`, `aria-valuemin=1`, `aria-valuemax=10`, `aria-valuenow`.
- **Prezzo**: interruttore "Non so"; se disattivato, compaiono Pieno e Scontato con tastiera numerica (`inputmode="decimal"`), accettando la virgola come separatore decimale.
- Formati italiani: `Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })`, date `dd/mm/yyyy`.
- Tema scuro di default (colori vino), con chiaro/scuro automatico da sistema.
- **Bozza automatica**: se l'app si chiude mentre si compila, la scheda in corso viene recuperata.

---

## 7. Roadmap

**v1 — MVP**
- [ ] Setup Vite + React + TS + Tailwind + vite-plugin-pwa
- [ ] Database Dexie (entries, photos, settings)
- [ ] Foto da fotocamera/galleria con compressione e miniatura
- [ ] Form completo (§2.2) con validazioni (scontato ≤ pieno, voto 1–10)
- [ ] Archivio con elenco/griglia, ricerca full-text, filtri principali, ordinamenti
- [ ] Dettaglio, modifica, eliminazione, "Bevuto di nuovo"
- [ ] GPS per locale e negozio, filtro "vicino a me"
- [ ] Export/import zip, export CSV, promemoria backup
- [ ] Installabilità su iPhone e Android, funzionamento offline

**v1.1**
- [ ] Filtri salvati
- [ ] Reverse geocoding opzionale
- [ ] Statistiche (voto medio per sottocategoria, spesa, regioni più bevute, top 10)
- [ ] Gestione categorie/sottocategorie/abbinamenti da Impostazioni

**Fase 2 (eventuale)**
- [ ] Altre categorie (birra, cocktail, distillati, analcolici)
- [ ] Sincronizzazione cloud opzionale (es. Supabase) o condivisione dell'archivio
- [ ] Lettura automatica dell'etichetta con AI

---

## 8. Checklist di collaudo
- [ ] Su iPhone (Safari, installata in Home) e su Android (Chrome, installata): il "+" apre la fotocamera posteriore.
- [ ] Una foto verticale viene salvata con il giusto orientamento.
- [ ] Voto 7,5 salvato e mostrato correttamente; il filtro "≥ 7,5" lo include.
- [ ] Prezzo "Non so" escluso dai filtri di prezzo e dall'ordinamento qualità/prezzo (in fondo alla lista).
- [ ] Ricerca "lambrsco" (refuso) trova "Lambrusco"; "rose" trova "Rosé".
- [ ] In modalità aereo l'app si apre, si crea una scheda e la si ritrova.
- [ ] Export → disinstallazione → reinstallazione → import: tutte le schede e le foto tornano.
- [ ] Negata la posizione: l'app funziona e permette di scrivere il nome del locale a mano.
- [ ] 500 schede di prova: archivio e ricerca restano fluidi (< 100 ms per filtro).
