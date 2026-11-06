import { useCallback, useEffect, useRef, useState } from 'react';
import {
  readMarkers,
  readMarkersPublic,
  writeMarkers,
  ensureBranch,
  describeError,
} from './github.js';

// Modalità:
//  - "github": legge e scrive markers.json sul repo (serve token)
//  - "public": sola lettura dal repo pubblico (utente viewer senza token)
//  - "local":  salva nel browser (localStorage), per test o se manca il token

const LS = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  },
};

export function applyOps(markers, ops) {
  let list = [...markers];
  for (const op of ops) {
    if (op.type === 'upsert') {
      const i = list.findIndex((m) => m.id === op.marker.id);
      if (i >= 0) list[i] = op.marker;
      else list.push(op.marker);
    } else if (op.type === 'delete') {
      list = list.filter((m) => m.id !== op.id);
    }
  }
  return list;
}

const POLL_MS = 30000;
const DEBOUNCE_MS = 900;

export function useMarkers(session, repo) {
  const mode = repo && session?.token ? 'github' : repo && session?.role === 'viewer' ? 'public' : 'local';
  const scope = repo ? `${repo.owner}/${repo.repo}` : 'local';
  const keys = {
    cache: `hlmap:cache:${scope}:${mode}`,
    pending: `hlmap:pending:${scope}`,
  };

  const [markers, setMarkers] = useState(() => LS.get(keys.cache, []));
  const [status, setStatus] = useState({ state: 'loading' });

  const remote = useRef(markers);
  const pending = useRef(mode === 'github' ? LS.get(keys.pending, []) : []);
  const flushing = useRef(false);
  const timer = useRef(null);
  const repoRef = useRef(repo);
  repoRef.current = repo;

  const publish = useCallback(
    (base) => {
      const merged = applyOps(base, pending.current);
      setMarkers(merged);
      LS.set(keys.cache, merged);
    },
    [keys.cache]
  );

  const flush = useCallback(async () => {
    if (mode !== 'github') return;
    if (flushing.current) return;
    flushing.current = true;
    setStatus({ state: 'syncing' });
    let ok = false;
    try {
      let tries = 0;
      while (pending.current.length && tries < 8) {
        tries++;
        const ops = [...pending.current];
        const { data, sha } = await readMarkers(repoRef.current, session.token);
        const next = applyOps(data.markers, ops);
        try {
          await writeMarkers(
            repoRef.current,
            session.token,
            { version: 1, updatedAt: new Date().toISOString(), markers: next },
            sha,
            `marker: ${ops.length} modifiche di ${session.username}`
          );
        } catch (e) {
          if (e.status === 409) continue; // qualcuno ha salvato in contemporanea: riprova
          if (!sha && (e.status === 404 || e.status === 422)) {
            await ensureBranch(repoRef.current, session.token);
            continue;
          }
          throw e;
        }
        pending.current = pending.current.slice(ops.length);
        LS.set(keys.pending, pending.current);
        remote.current = next;
        publish(next);
      }
      ok = true;
      setStatus({ state: 'saved', at: Date.now() });
    } catch (e) {
      setStatus({ state: 'error', message: describeError(e) });
    } finally {
      flushing.current = false;
      if (ok && pending.current.length && timer.current === null) scheduleFlush();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, session?.token, session?.username, keys.pending, publish]);

  const scheduleFlush = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      flush();
    }, DEBOUNCE_MS);
  }, [flush]);

  const refresh = useCallback(async () => {
    if (mode === 'local') {
      const local = LS.get(keys.cache, []);
      remote.current = local;
      setMarkers(local);
      setStatus({ state: 'local' });
      return;
    }
    if (flushing.current) return;
    try {
      const { data } =
        mode === 'github' ? await readMarkers(repoRef.current, session.token) : await readMarkersPublic(repoRef.current);
      remote.current = data.markers;
      publish(data.markers);
      if (mode === 'public') setStatus({ state: 'readonly' });
      else if (pending.current.length) scheduleFlush();
      else setStatus((s) => (s.state === 'error' || s.state === 'loading' ? { state: 'saved', at: Date.now() } : s));
    } catch (e) {
      setStatus({ state: 'error', message: describeError(e) });
    }
  }, [mode, keys.cache, session?.token, publish, scheduleFlush]);

  useEffect(() => {
    refresh();
    if (mode === 'local') return;
    const id = setInterval(() => {
      if (!pending.current.length && document.visibilityState === 'visible') refresh();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [refresh, mode]);

  // Avvisa se si chiude la pagina con modifiche non ancora salvate
  useEffect(() => {
    const onLeave = (e) => {
      if (pending.current.length) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, []);

  const commit = useCallback(
    (ops) => {
      if (mode === 'public') return;
      if (mode === 'local') {
        const next = applyOps(remote.current, ops);
        remote.current = next;
        setMarkers(next);
        LS.set(keys.cache, next);
        return;
      }
      pending.current = [...pending.current, ...ops];
      LS.set(keys.pending, pending.current);
      publish(remote.current);
      setStatus({ state: 'syncing' });
      scheduleFlush();
    },
    [mode, keys.cache, keys.pending, publish, scheduleFlush]
  );

  const upsert = useCallback((marker) => commit([{ type: 'upsert', marker }]), [commit]);
  const remove = useCallback((id) => commit([{ type: 'delete', id }]), [commit]);
  const importMany = useCallback((list) => commit(list.map((marker) => ({ type: 'upsert', marker }))), [commit]);

  return {
    markers,
    status,
    mode,
    upsert,
    remove,
    importMany,
    retry: () => (pending.current.length ? flush() : refresh()),
  };
}
