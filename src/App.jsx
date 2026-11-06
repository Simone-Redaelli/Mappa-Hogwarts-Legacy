import { useEffect, useMemo, useState } from 'react';
import Login from './components/Login.jsx';
import Setup from './components/Setup.jsx';
import MapApp from './components/MapApp.jsx';
import { resolveRepo } from './lib/github.js';

const SESSION_KEY = 'hlmap:session';
const base = import.meta.env.BASE_URL;

function loadSession() {
  for (const store of [sessionStorage, localStorage]) {
    try {
      const s = JSON.parse(store.getItem(SESSION_KEY));
      if (s?.username) return s;
    } catch {}
  }
  return null;
}

function useHash() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash;
}

export default function App() {
  const [config, setConfig] = useState(null);
  const [session, setSession] = useState(loadSession);
  const hash = useHash();

  useEffect(() => {
    fetch(`${base}config.json`, { cache: 'no-store' })
      .then((r) => r.json())
      .catch(() => ({}))
      .then((c) => setConfig(c || {}));
  }, []);

  const repo = useMemo(() => (config ? resolveRepo(config.github) : null), [config]);

  if (!config) return <div className="boot">Caricamento…</div>;

  if (hash.startsWith('#/setup')) return <Setup config={config} repo={repo} />;

  if (!session) {
    return (
      <Login
        config={config}
        repo={repo}
        onLogin={(s, remember) => {
          const store = remember ? localStorage : sessionStorage;
          store.setItem(SESSION_KEY, JSON.stringify(s));
          setSession(s);
        }}
      />
    );
  }

  return (
    <MapApp
      key={session.username}
      config={config}
      repo={repo}
      session={session}
      onLogout={() => {
        sessionStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(SESSION_KEY);
        setSession(null);
      }}
    />
  );
}
