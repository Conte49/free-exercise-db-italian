#!/usr/bin/env node

/**
 * Traduce i campi `name` e `instructions` di ogni file JSON in exercises/ in italiano.
 * Aggiunge `name_it` e `instructions_it` come campi separati, mantenendo gli originali in inglese.
 * - Recupera il testo inglese originale da git (upstream/main o commit iniziale)
 * - Riprende da dove si è fermato (salta i file già tradotti)
 * - Gestisce rate limiting con retry esponenziale
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = 'gpt-4o-mini';
const EXERCISES_DIR = path.join(__dirname, 'exercises');
const PROGRESS_FILE = path.join(__dirname, '.translate_progress.json');
const CONCURRENCY = 5;
const DELAY_MS = 200;

if (!OPENAI_API_KEY) {
  console.error('Errore: variabile OPENAI_API_KEY non impostata.');
  process.exit(1);
}

function loadProgress() {
  if (fs.existsSync(PROGRESS_FILE)) {
    return new Set(JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8')));
  }
  return new Set();
}

function saveProgress(done) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify([...done]));
}

// Recupera il contenuto originale inglese del file da upstream/main
function getOriginalEnglish(filename) {
  try {
    const raw = execSync(`git show upstream/main:exercises/${filename}`, { encoding: 'utf8' });
    return JSON.parse(raw);
  } catch (e) {
    // fallback: prova con il primo commit del file
    try {
      const hash = execSync(`git log --diff-filter=A --format="%H" -- exercises/${filename}`, { encoding: 'utf8' }).trim().split('\n').pop();
      const raw = execSync(`git show ${hash}:exercises/${filename}`, { encoding: 'utf8' });
      return JSON.parse(raw);
    } catch (e2) {
      return null;
    }
  }
}

function openaiRequest(messages, retries = 5) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ model: MODEL, messages, temperature: 0.3 });
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
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        try {
          resolve(JSON.parse(data).choices[0].message.content.trim());
        } catch (e) { reject(e); }
      });
    });
    req.on('error', (e) => {
      if (retries > 0) setTimeout(() => openaiRequest(messages, retries - 1).then(resolve).catch(reject), 2000);
      else reject(e);
    });
    req.write(body);
    req.end();
  });
}

async function translateExercise(name, instructions) {
  const prompt = `Traduci in italiano i seguenti campi di un esercizio fitness.
Rispondi SOLO con un oggetto JSON con i campi "name_it" (stringa) e "instructions_it" (array di stringhe).
Non aggiungere spiegazioni, solo il JSON.

name: ${JSON.stringify(name)}
instructions: ${JSON.stringify(instructions)}`;

  const content = await openaiRequest([
    { role: 'system', content: 'Sei un traduttore esperto di fitness e anatomia. Traduci in italiano in modo preciso e naturale.' },
    { role: 'user', content: prompt },
  ]);

  const match = content.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Risposta non valida: ${content}`);
  return JSON.parse(match[0]);
}

async function processFile(filePath, filename) {
  const current = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  // Se ha già name_it e instructions_it, è già nel formato corretto
  if (current.name_it && current.instructions_it) return filename;

  // Recupera l'inglese originale dall'upstream
  const original = getOriginalEnglish(filename);
  const englishName = original ? original.name : current.name;
  const englishInstructions = original ? original.instructions : current.instructions;

  const translated = await translateExercise(englishName, englishInstructions);

  // Ricostruisce il file: ripristina inglese + aggiunge campi _it
  const result = {
    ...current,
    name: englishName,
    instructions: englishInstructions,
    name_it: translated.name_it,
    instructions_it: translated.instructions_it,
  };

  // Rimuove eventuali vecchi campi _fr se presenti, li mantiene
  fs.writeFileSync(filePath, JSON.stringify(result, null, 2));
  return filename;
}

async function runBatch(tasks) {
  return Promise.all(tasks.map(({ filePath, filename }) =>
    processFile(filePath, filename).catch(err => {
      console.error(`  ERRORE su ${filename}: ${err.message}`);
      return null;
    })
  ));
}

async function main() {
  const files = fs.readdirSync(EXERCISES_DIR)
    .filter(f => f.endsWith('.json'))
    .sort();

  const done = loadProgress();
  const todo = files.filter(f => !done.has(f));

  console.log(`Totale: ${files.length} | Già processati: ${done.size} | Da fare: ${todo.length}`);

  for (let i = 0; i < todo.length; i += CONCURRENCY) {
    const batch = todo.slice(i, i + CONCURRENCY).map(filename => ({
      filename,
      filePath: path.join(EXERCISES_DIR, filename),
    }));

    const results = await runBatch(batch);
    results.forEach(f => { if (f) done.add(f); });
    saveProgress(done);

    const pct = ((done.size / files.length) * 100).toFixed(1);
    console.log(`[${pct}%] ${done.size}/${files.length} - ${batch.map(b => b.filename).join(', ')}`);

    if (i + CONCURRENCY < todo.length) await new Promise(r => setTimeout(r, DELAY_MS));
  }

  console.log(`\nCompletato.`);
  if (fs.existsSync(PROGRESS_FILE)) fs.unlinkSync(PROGRESS_FILE);
}

main().catch(err => { console.error('Errore fatale:', err); process.exit(1); });
