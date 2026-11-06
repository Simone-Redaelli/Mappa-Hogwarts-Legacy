import { useEffect, useState } from 'react';
import { unlockUser } from '../lib/crypto.js';
import { fetchRepoUsers, isOpenRegistration, loadAllUsers, registerUser, validateUsername } from '../lib/users.js';
import Crest from './Crest.jsx';

export default function Login({ config, repo, onLogin }) {
  const [tab, setTab] = useState(() => (new URLSearchParams(window.location.search).get('invito') ? 'register' : 'login'));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [code, setCode] = useState(() => new URLSearchParams(window.location.search).get('invito') || '');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [openReg, setOpenReg] = useState(null); // null = non so ancora
  const [showCode, setShowCode] = useState(() => !!new URLSearchParams(window.location.search).get('invito'));

  useEffect(() => {
    if (tab !== 'register' || openReg !== null) return;
    if (!repo) return setOpenReg(false);
    fetchRepoUsers(repo)
      .then((d) => setOpenReg(isOpenRegistration(d.invites)))
      .catch(() => setOpenReg(false));
  }, [tab, openReg, repo]);

  const needCode = showCode; // il codice è sempre facoltativo

  const switchTab = (t) => {
    setTab(t);
    setError('');
  };

  async function submitLogin(e) {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setBusy(true);
    setError('');
    try {
      const { users } = await loadAllUsers(repo);
      const entry = users.find((u) => u.username.toLowerCase() === username.trim().toLowerCase());
      const unlocked = entry ? await unlockUser(entry, password) : null;
      if (!unlocked) return setError('Username o password non corretti');
      onLogin({ username: unlocked.username, role: unlocked.role || 'editor', token: unlocked.token || null }, remember);
    } catch {
      setError('Impossibile leggere gli utenti, riprova');
    } finally {
      setBusy(false);
    }
  }

  async function submitRegister(e) {
    e.preventDefault();
    const name = username.trim();
    const v = validateUsername(name);
    if (v) return setError(v);
    if (password.length < 10) return setError('La password deve avere almeno 10 caratteri');
    if (password !== password2) return setError('Le password non coincidono');
    if (needCode && !code.trim()) return setError('Inserisci il codice di registrazione');
    setBusy(true);
    setError('');
    try {
      const s = await registerUser(repo, { username: name, password, code: needCode ? code : '' });
      // tolgo ?invito= dall'indirizzo
      if (window.location.search) window.history.replaceState(null, '', window.location.pathname + window.location.hash);
      onLogin(s, remember);
    } catch (err) {
      setError(err.message || 'Registrazione non riuscita');
    } finally {
      setBusy(false);
    }
  }

  const isRegister = tab === 'register';

  return (
    <div className="login">
      <div className="login-bg" />
      <form className="login-card" onSubmit={isRegister ? submitRegister : submitLogin}>
        <Crest />
        <h1>{config.title || 'Hogwarts Legacy'}</h1>
        <p className="login-sub">{config.subtitle || 'Mappa interattiva'}</p>

        <div className="tabs">
          <button type="button" className={!isRegister ? 'on' : ''} onClick={() => switchTab('login')}>
            Accedi
          </button>
          <button type="button" className={isRegister ? 'on' : ''} onClick={() => switchTab('register')}>
            Registrati
          </button>
        </div>

        <label className="field">
          <span>Username</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
            maxLength={24}
          />
        </label>
        <label className="field">
          <span>Password{isRegister ? ' (min 10 caratteri)' : ''}</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isRegister ? 'new-password' : 'current-password'}
          />
        </label>

        {isRegister && (
          <>
            <label className="field">
              <span>Ripeti password</span>
              <input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} autoComplete="new-password" />
            </label>
            {needCode && (
              <label className="field">
                <span>Codice di registrazione</span>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  spellCheck={false}
                  autoComplete="off"
                />
              </label>
            )}
            {!showCode && (
              <div className="login-note">
                {openReg === false
                  ? 'Scegli username e password: l’account e i tuoi marker restano salvati su questo dispositivo.'
                  : 'Scegli username e password e sei dentro.'}{' '}
                <button type="button" className="link" onClick={() => setShowCode(true)}>
                  Ho un codice invito
                </button>
              </div>
            )}
            {showCode && (
              <div className="login-note">
                Il codice te lo dà l'amministratore.{' '}
                <button
                  type="button"
                  className="link"
                  onClick={() => {
                    setShowCode(false);
                    setCode('');
                  }}
                >
                  Registrati senza codice
                </button>
              </div>
            )}
          </>
        )}

        <label className="check">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          <span>Ricordami su questo dispositivo</span>
        </label>

        {error && <div className="login-error">{error}</div>}

        <button className="btn btn-gold btn-block" disabled={busy}>
          {busy ? (isRegister ? 'Creo l’account…' : 'Verifica…') : isRegister ? 'Crea account' : 'Entra'}
        </button>
        <a className="login-link" href="#/setup">
          Gestione utenti avanzata
        </a>
      </form>
    </div>
  );
}
