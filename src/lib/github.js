// Salvataggio "senza database": i marker vivono in un file JSON dentro il
// repository GitHub, su un branch separato ("data") così ogni salvataggio
// non fa ripartire il deploy del sito.

const API = 'https://api.github.com';

export class GitHubError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function gh(token, method, url, body) {
  const res = await fetch(API + url, {
    method,
    cache: 'no-store',
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      msg = (await res.json()).message || msg;
    } catch {}
    throw new GitHubError(msg, res.status);
  }
  return res.status === 204 ? null : res.json();
}

export function utf8ToB64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

export function b64ToUtf8(b64) {
  const bin = atob(b64.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export const emptyData = () => ({ version: 1, markers: [] });

function parse(text) {
  try {
    const obj = JSON.parse(text);
    if (Array.isArray(obj)) return { version: 1, markers: obj };
    if (obj && Array.isArray(obj.markers)) return obj;
  } catch {}
  return emptyData();
}

const contentsUrl = ({ owner, repo, path }) => `/repos/${owner}/${repo}/contents/${path}`;

/** Legge il file dei marker tramite API (dati sempre freschi). */
export async function readMarkers(cfg, token) {
  try {
    const f = await gh(token, 'GET', `${contentsUrl(cfg)}?ref=${encodeURIComponent(cfg.branch)}&t=${Date.now()}`);
    let text;
    if (f.content) text = b64ToUtf8(f.content);
    else text = await (await fetch(f.download_url, { cache: 'no-store' })).text(); // file > 1MB
    return { data: parse(text), sha: f.sha };
  } catch (e) {
    if (e.status === 404) return { data: emptyData(), sha: null };
    throw e;
  }
}

/** Lettura pubblica senza token (utenti in sola lettura, repo pubblico). */
export async function readMarkersPublic(cfg) {
  const url = `https://raw.githubusercontent.com/${cfg.owner}/${cfg.repo}/${cfg.branch}/${cfg.path}?t=${Date.now()}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (res.status === 404) return { data: emptyData(), sha: null };
  if (!res.ok) throw new GitHubError(res.statusText, res.status);
  return { data: parse(await res.text()), sha: null };
}

export async function writeMarkers(cfg, token, data, sha, message) {
  const body = {
    message,
    branch: cfg.branch,
    content: utf8ToB64(JSON.stringify(data, null, 2) + '\n'),
    ...(sha ? { sha } : {}),
  };
  const res = await gh(token, 'PUT', contentsUrl(cfg), body);
  return res.content.sha;
}

/** Crea il branch dei dati partendo dal branch principale, se non esiste. */
export async function ensureBranch(cfg, token) {
  try {
    await gh(token, 'GET', `/repos/${cfg.owner}/${cfg.repo}/branches/${encodeURIComponent(cfg.branch)}`);
    return false;
  } catch (e) {
    if (e.status !== 404) throw e;
  }
  const repo = await gh(token, 'GET', `/repos/${cfg.owner}/${cfg.repo}`);
  const ref = await gh(token, 'GET', `/repos/${cfg.owner}/${cfg.repo}/git/ref/heads/${repo.default_branch}`);
  try {
    await gh(token, 'POST', `/repos/${cfg.owner}/${cfg.repo}/git/refs`, {
      ref: `refs/heads/${cfg.branch}`,
      sha: ref.object.sha,
    });
  } catch (e) {
    if (e.status !== 422) throw e; // 422 = esiste già
  }
  return true;
}

/** Ricava owner/repo dall'indirizzo se il sito gira su *.github.io */
export function resolveRepo(github = {}) {
  let { owner, repo } = github;
  const host = window.location.hostname;
  if ((!owner || !repo) && host.endsWith('.github.io')) {
    const user = host.split('.')[0];
    const first = window.location.pathname.split('/').filter(Boolean)[0];
    owner = owner || user;
    repo = repo || first || `${user}.github.io`;
  }
  if (github.dataRepo && github.dataRepo.includes('/')) {
    // dati in un repository separato: il token serve solo per quello
    [owner, repo] = github.dataRepo.split('/').map((s) => s.trim());
  }
  if (!owner || !repo) return null;
  return { owner, repo, branch: github.branch || 'data', path: github.path || 'markers.json' };
}

export function describeError(e) {
  if (e?.status === 401) return 'Token GitHub non valido o scaduto';
  if (e?.status === 403) return 'Il token non ha i permessi (serve Contents: Read and write)';
  if (e?.status === 404) return 'Repository non trovato: controlla owner/repo';
  if (e instanceof TypeError) return 'Connessione assente';
  return e?.message || 'Errore sconosciuto';
}

// ---------------- Mappa ----------------

const repoPath = (cfg) => `/repos/${cfg.owner}/${cfg.repo}`;

export const rawUrl = (cfg, path) =>
  `https://raw.githubusercontent.com/${cfg.owner}/${cfg.repo}/${cfg.branch}/${path}`;

/** Legge un JSON dal branch dati tramite API. null se non esiste. */
export async function readJsonFile(cfg, token, path) {
  try {
    const f = await gh(token, 'GET', `${repoPath(cfg)}/contents/${path}?ref=${encodeURIComponent(cfg.branch)}&t=${Date.now()}`);
    return JSON.parse(b64ToUtf8(f.content));
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
}

export async function readJsonPublic(cfg, path) {
  const res = await fetch(`${rawUrl(cfg, path)}?t=${Date.now()}`, { cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw new GitHubError(res.statusText, res.status);
  return res.json();
}

/** Scarica un file binario (fino a 100 MB) tramite API. */
export async function fetchRawFile(cfg, token, path) {
  const res = await fetch(`${API}${repoPath(cfg)}/contents/${path}?ref=${encodeURIComponent(cfg.branch)}`, {
    headers: {
      Accept: 'application/vnd.github.raw',
      'X-GitHub-Api-Version': '2022-11-28',
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) throw new GitHubError(res.statusText, res.status);
  return res.blob();
}

const blobToB64 = (blob) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

/**
 * Carica l'immagine della mappa sul branch dati con un solo commit:
 * aggiunge map-<timestamp>.<ext>, aggiorna map.json, rimuove la vecchia immagine.
 */
export async function uploadMap(cfg, token, { blob, w, h, ext }, username) {
  await ensureBranch(cfg, token);
  const file = `map-${Date.now()}.${ext}`;
  const content = await blobToB64(blob);
  const created = await gh(token, 'POST', `${repoPath(cfg)}/git/blobs`, { content, encoding: 'base64' });
  const meta = { file, w, h, updatedAt: new Date().toISOString(), updatedBy: username };

  for (let i = 0; i < 4; i++) {
    const ref = await gh(token, 'GET', `${repoPath(cfg)}/git/ref/heads/${encodeURIComponent(cfg.branch)}`);
    const head = await gh(token, 'GET', `${repoPath(cfg)}/git/commits/${ref.object.sha}`);
    const old = await readJsonFile(cfg, token, 'map.json');
    const tree = [
      { path: file, mode: '100644', type: 'blob', sha: created.sha },
      { path: 'map.json', mode: '100644', type: 'blob', content: JSON.stringify(meta, null, 2) + '\n' },
    ];
    if (old?.file && old.file !== file) tree.push({ path: old.file, mode: '100644', type: 'blob', sha: null });
    const t = await gh(token, 'POST', `${repoPath(cfg)}/git/trees`, { base_tree: head.tree.sha, tree });
    const c = await gh(token, 'POST', `${repoPath(cfg)}/git/commits`, {
      message: `mappa aggiornata da ${username}`,
      tree: t.sha,
      parents: [ref.object.sha],
    });
    try {
      await gh(token, 'PATCH', `${repoPath(cfg)}/git/refs/heads/${encodeURIComponent(cfg.branch)}`, { sha: c.sha });
      return meta;
    } catch (e) {
      if (e.status === 422) continue; // il branch è avanzato nel frattempo: riprova
      throw e;
    }
  }
  throw new GitHubError('Impossibile aggiornare la mappa, riprova', 409);
}

/**
 * Legge-modifica-scrive un JSON sul branch dati, riprovando se qualcun altro
 * l'ha cambiato nel frattempo. mutate(dati|null) => nuovi dati.
 */
export async function updateJsonFile(cfg, token, path, mutate, message) {
  for (let i = 0; i < 6; i++) {
    let data = null;
    let sha = null;
    try {
      const f = await gh(token, 'GET', `${repoPath(cfg)}/contents/${path}?ref=${encodeURIComponent(cfg.branch)}&t=${Date.now()}`);
      data = JSON.parse(b64ToUtf8(f.content));
      sha = f.sha;
    } catch (e) {
      if (e.status !== 404) throw e;
    }
    const next = mutate(data ? structuredClone(data) : null);
    try {
      await gh(token, 'PUT', `${repoPath(cfg)}/contents/${path}`, {
        message,
        branch: cfg.branch,
        content: utf8ToB64(JSON.stringify(next, null, 2) + '\n'),
        ...(sha ? { sha } : {}),
      });
      return next;
    } catch (e) {
      if (e.status === 409) continue;
      if (!sha && (e.status === 404 || e.status === 422)) {
        await ensureBranch(cfg, token);
        continue;
      }
      throw e;
    }
  }
  throw new GitHubError('Troppi tentativi, riprova', 409);
}
