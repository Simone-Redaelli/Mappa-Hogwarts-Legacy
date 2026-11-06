import { useEffect, useRef, useState } from 'react';
import { CATEGORIES, getCat } from '../lib/categories.js';
import CatIcon from './CatIcon.jsx';

export default function MarkerEditor({ draft, onSave, onCancel, onDelete }) {
  const [title, setTitle] = useState(draft.title || '');
  const [category, setCategory] = useState(draft.category || 'nota');
  const [note, setNote] = useState(draft.note || '');
  const titleRef = useRef(null);
  const isNew = !draft.createdAt;

  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;

  useEffect(() => {
    titleRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && cancelRef.current();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function submit(e) {
    e.preventDefault();
    onSave({ ...draft, title: title.trim() || getCat(category).label, category, note: note.trim() });
  }

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <form className="modal" onSubmit={submit}>
        <div className="modal-head">
          <h2>{isNew ? 'Nuovo marker' : 'Modifica marker'}</h2>
          <span className="coords-inline">
            X {Math.round(draft.lng)} · Y {Math.round(draft.lat)}
          </span>
        </div>

        <label className="field">
          <span>Titolo</span>
          <input ref={titleRef} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Es. Baule dietro la torre" maxLength={120} />
        </label>

        <div className="field">
          <span>Categoria</span>
          <div className="cat-grid">
            {CATEGORIES.map((c) => (
              <button
                type="button"
                key={c.id}
                className={`cat-pick${category === c.id ? ' on' : ''}`}
                style={{ '--c': c.color }}
                onClick={() => setCategory(c.id)}
              >
                <CatIcon id={c.id} size={22} />
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <label className="field">
          <span>Note</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={6}
            placeholder="Scrivi qui le tue note: come arrivarci, cosa serve, cosa c'è dentro…"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit(e);
            }}
          />
        </label>

        <div className="modal-actions">
          {!isNew && (
            <button type="button" className="btn btn-danger" onClick={() => onDelete(draft)}>
              Elimina
            </button>
          )}
          <span className="grow" />
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Annulla
          </button>
          <button className="btn btn-gold">Salva</button>
        </div>
      </form>
    </div>
  );
}
