#!/usr/bin/env node

/**
 * Migra i file JSON dal formato con name/instructions sovrascritti in italiano
 * al formato corretto:
 *   - name / instructions → inglese originale (da upstream/main)
 *   - name_it / instructions_it → italiano (già tradotto, salvato nei file attuali)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const EXERCISES_DIR = path.join(__dirname, 'exercises');

const files = fs.readdirSync(EXERCISES_DIR).filter(f => f.endsWith('.json')).sort();
let ok = 0, skipped = 0, errors = 0;

for (const filename of files) {
  const filePath = path.join(EXERCISES_DIR, filename);
  const current = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  // Già nel formato corretto
  if (current.name_it && current.instructions_it) {
    skipped++;
    continue;
  }

  // Recupera originale inglese da upstream/main
  let original;
  try {
    const raw = execSync(`git show upstream/main:exercises/${filename}`, { encoding: 'utf8' });
    original = JSON.parse(raw);
  } catch (e) {
    console.error(`ERRORE recupero upstream per ${filename}: ${e.message}`);
    errors++;
    continue;
  }

  // Il file attuale ha name/instructions in italiano → li spostiamo in _it
  const result = {
    ...current,
    name: original.name,
    instructions: original.instructions,
    name_it: current.name,
    instructions_it: current.instructions,
  };

  // Mantieni instructions_fr se presente
  if (original.instructions_fr) result.instructions_fr = original.instructions_fr;

  fs.writeFileSync(filePath, JSON.stringify(result, null, 2));
  ok++;
}

console.log(`Migrati: ${ok} | Già ok: ${skipped} | Errori: ${errors}`);
