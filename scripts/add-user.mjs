#!/usr/bin/env node
// Aggiunge (o aggiorna) un utente in public/users.json.
// Uso: npm run add-user
import { readFile, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const FILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'users.json');
const ITER = 250000;
const { subtle } = globalThis.crypto;
const b64 = (buf) => Buffer.from(buf).toString('base64');

async function createEntry({ username, password, role, token }) {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const base = await subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
  const payload = new TextEncoder().encode(JSON.stringify({ username, role, token: token || null }));
  const data = await subtle.encrypt({ name: 'AES-GCM', iv }, key, payload);
  return { username, role, iter: ITER, salt: b64(salt), iv: b64(iv), data: b64(data) };
}

function ask(rl, q, { hidden = false } = {}) {
  return new Promise((resolve) => {
    if (!hidden) return rl.question(q, (a) => resolve(a.trim()));
    const out = process.stdout;
    const write = rl._writeToOutput;
    rl._writeToOutput = (s) => {
      if (s.includes(q)) out.write(s);
      else out.write('*'.repeat(s.length > 2 ? 0 : s.length));
    };
    rl.question(q, (a) => {
      rl._writeToOutput = write;
      out.write('\n');
      resolve(a);
    });
  });
}

const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });

let db = { users: [] };
try {
  db = JSON.parse(await readFile(FILE, 'utf8'));
} catch {}

console.log('\n  Nuovo utente per la mappa\n');
const username = await ask(rl, '  Username: ');
if (!username) {
  console.log('  Username vuoto, annullato.');
  process.exit(1);
}
const password = await ask(rl, '  Password (min 10 caratteri): ', { hidden: true });
if (password.length < 10) {
  console.log('  Password troppo corta, annullato.');
  process.exit(1);
}
const password2 = await ask(rl, '  Ripeti password: ', { hidden: true });
if (password !== password2) {
  console.log('  Le password non coincidono, annullato.');
  process.exit(1);
}
const roleAns = (await ask(rl, '  Ruolo [admin/editor/viewer] (invio = admin): ')).toLowerCase();
const role = ['editor', 'viewer'].includes(roleAns) ? roleAns : 'admin';
const token = role !== 'viewer' ? await ask(rl, '  Token GitHub (invio = nessuno, salvataggio solo locale): ') : '';
rl.close();

const entry = await createEntry({ username, password, role, token });
db.users = [...(db.users || []).filter((u) => u.username.toLowerCase() !== username.toLowerCase()), entry];
await writeFile(FILE, JSON.stringify(db, null, 2) + '\n');

console.log(`\n  ✓ Utente "${username}" (${role}) salvato in public/users.json`);
console.log('  Ora fai commit e push per pubblicarlo.\n');
