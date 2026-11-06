#!/usr/bin/env node
// Rimuove un utente da public/users.json.
// Uso: npm run remove-user -- nomeutente
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const FILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'users.json');
const name = (process.argv[2] || '').toLowerCase();
if (!name) {
  console.log('Uso: npm run remove-user -- nomeutente');
  process.exit(1);
}
const db = JSON.parse(await readFile(FILE, 'utf8'));
const before = db.users.length;
db.users = db.users.filter((u) => u.username.toLowerCase() !== name);
await writeFile(FILE, JSON.stringify(db, null, 2) + '\n');
console.log(before === db.users.length ? `Utente "${name}" non trovato.` : `✓ Utente "${name}" rimosso.`);
