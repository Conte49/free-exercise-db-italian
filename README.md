## Free Exercise DB Italian 💪  &nbsp; [![Test, Lint & Deploy Site to Github Pages](https://github.com/Conte49/free-exercise-db-italian/actions/workflows/ci.yaml/badge.svg)](https://github.com/Conte49/free-exercise-db-italian/actions/workflows/ci.yaml) [![License: Unlicense](https://img.shields.io/badge/license-Unlicense-blue.svg)](http://unlicense.org/)

Dataset pubblico di esercizi fisici in formato `JSON`, con 800+ esercizi e un frontend navigabile e ricercabile.

> Questo repository è un fork di [yuhonas/free-exercise-db](https://github.com/yuhonas/free-exercise-db) con la traduzione completa in italiano dei campi `name` e `instructions` di tutti gli esercizi.

### Traduzione in italiano

I campi `name` e `instructions` di tutti gli 873 file JSON nella cartella `exercises/` sono stati tradotti in italiano tramite lo script `translate.js`, che utilizza l'API OpenAI con il modello `gpt-4o-mini`.

Gli altri campi (`id`, `force`, `level`, `mechanic`, `equipment`, `primaryMuscles`, `secondaryMuscles`, `category`, `images`) sono rimasti invariati in inglese per mantenere la compatibilità con i sistemi esistenti.

#### Come funziona lo script di traduzione

Lo script `translate.js` non richiede dipendenze esterne (usa solo moduli Node.js nativi) e:

- Legge tutti i file `.json` dalla cartella `exercises/`
- Traduce `name` e `instructions` tramite l'API OpenAI (`gpt-4o-mini`)
- Salva il progresso in `.translate_progress.json` dopo ogni batch
- Riprende automaticamente da dove si è fermato in caso di interruzione
- Gestisce il rate limiting con retry esponenziale automatico
- Processa 5 file in parallelo per ottimizzare i tempi

Per eseguirlo:

```sh
node translate.js
```

---

### Perché questo progetto?

Ho iniziato a costruire un'app fitness e cercavo una lista di esercizi libera e open source con immagini. Ho trovato [exercises.json](https://github.com/wrkout/exercises.json) che era ottimo, ma i dati non erano strutturati come volevo e mancava un frontend navigabile/ricercabile. Ho quindi ristrutturato i dati e costruito un semplice frontend, ispirato da [questa issue](https://github.com/wrkout/exercises.json/issues/5).

### Come sono strutturati i dati?

Ogni esercizio è salvato come documento `JSON` separato e rispetta il [JSON Schema](./schema.json) definito nel progetto. Esempio:

```json
{
  "id": "Alternate_Incline_Dumbbell_Curl",
  "name": "Curl con Manubri su Panca Inclinata Alternato",
  "force": "pull",
  "level": "beginner",
  "mechanic": "isolation",
  "equipment": "dumbbell",
  "primaryMuscles": [
    "biceps"
  ],
  "secondaryMuscles": [
    "forearms"
  ],
  "instructions": [
    "Siediti su una panca inclinata con un manubrio in ciascuna mano tenuto a braccia distese. Suggerimento: mantieni i gomiti vicini al busto. Questa sarà la tua posizione di partenza."
  ],
  "category": "strength",
  "images": [
    "Alternate_Incline_Dumbbell_Curl/0.jpg",
    "Alternate_Incline_Dumbbell_Curl/1.jpg"
  ]
}
```
Vedi [Alternate_Incline_Dumbbell_Curl.json](./exercises/Alternate_Incline_Dumbbell_Curl.json)

Per esplorare i dati puoi usare [lite.datasette.io](https://lite.datasette.io/?json=https://github.com/Conte49/free-exercise-db-italian/blob/main/dist/exercises.json#/data/exercises?_facet_array=primaryMuscles&_facet=force&_facet=level&_facet=equipment)

### Come si usano?

Puoi clonare il repo e usare i file `JSON` e le immagini in locale.

#### In alternativa

Puoi sfruttare l'hosting di GitHub e accedere al file singolo o combinato [exercises.json](https://raw.githubusercontent.com/Conte49/free-exercise-db-italian/main/dist/exercises.json) e aggiungere il prefisso `https://raw.githubusercontent.com/Conte49/free-exercise-db-italian/main/dist/exercises/` ai percorsi delle immagini contenuti nel `JSON` per ottenere una versione hosted, es. [Air_Bike/0.jpg](https://raw.githubusercontent.com/Conte49/free-exercise-db-italian/main/exercises/Air_Bike/0.jpg), oppure usare qualcosa come [imagekit.io](https://imagekit.io/) per il ridimensionamento dinamico delle immagini, come viene fatto nel [sito frontend](https://github.com/Conte49/free-exercise-db-italian/blob/main/site/src/components/PhotoGallery.vue#L44-L54).

### Task di build

Ci sono diversi task utili nel [Makefile](./Makefile).

#### Linting
Per validare tutti i file `JSON` contro lo [schema.json](./schema.json):

```
make lint
```

#### Combinare in un singolo file JSON
Se apporti modifiche agli esercizi o ne aggiungi di nuovi, per ricombinare tutti i singoli file `JSON` in un unico file contenente un array di oggetti:

```sh
make dist/exercises.json
```
_Nota: richiede [jq](https://stedolan.github.io/jq/)_

#### Importare in PostgreSQL
Per combinare tutti i file `JSON` in [Newline Delimited JSON](http://ndjson.org/) adatto all'importazione in PostgreSQL:

```sh
make dist/exercises.nd.json
```
_Nota: richiede [jq](https://stedolan.github.io/jq/)_

Vedi anche [Importing JSON into PostgreSQL using COPY](https://konbert.com/blog/import-json-into-postgres-using-copy)

### Frontend navigabile

<img src="./site/public/screenshot.png" alt="Screenshot del frontend navigabile" width="500">

C'è un semplice frontend ricercabile/navigabile scritto in [Vue.js](https://vuejs.org/) disponibile su [Conte49.github.io/free-exercise-db-italian](https://Conte49.github.io/free-exercise-db-italian/). Tutto il codice relativo è nella cartella [site](./site).

#### Setup

```sh
npm install
```

#### Compilazione e Hot-Reload per lo sviluppo

```sh
npm run dev
```

#### Compilazione e minificazione per la produzione

```sh
npm run build
```

#### Eseguire i test unitari con [Vitest](https://vitest.dev/)

```sh
npm run test:unit
```

#### Eseguire i test end-to-end con [Cypress](https://www.cypress.io/)

```sh
npm run test:e2e:dev
```

Questo esegue i test e2e contro il server di sviluppo Vite, molto più veloce della build di produzione.

È comunque consigliato testare la build di produzione con `test:e2e` prima del deploy (es. in ambienti CI):

```sh
npm run build
npm run test:e2e
```

#### Lint con [ESLint](https://eslint.org/)

```sh
npm run lint
```

### Guida alla traduzione

Questo database può essere tradotto usando lo script `translate.js` (Node.js, nessuna dipendenza esterna) oppure lo script Python `llm_translator.py`.

#### Traduzione con Node.js e OpenAI (consigliato)

Lo script `translate.js` usa l'API OpenAI con il modello `gpt-4o-mini` per tradurre `name` e `instructions` di tutti gli esercizi. Gestisce il rate limiting, salva il progresso e riprende automaticamente in caso di interruzione.

```sh
node translate.js
```

#### Traduzione con Ollama (locale, Python)

In alternativa puoi usare `llm_translator.py` con un modello locale tramite [ollama](https://ollama.com/). Il modello `aya 35b` offre buone traduzioni. Configura la lingua desiderata nella sezione di configurazione dello script.

```sh
python3 llm_translator.py
```

### Builder WEBP e GIF

Adatta la sezione di configurazione dello script `animated_img_builder.py` con i tempi desiderati. Lo script combina le immagini jpg in un'unica immagine animata.

```sh
python3 animated_img_builder.py
```

### Generatore di INSERT SQL per l'app wger

#### Wger Exercise Database Builder
Lo script `wger_insert_builder.py` è stato creato per generare inserimenti SQL per il progetto Wger, un sistema completo di gestione degli esercizi.

#### Configurazione
Prima di eseguire lo script, aggiorna la configurazione in cima al file per adattarla al tuo caso d'uso.

#### Supporto multilingua
Se prevedi di inserire esercizi in più lingue, nota che lo script attuale mantiene il nome principale in inglese e cambia solo le istruzioni. Puoi però adattare facilmente `llm_translator.py` e `wger_insert_builder.py` per tradurre sia i nomi che le istruzioni.

#### Preparazione del database
Per usare questo script dovrai fornire gli ID massimi attuali per le tabelle rilevanti. Esegui una query `SELECT MAX(id) from my_table` su ciascuna tabella. Nota che la PK della tabella history è `history_key`.

Prima di eseguire lo script puoi pulire il database eseguendo `clear_exercises.sql` per rimuovere i dati esistenti e garantire uno stato pulito per l'importazione.

### Aiuto speciale per i dev Java
Scherzo, sono uno di loro :)

```sh
python3 wger_insert_builder.py
```

#### Gestione delle immagini
Durante l'esecuzione dello script, le immagini WebP dinamiche vengono salvate nella directory `/media/exercise_images/`. Assicurati di spostare l'intera cartella nella posizione usata dalla tua applicazione. Se usi il Docker Compose di Wger, si tratta del volume referenziato come `media`.

#### Ringraziamenti
Un enorme grazie al progetto Wger e al progetto Free Exercise DB, insieme ai loro straordinari contributori, per aver creato strumenti così potenti per la gestione degli esercizi e per aver fornito un database completo!
&hearts;
&hearts;
&hearts;

Spero che i miei script di utilità possano essere utili anche ad altri! :)

### TODO

#### Campi incompleti

I seguenti campi sono incompleti in _alcuni_ file `JSON` e per questo è stato necessario consentire `null` in [schema.json](./schema.json):

* force
* mechanic
* equipment

#### Immagini

C'è anche un piccolo numero di immagini duplicate, es.:

```sh
jdupes --summarize --recurse .

Scanning: 2620 files, 874 items (in 1 specified)
25 duplicate files (in 22 sets), occupying 809 KB
```

### Contributori

<a href="https://github.com/Conte49/free-exercise-db-italian/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=Conte49/free-exercise-db-italian" />
</a>

Made with [contrib.rocks](https://contrib.rocks).

I contributi sono sempre benvenuti! Leggi prima le linee guida per i contributi.

### Ringraziamenti speciali 🙇
* [Ollie Jennings](https://github.com/OllieJennings) per il dataset originale su [exercises.json](https://github.com/wrkout/exercises.json)
* flaticon per la favicon: [Sports-and-competition icons created by Dragon Icons - Flaticon](https://www.flaticon.com/free-icons/sports-and-competition)
