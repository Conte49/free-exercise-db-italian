#!/usr/bin/env node

/**
 * Traduce i campi `name` e `instructions` di ogni file JSON in exercises/ in italiano.
 * - Riprende da dove si è fermato (salta i file già tradotti)
 * - Gestisce rate limiting con retry esponenziale
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = 'gpt-4o-mini';
const EXERCISES_DIR = path.join(__dirname, 'exercises');
const PROGRESS_FILE = path.join(__dirname, '.translate_progress.json');
const CONCURRENCY = 5; // richieste parallele
const DELAY_MS = 200;  // pausa tra batch

// Carica progresso precedente
function loadProgress() {
  if (fs.existsSync(PROGRESS_FILE)) {
    return new Set(JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8')));
  }
  return new Set();
}

function saveProgress(done) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify([...done]));
}

// Chiamata OpenAI via https nativo (no dipendenze)
function openaiRequest(messages, retries = 5) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.3,
    });

    const options = {
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 429 && retries > 0) {
          const wait = (6 - retries) * 2000;
          console.warn(`  Rate limit, attendo ${wait}ms...`);
          setTimeout(() => openaiRequest(messages, retries - 1).then(resolve).catch(reject), wait);
          return;
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
        try {
          const json = JSON.parse(data);
          resolve(json.choices[0].message.content.trim());
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', (e) => {
      if (retries > 0) {
        setTimeout(() => openaiRequest(messages, retries - 1).then(resolve).catch(reject), 2000);
      } else {
        reject(e);
      }
    });

    req.write(body);
    req.end();
  });
}

async function translateExercise(exercise) {
  const prompt = `Traduci in italiano i seguenti campi di un esercizio fitness.
Rispondi SOLO con un oggetto JSON con i campi "name" (stringa) e "instructions" (array di stringhe).
Non aggiungere spiegazioni, solo il JSON.

name: ${JSON.stringify(exercise.name)}
instructions: ${JSON.stringify(exercise.instructions)}`;

  const content = await openaiRequest([
    { role: 'system', content: 'Sei un traduttore esperto di fitness e anatomia. Traduci in italiano in modo preciso e naturale.' },
    { role: 'user', content: prompt },
  ]);

  // Estrai JSON dalla risposta (a volte arriva con ```json ... ```)
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Risposta non valida: ${content}`);
  return JSON.parse(match[0]);
}

async function processFile(filePath, filename) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const exercise = JSON.parse(raw);

  const translated = await translateExercise(exercise);

  exercise.name = translated.name;
  exercise.instructions = translated.instructions;

  fs.writeFileSync(filePath, JSON.stringify(exercise, null, 2));
  return filename;
}

async function runBatch(tasks) {
  return Promise.all(tasks.map(({ filePath, filename }) =>
    processFile(filePath, filename).catch(err => {
      console.error(`  ERRORE su ${filename}: ${err.message}`);
      return null; // non blocca il batch
    })
  ));
}

async function main() {
  const files = fs.readdirSync(EXERCISES_DIR)
    .filter(f => f.endsWith('.json'))
    .sort();

  const done = loadProgress();
  const todo = files.filter(f => !done.has(f));

  console.log(`Totale: ${files.length} file | Già tradotti: ${done.size} | Da tradurre: ${todo.length}`);

  let count = 0;
  for (let i = 0; i < todo.length; i += CONCURRENCY) {
    const batch = todo.slice(i, i + CONCURRENCY).map(filename => ({
      filename,
      filePath: path.join(EXERCISES_DIR, filename),
    }));

    const results = await runBatch(batch);

    results.forEach((filename) => {
      if (filename) {
        done.add(filename);
        count++;
      }
    });

    saveProgress(done);

    const pct = ((done.size / files.length) * 100).toFixed(1);
    console.log(`[${pct}%] ${done.size}/${files.length} - ultimo batch: ${batch.map(b => b.filename).join(', ')}`);

    if (i + CONCURRENCY < todo.length) {
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }

  console.log(`\nTraduzione completata. ${count} file tradotti in questa sessione.`);
  if (fs.existsSync(PROGRESS_FILE)) fs.unlinkSync(PROGRESS_FILE);
}

main().catch(err => {
  console.error('Errore fatale:', err);
  process.exit(1);
});
