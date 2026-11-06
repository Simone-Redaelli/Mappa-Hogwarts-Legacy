import { useEffect, useRef, useState } from 'react';
import { REGION_COLORS } from '../lib/categories.js';

export default function RegionEditor({ draft, onSave, onCancel, onDelete }) {
  const [name, setName] = useState(draft.name || '');
  const [color, setColor] = useState(draft.color || REGION_COLORS[0]);
  const [note, setNote] = useState(draft.note || '');
  const ref = useRef(null);
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;
  const isNew = !draft.createdAt;

  useEffect(() => {
    ref.current?.focus();
    const onKey = (e) => e.key === 'Escape' && cancelRef.current();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function submit(e) {
    e.preventDefault();
    onSave({ ...draft, name: name.trim() || 'Regione', color, note: note.trim() });
  }

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <form className="modal" onSubmit={submit}>
        <div className="modal-head">
          <h2>{isNew ? 'Nuova regione' : 'Modifica regione'}</h2>
          <span className="coords-inline">{draft.points.length} punti</span>
        </div>
        <label className="field">
          <span>Nome (appare sulla mappa)</span>
          <input ref={ref} value={name} onChange={(e) => setName(e.target.value)} placeholder="Es. Valle di Hogwarts" maxLength={60} />
        </label>
        <div className="field">
          <span>Colore del confine</span>
          <div className="swatches">
            {REGION_COLORS.map((c) => (
              <button
                type="button"
                key={c}
                className={`swatch${color === c ? ' on' : ''}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
                aria-label={c}
              />
            ))}
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} title="Colore personalizzato" />
          </div>
        </div>
        <label className="field">
          <span>Note (facoltative)</span>
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
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
