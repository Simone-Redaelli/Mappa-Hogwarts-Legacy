# Mappa Hogwarts Legacy

Mappa interattiva in React (Vite + Leaflet) con login, icone per categoria, confini delle regioni, note, ricerca, "completato" e salvataggio **senza database**: tutto finisce nel tuo repository GitHub (branch `data`).

## Come funziona il salvataggio

- I marker sono salvati in `markers.json` sul branch **`data`** del repo, tramite le API di GitHub. Branch separato = ogni salvataggio **non** rifà il deploy del sito.
- Il branch `data` viene creato in automatico al primo salvataggio.
- Ogni utente in `public/users.json` contiene un pacchetto cifrato (AES-GCM + PBKDF2) con ruolo e token GitHub: senza la password giusta non si apre.
- Più persone possono modificare insieme: se due salvano nello stesso momento, le modifiche vengono unite.
- Ogni 30 secondi la mappa si aggiorna con i marker degli altri.
- Senza token (es. l'utente di default) il salvataggio è **locale** nel browser. C'è sempre anche Esporta/Importa JSON come backup.

## 1. Avvio in locale

```bash
cd $HOME/Downloads/hogwarts-map
npm install
npm run dev
```

Apri http://localhost:5173 — login di default: **admin / hogwarts123** (solo salvataggio locale, da sostituire).

## 2. La mappa

La carichi **dal sito**: al primo accesso compare il pulsante "Carica mappa" (poi la cambi dall'icona mappa in basso nel pannello).
- Usa l'immagine **pulita, senza icone** vista dall'alto. JPG/PNG/WEBP, consigliato 4000–8000 px di lato: più è grande, più dettaglio quando zoomi.
- Oltre 12000 px o 45 MB viene ridotta automaticamente a 8192 px.
- Online va su GitHub (branch `data`, file `map-*.jpg` + `map.json`) e la vedono tutti; in modalità locale resta nel browser.
- Lo zoom si adatta alla risoluzione: il pulsante **1:1** porta al dettaglio massimo, puoi ingrandire fino a 4x oltre.
- Marker e regioni usano coordinate relative (0–1000): se cambi immagine restano al loro posto, purché sia la stessa mappa con le stesse proporzioni.

## 3. Pubblica su GitHub

1. Crea un repository **pubblico** su github.com (es. `hogwarts-map`), senza README.
2. Nella cartella del progetto:

```bash
git init
git add .
git commit -m "Mappa Hogwarts Legacy"
git branch -M main
git remote add origin https://github.com/TUO-UTENTE/hogwarts-map.git
git push -u origin main
```

3. Sul repo: **Settings → Pages → Source: GitHub Actions**.
4. Dopo 1–2 minuti il sito è online su `https://TUO-UTENTE.github.io/hogwarts-map/` (owner e repo vengono rilevati da soli dall'indirizzo).

## 4. Crea il token e gli utenti

1. GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**
   - Repository access: **Only select repositories** → solo questo repo
   - Permissions → Repository → **Contents: Read and write**
2. Crea il tuo utente:

```bash
npm run add-user
```

Inserisci username, password (min 10 caratteri), ruolo `editor` e incolla il token. In alternativa usa la pagina **Gestione utenti** dal login (`#/setup`).

3. Togli l'utente di default e pubblica:

```bash
npm run remove-user -- admin
git add public/users.json
git commit -m "Utenti"
git push
```

Ruoli: **editor** aggiunge/modifica/elimina, **viewer** vede solo (non serve token).

## Uso

- **+ Marker**: scegli la categoria nella barra in alto e clicca sulla mappa (si apre la finestra per titolo e note). **Tasto destro** = marker al volo.
- **Rapido (senza note)**: spunta l'opzione e ogni clic piazza subito un'icona. Ideale per riempire la mappa di collezionabili. "Annulla ultimo" toglie l'ultima piazzata.
- **⬡ Regione**: clicca i punti del confine, chiudi con doppio clic, clic sul primo punto o "Chiudi regione". Scegli nome e colore: il nome appare al centro. Clic su una regione per modificarla o eliminarla.
- Clic su un marker: note, modifica, elimina, segna completato. I marker si **trascinano**.
- Scheda **Categorie**: mostra/nascondi categorie e regioni. Scheda **Elenco**: tutti i marker, clic per andarci.
- Le icone si rimpiccioliscono quando allontani lo zoom.
- Categorie, colori e icone si modificano in `src/lib/categories.js` (simboli in `src/lib/icons.js`).
- Backup: ⤓ esporta tutto (marker + regioni) in JSON, ⤒ importa.

## Sicurezza (da sapere)

- Il repo deve essere pubblico per GitHub Pages gratuito, quindi `markers.json` è leggibile da chi sa dove guardare. Il login protegge **l'accesso al sito e le modifiche**, non la segretezza dei dati.
- Il token è cifrato con la password: usa password lunghe. Il token deve avere accesso **solo** a questo repo.
- Se perdi il controllo di una password: revoca il token su GitHub, creane uno nuovo e rigenera gli utenti.
