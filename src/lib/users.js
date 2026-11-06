// Utenti e codici invito.
// - public/users.json  → utenti "di base", messi a mano (npm run add-user / Gestione utenti)
// - users.json sul branch dati → utenti registrati dal sito + codici invito
import { readJsonFile, readJsonPublic, updateJsonFile } from './github.js';
import { createUserEntry, seal, unseal, generateCode, normalizeCode } from './crypto.js';

const base = import.meta.env.BASE_URL;
const FILE = 'users.json';
// Codice "pubblico" usato dalla registrazione libera: chiunque abbia il sito può aprire quell'invito.
const OPEN_CODE = 'REGISTRAZIONE-LIBERA-HOGWARTS';
const same = (a, b) => a.toLowerCase() === b.toLowerCase();
const empty = () => ({ users: [], invites: [] });

export async function fetchBundledUsers() {
  try {
    const r = await fetch(`${base}users.json?t=${Date.now()}`, { cache: 'no-store' });
    return (await r.json()).users || [];
  } catch {
    return [];
  }
}

/** Utenti e inviti dal branch dati (con token se c'è, altrimenti lettura pubblica). */
export async function fetchRepoUsers(repo, token = null) {
  if (!repo) return empty();
  let d = null;
  try {
    d = await readJsonFile(repo, token, FILE);
  } catch {
    try {
      d = await readJsonPublic(repo, FILE);
    } catch {
      d = null;
    }
  }
  return { users: d?.users || [], invites: d?.invites || [] };
}

/** Tutti gli utenti: quelli del sito hanno la precedenza su quelli di base con lo stesso nome. */
// Account creati senza token: restano salvati su questo dispositivo.
const LOCAL_KEY = 'hlmap:localUsers';
function readLocalUsers() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY)) || [];
  } catch {
    return [];
  }
}
function saveLocalUsers(list) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
  } catch {
    throw new Error('Il browser non permette di salvare l’account (navigazione privata?)');
  }
}

export async function loadAllUsers(repo) {
  const [bundled, fromRepo] = await Promise.all([fetchBundledUsers(), fetchRepoUsers(repo)]);
  const map = new Map();
  for (const u of readLocalUsers()) map.set(u.username.toLowerCase(), { ...u, source: 'locale' });
  for (const u of bundled) map.set(u.username.toLowerCase(), { ...u, source: 'file' });
  for (const u of fromRepo.users) map.set(u.username.toLowerCase(), { ...u, source: 'sito' });
  return { users: [...map.values()], invites: fromRepo.invites };
}

export function validateUsername(name) {
  if (!/^[a-zA-Z0-9_.-]{3,24}$/.test(name)) return 'Username: 3-24 caratteri, solo lettere, numeri, punto, trattino e _';
  return null;
}

/** Registrazione con codice invito: crea l'utente e lo salva sul repo. */
export async function registerUser(repo, { username, password, code }) {
  const { users, invites } = await loadAllUsers(repo);
  if (users.some((u) => same(u.username, username))) throw new Error('Username già in uso');

  const open = !String(code || '').trim();
  // Nessun codice e registrazione online non attiva → account su questo dispositivo, senza token
  if (open && !invites.some((i) => i.open)) {
    const entry = {
      ...(await createUserEntry({ username, password, role: 'editor', token: null })),
      createdAt: new Date().toISOString(),
    };
    saveLocalUsers([...readLocalUsers().filter((u) => !same(u.username, username)), entry]);
    return { username, role: 'editor', token: null };
  }
  if (!repo) throw new Error('I codici funzionano solo sul sito online');

  const secret = normalizeCode(open ? OPEN_CODE : code);
  const candidates = invites.filter((i) => !!i.open === open);
  let invite = null;
  let payload = null;
  for (const inv of candidates) {
    const p = await unseal(inv, secret);
    if (p?.token) {
      invite = inv;
      payload = p;
      break;
    }
  }
  if (!invite) throw new Error('Codice di registrazione non valido');
  if (invite.expires && Date.parse(invite.expires) < Date.now()) throw new Error('Codice scaduto');
  if (invite.maxUses && (invite.uses || 0) >= invite.maxUses) throw new Error('Codice già usato il numero massimo di volte');

  const role = payload.role === 'viewer' ? 'viewer' : 'editor';
  const token = role === 'viewer' ? null : payload.token;
  const entry = {
    ...(await createUserEntry({ username, password, role, token })),
    createdAt: new Date().toISOString(),
    invite: invite.id,
  };

  await updateJsonFile(
    repo,
    payload.token,
    FILE,
    (d) => {
      d = d || empty();
      d.users = d.users || [];
      if (d.users.some((u) => same(u.username, username))) throw new Error('Username già in uso');
      d.users.push(entry);
      d.invites = (d.invites || []).map((i) => (i.id === invite.id ? { ...i, uses: (i.uses || 0) + 1 } : i));
      return d;
    },
    `nuovo utente: ${username}`
  );
  return { username, role, token };
}

/** Crea un codice invito (solo admin con token). Ritorna il codice in chiaro: va mostrato una volta sola. */
export async function createInvite(repo, session, { role = 'editor', maxUses = 0, days = 0, label = '' }) {
  const code = generateCode();
  const invite = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    role,
    label,
    maxUses: maxUses || 0,
    expires: days ? new Date(Date.now() + days * 86400000).toISOString() : null,
    uses: 0,
    createdBy: session.username,
    createdAt: new Date().toISOString(),
    ...(await seal(normalizeCode(code), { role, token: session.token })),
  };
  await updateJsonFile(
    repo,
    session.token,
    FILE,
    (d) => {
      d = d || empty();
      d.invites = [...(d.invites || []), invite];
      return d;
    },
    `nuovo codice invito (${role})`
  );
  return code;
}

export const isOpenRegistration = (invites) => invites.some((i) => i.open);

/** Attiva la registrazione libera (sostituisce quella esistente). */
export async function enableOpenRegistration(repo, session, role = 'editor') {
  const invite = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    open: true,
    role,
    label: 'Registrazione libera',
    maxUses: 0,
    expires: null,
    uses: 0,
    createdBy: session.username,
    createdAt: new Date().toISOString(),
    ...(await seal(normalizeCode(OPEN_CODE), { role, token: session.token })),
  };
  return updateJsonFile(
    repo,
    session.token,
    FILE,
    (d) => {
      d = d || empty();
      d.invites = [...(d.invites || []).filter((i) => !i.open), invite];
      return d;
    },
    `registrazione libera attivata (${role})`
  );
}

export async function disableOpenRegistration(repo, session) {
  return updateJsonFile(
    repo,
    session.token,
    FILE,
    (d) => ({ ...(d || empty()), invites: (d?.invites || []).filter((i) => !i.open) }),
    'registrazione libera disattivata'
  );
}

export async function deleteInvite(repo, session, id) {
  return updateJsonFile(
    repo,
    session.token,
    FILE,
    (d) => ({ ...(d || empty()), invites: (d?.invites || []).filter((i) => i.id !== id) }),
    'codice invito eliminato'
  );
}

export async function deleteRepoUser(repo, session, username) {
  return updateJsonFile(
    repo,
    session.token,
    FILE,
    (d) => ({ ...(d || empty()), users: (d?.users || []).filter((u) => !same(u.username, username)) }),
    `utente eliminato: ${username}`
  );
}
