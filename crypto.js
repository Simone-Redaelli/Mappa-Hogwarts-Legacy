// Ogni utente in users.json contiene un "pacchetto" cifrato con la sua password
// (PBKDF2-SHA256 + AES-GCM). Solo con la password giusta si decifra:
// dentro ci sono ruolo e (opzionale) il token GitHub per salvare i marker.

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

async function deriveKey(password, salt, iterations) {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function createUserEntry({ username, password, role = 'editor', token = '' }) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, DEFAULT_ITERATIONS);
  const payload = enc.encode(JSON.stringify({ username, role, token: token || null }));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, payload);
  return {
    username,
    role,
    iter: DEFAULT_ITERATIONS,
    salt: toB64(salt),
    iv: toB64(iv),
    data: toB64(data),
  };
}

/** Ritorna { username, role, token } se la password è giusta, altrimenti null. */
export async function unlockUser(entry, password) {
  try {
    const key = await deriveKey(password, fromB64(entry.salt), entry.iter || DEFAULT_ITERATIONS);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(entry.iv) }, key, fromB64(entry.data));
    const obj = JSON.parse(dec.decode(plain));
    if (!obj || obj.username?.toLowerCase() !== entry.username.toLowerCase()) return null;
    return obj;
  } catch {
    return null;
  }
}
