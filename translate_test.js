#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = 'gpt-4o-mini';
const EXERCISES_DIR = path.join(__dirname, 'exercises');
const TEST_COUNT = 5;

function getOriginalEnglish(filename) {
  try {
    const raw = execSync(`git show upstream/main:exercises/${filename}`, { encoding: 'utf8' });
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

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
        try { resolve(JSON.parse(data).choices[0].message.content.trim()); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', e => retries > 0
      ? setTimeout(() => openaiRequest(messages, retries - 1).then(resolve).catch(reject), 1000)
      : reject(e));
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

async function main() {
  const files = fs.readdirSync(EXERCISES_DIR)
    .filter(f => f.endsWith('.json'))
    .sort()
    .slice(0, TEST_COUNT);

  console.log(`Test su ${TEST_COUNT} file:\n`);

  for (const filename of files) {
    const filePath = path.join(EXERCISES_DIR, filename);
    const current = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const original = getOriginalEnglish(filename);
    const englishName = original ? original.name : current.name;
    const englishInstructions = original ? original.instructions : current.instructions;

    console.log(`--- ${filename} ---`);
    console.log(`  EN name: ${englishName}`);
    console.log(`  EN instructions[0]: ${englishInstructions[0]}\n`);

    try {
      const translated = await translateExercise(englishName, englishInstructions);
      console.log(`  IT name_it: ${translated.name_it}`);
      console.log(`  IT instructions_it[0]: ${translated.instructions_it[0]}`);
      console.log(`  (${translated.instructions_it.length} istruzioni)\n`);
    } catch (err) {
      console.error(`  ERRORE: ${err.message}\n`);
    }
  }
}

main().catch(err => { console.error('Errore fatale:', err); process.exit(1); });
