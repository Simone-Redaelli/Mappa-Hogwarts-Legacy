import { useEffect, useState } from 'react';
import { createUserEntry } from '../lib/crypto.js';
import Crest from './Crest.jsx';

const base = import.meta.env.BASE_URL;

export default function Setup({ repo }) {
  const [existing, setExisting] = useState([]);
  const [form, setForm] = useState({ username: '', password: '', password2: '', role: 'admin', token: '' });
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`${base}users.json?t=${Date.now()}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setExisting(d.users || []))
      .catch(() => setExisting([]));
  }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function generate(e) {
    e.preventDefault();
    setError('');
    setCopied(false);
    const username = form.username.trim();
    if (!username) return setError('Inserisci uno username');
    if (form.password.length < 10) return setError('Usa una password di almeno 10 caratteri (protegge il token)');
    if (form.password !== form.password2) return setError('Le password non coincidono');
    const entry = await createUserEntry({ username, password: form.password, role: form.role, token: form.token.trim() });
    const users = [...existing.filter((u) => u.username.toLowerCase() !== username.toLowerCase()), entry];
    setOutput(JSON.stringify({ users }, null, 2) + '\n');
  }

  function download() {
    const blob = new Blob([output], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'users.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="setup">
      <div className="setup-card">
        <header className="setup-head">
          <Crest size={40} />
          <div>
            <h1>Gestione utenti</h1>
            <p>Crea o aggiorna un account. Tutto avviene nel tuo browser: niente viene inviato.</p>
          </div>
        </header>

        <form className="setup-grid" onSubmit={generate}>
          <label className="field">
            <span>Username</span>
            <input value={form.username} onChange={set('username')} />
          </label>
          <label className="field">
            <span>Ruolo</span>
            <select value={form.role} onChange={set('role')}>
              <option value="admin">Admin — editor + crea codici invito e gestisce utenti</option>
              <option value="editor">Editor — aggiunge e modifica marker</option>
              <option value="viewer">Viewer — solo visualizzazione</option>
            </select>
          </label>
          <label className="field">
            <span>Password</span>
            <input type="password" value={form.password} onChange={set('password')} autoComplete="new-password" />
          </label>
          <label className="field">
            <span>Ripeti password</span>
            <input type="password" value={form.password2} onChange={set('password2')} autoComplete="new-password" />
          </label>
          <label className="field span2">
            <span>Token GitHub (fine-grained, Contents: Read and write) — necessario per salvare online</span>
            <input value={form.token} onChange={set('token')} placeholder="github_pat_…" spellCheck={false} />
          </label>
          {error && <div className="login-error span2">{error}</div>}
          <div className="span2 setup-actions">
            <a className="btn btn-ghost" href="#/">
              ← Torna al login
            </a>
            <button className="btn btn-gold">Genera users.json</button>
          </div>
        </form>

        {output && (
          <div className="setup-out">
            <p>
              Sostituisci <code>public/users.json</code> nel repository con questo contenuto e fai commit. Il token è cifrato
              con la password: senza password è illeggibile.
            </p>
            <textarea readOnly value={output} rows={10} />
            <div className="setup-actions">
              <button
                className="btn btn-ghost"
                onClick={() => navigator.clipboard.writeText(output).then(() => setCopied(true))}
              >
                {copied ? 'Copiato ✓' : 'Copia'}
              </button>
              <button className="btn btn-gold" onClick={download}>
                Scarica users.json
              </button>
            </div>
          </div>
        )}

        <footer className="setup-foot">
          <div>
            Utenti attuali: {existing.length ? existing.map((u) => `${u.username} (${u.role || 'editor'})`).join(', ') : 'nessuno'}
          </div>
          <div>Repository dati: {repo ? `${repo.owner}/${repo.repo} → branch "${repo.branch}"` : 'non rilevato (salvataggio locale)'}</div>
        </footer>
      </div>
    </div>
  );
}
