#!/usr/bin/env node
/**
 * Script per generare exercises-it.json con traduzioni italiane e riferimento WebP.
 * Da lanciare nella root del repo free-exercise-db-italian.
 * 
 * Uso: node build-exercises-it.js
 * Output: dist/exercises-it.json
 */

const fs = require('fs');
const path = require('path');

const exercisesDir = path.join(__dirname, 'exercises');
const outputFile = path.join(__dirname, 'dist', 'exercises-it.json');

// Leggi tutte le cartelle/file nella directory exercises
const files = fs.readdirSync(exercisesDir).filter(f => f.endsWith('.json'));

console.log(`Trovati ${files.length} file JSON esercizi`);

const exercises = [];
let withNameIt = 0;
let withWebp = 0;

for (const file of files) {
  const filePath = path.join(exercisesDir, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const id = data.id || file.replace('.json', '');

  // Controlla se esiste il WebP animato
  const webpPath = path.join(exercisesDir, id, 'exercise.webp');
  const hasWebp = fs.existsSync(webpPath);

  if (data.name_it) withNameIt++;
  if (hasWebp) withWebp++;

  exercises.push({
    id: id,
    name: data.name,
    name_it: data.name_it || null,
    force: data.force,
    level: data.level,
    mechanic: data.mechanic,
    equipment: data.equipment,
    primaryMuscles: data.primaryMuscles,
    secondaryMuscles: data.secondaryMuscles,
    instructions: data.instructions,
    instructions_it: data.instructions_it || null,
    category: data.category,
    images: data.images,
    // Aggiunge il path al WebP animato se esiste
    webp: hasWebp ? `${id}/exercise.webp` : null,
  });
}

// Ordina per nome
exercises.sort((a, b) => (a.name_it || a.name).localeCompare(b.name_it || b.name, 'it'));

// Assicura che la cartella dist esista
if (!fs.existsSync(path.join(__dirname, 'dist'))) {
  fs.mkdirSync(path.join(__dirname, 'dist'));
}

fs.writeFileSync(outputFile, JSON.stringify(exercises, null, 2), 'utf-8');

console.log(`\nGenerato: ${outputFile}`);
console.log(`Totale esercizi: ${exercises.length}`);
console.log(`Con nome italiano: ${withNameIt}`);
console.log(`Con WebP animato: ${withWebp}`);
