// Ogni utente in users.json contiene un "pacchetto" cifrato con la sua password
// (PBKDF2-SHA256 + AES-GCM). Solo con la password giusta si decifra:
// dentro ci sono ruolo e (opzionale) il token GitHub per salvare.
// Stesso meccanismo per i codici invito: il pacchetto si apre col codice.

const enc = new TextEncoder();
const dec = new TextDecoder();

const toB64 = (buf) => {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
};
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export const DEFAULT_ITERATIONS = 250000;

async function deriveKey(secret, salt, iterations) {
  const base = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/** Cifra un oggetto con un segreto (password o codice). */
export async function seal(secret, obj) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(secret, salt, DEFAULT_ITERATIONS);
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj)));
  return { iter: DEFAULT_ITERATIONS, salt: toB64(salt), iv: toB64(iv), data: toB64(data) };
}

/** Decifra; null se il segreto è sbagliato. */
export async function unseal(entry, secret) {
  try {
    const key = await deriveKey(secret, fromB64(entry.salt), entry.iter || DEFAULT_ITERATIONS);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(entry.iv) }, key, fromB64(entry.data));
    return JSON.parse(dec.decode(plain));
  } catch {
    return null;
  }
}

export async function createUserEntry({ username, password, role = 'editor', token = '' }) {
  return { username, role, ...(await seal(password, { username, role, token: token || null })) };
}

/** Ritorna { username, role, token } se la password è giusta, altrimenti null. */
export async function unlockUser(entry, password) {
  const obj = await unseal(entry, password);
  if (!obj || obj.username?.toLowerCase() !== entry.username.toLowerCase()) return null;
  return obj;
}

// Codici invito: 16 caratteri casuali (~80 bit), senza lettere ambigue
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function generateCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
  return chars.match(/.{4}/g).join('-');
}
export const normalizeCode = (code) => String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
