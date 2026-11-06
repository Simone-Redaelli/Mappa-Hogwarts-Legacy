import { useState } from 'react';
import { unlockUser } from '../lib/crypto.js';
import Crest from './Crest.jsx';

const base = import.meta.env.BASE_URL;

export default function Login({ config, onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`${base}users.json?t=${Date.now()}`, { cache: 'no-store' });
      const { users = [] } = await res.json();
      const entry = users.find((u) => u.username.toLowerCase() === username.trim().toLowerCase());
      const unlocked = entry ? await unlockUser(entry, password) : null;
      if (!unlocked) {
        setError('Username o password non corretti');
        return;
      }
      onLogin({ username: unlocked.username, role: unlocked.role || 'editor', token: unlocked.token || null }, remember);
    } catch {
      setError('Impossibile leggere users.json');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <div className="login-bg" />
      <form className="login-card" onSubmit={submit}>
        <Crest />
        <h1>{config.title || 'Hogwarts Legacy'}</h1>
        <p className="login-sub">{config.subtitle || 'Mappa interattiva'}</p>

        <label className="field">
          <span>Username</span>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        <label className="check">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          <span>Ricordami su questo dispositivo</span>
        </label>

        {error && <div className="login-error">{error}</div>}

        <button className="btn btn-gold btn-block" disabled={busy}>
          {busy ? 'Verifica…' : 'Entra'}
        </button>
        <a className="login-link" href="#/setup">
          Gestione utenti
        </a>
      </form>
    </div>
  );
}
