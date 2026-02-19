#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = 'gpt-4o-mini';
const EXERCISES_DIR = path.join(__dirname, 'exercises');
const TEST_COUNT = 5;

function openaiRequest(messages, retries = 3) {
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
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        try {
          resolve(JSON.parse(data).choices[0].message.content.trim());
        } catch (e) { reject(e); }
      });
    });
    req.on('error', e => retries > 0
      ? setTimeout(() => openaiRequest(messages, retries - 1).then(resolve).catch(reject), 1000)
      : reject(e));
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

  const match = content.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`Risposta non valida: ${content}`);
  return JSON.parse(match[0]);
}

async function main() {
  const files = fs.readdirSync(EXERCISES_DIR)
    .filter(f => f.endsWith('.json'))
    .sort()
    .slice(0, TEST_COUNT);

  console.log(`Test su ${TEST_COUNT} file:\n`);

  for (const filename of files) {
    const filePath = path.join(EXERCISES_DIR, filename);
    const exercise = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    console.log(`--- ${filename} ---`);
    console.log(`  EN name: ${exercise.name}`);
    console.log(`  EN instructions[0]: ${exercise.instructions[0]}\n`);

    try {
      const translated = await translateExercise(exercise);
      console.log(`  IT name: ${translated.name}`);
      console.log(`  IT instructions[0]: ${translated.instructions[0]}`);
      console.log(`  (${translated.instructions.length} istruzioni tradotte)\n`);
    } catch (err) {
      console.error(`  ERRORE: ${err.message}\n`);
    }
  }
}

main().catch(err => { console.error('Errore fatale:', err); process.exit(1); });
