import { useCallback, useEffect, useRef, useState } from 'react';
import { createInvite, deleteInvite, deleteRepoUser, fetchBundledUsers, fetchRepoUsers } from '../lib/users.js';
import { describeError } from '../lib/github.js';

const ROLE = { admin: 'Admin', editor: 'Editor', viewer: 'Viewer' };
const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

export default function UsersPanel({ repo, session, onClose }) {
  const [data, setData] = useState(null);
  const [bundled, setBundled] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ role: 'editor', maxUses: '', days: '', label: '' });
  const [newCode, setNewCode] = useState(null);
  const [copied, setCopied] = useState('');
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const load = useCallback(async () => {
    setError('');
    try {
      const [r, b] = await Promise.all([fetchRepoUsers(repo, session.token), fetchBundledUsers()]);
      setData(r);
      setBundled(b);
    } catch (e) {
      setError(describeError(e));
    }
  }, [repo, session.token]);

  useEffect(() => {
    load();
    const onKey = (e) => e.key === 'Escape' && closeRef.current();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [load]);

  async function run(fn) {
    setBusy(true);
    setError('');
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e.message ? describeError(e) : 'Errore');
    } finally {
      setBusy(false);
    }
  }

  const siteUrl = window.location.origin + window.location.pathname;
  const shareText = (code) =>
    `Registrati sulla mappa di Hogwarts Legacy: ${siteUrl}?invito=${code}\nOppure vai su ${siteUrl}, scheda "Registrati", codice: ${code}`;

  const copy = (text, what) => navigator.clipboard.writeText(text).then(() => setCopied(what));

  const create = (e) => {
    e.preventDefault();
    run(async () => {
      const code = await createInvite(repo, session, {
        role: form.role,
        maxUses: +form.maxUses || 0,
        days: +form.days || 0,
        label: form.label.trim(),
      });
      setNewCode(code);
      setCopied('');
    });
  };

  const repoUsers = data?.users || [];
  const invites = data?.invites || [];
  const bundledOnly = bundled.filter((b) => !repoUsers.some((u) => u.username.toLowerCase() === b.username.toLowerCase()));

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-wide">
        <div className="modal-head">
          <h2>Utenti e inviti</h2>
          <button className="icon-btn" onClick={onClose} title="Chiudi">
            ✕
          </button>
        </div>

        {error && <div className="login-error">{error}</div>}

        <section className="up-section">
          <h3>Nuovo codice di registrazione</h3>
          <form className="up-form" onSubmit={create}>
            <label className="field">
              <span>Ruolo</span>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="editor">Editor — aggiunge e modifica</option>
                <option value="viewer">Viewer — solo visualizzazione</option>
              </select>
            </label>
            <label className="field">
              <span>Utilizzi max</span>
              <input type="number" min="0" placeholder="illimitati" value={form.maxUses} onChange={(e) => setForm({ ...form, maxUses: e.target.value })} />
            </label>
            <label className="field">
              <span>Scade dopo (giorni)</span>
              <input type="number" min="0" placeholder="mai" value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} />
            </label>
            <label className="field">
              <span>Nota (per te)</span>
              <input placeholder="Es. amici Discord" value={form.label} maxLength={40} onChange={(e) => setForm({ ...form, label: e.target.value })} />
            </label>
            <button className="btn btn-gold" disabled={busy}>
              {busy ? 'Attendi…' : 'Genera codice'}
            </button>
          </form>

          {newCode && (
            <div className="code-box">
              <div className="code">{newCode}</div>
              <p>Copialo ora: per sicurezza non verrà più mostrato. Chi lo usa sceglie da solo username e password.</p>
              <div className="setup-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => copy(newCode, 'code')}>
                  {copied === 'code' ? 'Copiato ✓' : 'Copia codice'}
                </button>
                <button className="btn btn-gold btn-sm" onClick={() => copy(shareText(newCode), 'msg')}>
                  {copied === 'msg' ? 'Copiato ✓' : 'Copia messaggio con link'}
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="up-section">
          <h3>
            Codici attivi <span>{invites.length}</span>
          </h3>
          {!data && <p className="muted">Caricamento…</p>}
          {data && !invites.length && <p className="muted">Nessun codice. Generane uno per far registrare qualcuno.</p>}
          {invites.map((i) => {
            const expired = i.expires && Date.parse(i.expires) < Date.now();
            const full = i.maxUses && (i.uses || 0) >= i.maxUses;
            return (
              <div key={i.id} className={`up-row${expired || full ? ' dim' : ''}`}>
                <div className="up-main">
                  <strong>{i.label || `Codice ${ROLE[i.role]}`}</strong>
                  <small>
                    {ROLE[i.role]} · usato {i.uses || 0}
                    {i.maxUses ? `/${i.maxUses}` : ''} volte · {i.expires ? `scade ${fmt(i.expires)}` : 'non scade'}
                    {expired ? ' · SCADUTO' : full ? ' · ESAURITO' : ''} · creato da {i.createdBy}
                  </small>
                </div>
                <button
                  className="icon-btn danger"
                  title="Elimina codice"
                  disabled={busy}
                  onClick={() => window.confirm('Eliminare questo codice? Chi non si è ancora registrato non potrà più usarlo.') && run(() => deleteInvite(repo, session, i.id))}
                >
                  🗑
                </button>
              </div>
            );
          })}
        </section>

        <section className="up-section">
          <h3>
            Utenti <span>{repoUsers.length + bundledOnly.length}</span>
          </h3>
          {repoUsers.map((u) => (
            <div key={u.username} className="up-row">
              <span className="avatar sm">{u.username[0].toUpperCase()}</span>
              <div className="up-main">
                <strong>{u.username}</strong>
                <small>
                  {ROLE[u.role] || 'Editor'} · registrato {fmt(u.createdAt)}
                </small>
              </div>
              {u.username.toLowerCase() !== session.username.toLowerCase() && (
                <button
                  className="icon-btn danger"
                  title="Elimina utente"
                  disabled={busy}
                  onClick={() => window.confirm(`Eliminare l'utente ${u.username}?`) && run(() => deleteRepoUser(repo, session, u.username))}
                >
                  🗑
                </button>
              )}
            </div>
          ))}
          {bundledOnly.map((u) => (
            <div key={u.username} className="up-row">
              <span className="avatar sm">{u.username[0].toUpperCase()}</span>
              <div className="up-main">
                <strong>{u.username}</strong>
                <small>{ROLE[u.role] || 'Editor'} · dal file public/users.json (si toglie da lì)</small>
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
