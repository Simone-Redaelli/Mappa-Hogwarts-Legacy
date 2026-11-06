import { useEffect, useMemo, useRef, useState } from 'react';
import MapView from './MapView.jsx';
import MarkerEditor from './MarkerEditor.jsx';
import Crest from './Crest.jsx';
import CatIcon from './CatIcon.jsx';
import RegionEditor from './RegionEditor.jsx';
import { useMarkers } from '../lib/useMarkers.js';
import { useMapSource } from '../lib/useMapSource.js';
import { CATEGORIES, getCat, REGION_COLORS } from '../lib/categories.js';

const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

function StatusBadge({ status, mode, onRetry }) {
  let cls = 'ok';
  let text = 'Salvato';
  if (mode === 'local') {
    cls = 'warn';
    text = 'Salvataggio locale (solo questo browser)';
  } else if (status.state === 'loading') {
    cls = 'busy';
    text = 'Caricamento…';
  } else if (status.state === 'syncing') {
    cls = 'busy';
    text = 'Salvataggio su GitHub…';
  } else if (status.state === 'readonly') {
    cls = 'info';
    text = 'Sola lettura';
  } else if (status.state === 'error') {
    cls = 'err';
    text = status.message;
  } else if (status.state === 'saved') {
    text = 'Salvato su GitHub';
  }
  return (
    <div className={`status status-${cls}`}>
      <i />
      <span>{text}</span>
      {status.state === 'error' && (
        <button className="link" onClick={onRetry}>
          Riprova
        </button>
      )}
    </div>
  );
}

export default function MapApp({ config, repo, session, onLogout }) {
  const { markers: items, status, mode, upsert, remove, importMany, retry } = useMarkers(session, repo);
  const canEdit = session.role !== 'viewer' && mode !== 'public';
  const { map, upload, uploading, reload: reloadMap } = useMapSource(session, repo, mode, config);
  const mapFileRef = useRef(null);
  const fileRef = useRef(null);
  const [mapMsg, setMapMsg] = useState('');

  // Nel file salvato marker e regioni stanno nella stessa lista (kind: 'region')
  const markers = useMemo(() => items.filter((i) => i.kind !== 'region'), [items]);
  const regions = useMemo(() => items.filter((i) => i.kind === 'region'), [items]);

  // tool: null | { type: 'add', cat, quick } | { type: 'draw' }
  const [tool, setTool] = useState(null);
  const [addCat, setAddCat] = useState('nota');
  const [quick, setQuick] = useState(false);
  const [drawPts, setDrawPts] = useState([]);
  const [placed, setPlaced] = useState([]); // id posizionati in modalità rapida (per "annulla")
  const [draft, setDraft] = useState(null);
  const [regionDraft, setRegionDraft] = useState(null);
  const [focus, setFocus] = useState(null);
  const [query, setQuery] = useState('');
  const [hidden, setHidden] = useState(() => new Set());
  const [hideDone, setHideDone] = useState(false);
  const [showRegions, setShowRegions] = useState(true);
  const [panelOpen, setPanelOpen] = useState(() => window.innerWidth > 820);
  const [listLimit, setListLimit] = useState(200);
  const [tab, setTab] = useState('cats');

  const stopTool = () => {
    setTool(null);
    setDrawPts([]);
    setPlaced([]);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !draft && !regionDraft) stopTool();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [draft, regionDraft]);

  // tiene allineato lo strumento attivo con categoria/rapido scelti nella barra
  useEffect(() => {
    setTool((t) => (t?.type === 'add' ? { type: 'add', cat: addCat, quick } : t));
  }, [addCat, quick]);

  const counts = useMemo(() => {
    const c = {};
    for (const m of markers) c[m.category] = (c[m.category] || 0) + 1;
    return c;
  }, [markers]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return markers.filter(
      (m) =>
        !hidden.has(m.category) &&
        !(hideDone && m.done) &&
        (!q || m.title.toLowerCase().includes(q) || (m.note || '').toLowerCase().includes(q))
    );
  }, [markers, hidden, hideDone, query]);

  const sortedList = useMemo(
    () => [...visible].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')),
    [visible]
  );

  const closePanelOnMobile = () => window.innerWidth <= 820 && setPanelOpen(false);

  const startAdd = () => {
    setDrawPts([]);
    setPlaced([]);
    setTool((t) => (t?.type === 'add' ? null : { type: 'add', cat: addCat, quick }));
    closePanelOnMobile();
  };

  const startDraw = () => {
    setPlaced([]);
    setDrawPts([]);
    setTool((t) => (t?.type === 'draw' ? null : { type: 'draw' }));
    setShowRegions(true);
    closePanelOnMobile();
  };

  const toggleCat = (id) =>
    setHidden((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const stamp = (m) => {
    const now = new Date().toISOString();
    return { ...m, author: m.author || session.username, createdAt: m.createdAt || now, updatedAt: now, updatedBy: session.username };
  };
  const round = (v) => +v.toFixed(2);

  const pick = (latlng, { quick: q }) => {
    const cat = tool?.type === 'add' ? tool.cat : addCat;
    const base = { id: uid(), lat: round(latlng.lat), lng: round(latlng.lng), category: cat, title: '', note: '' };
    if (q) {
      upsert(stamp({ ...base, title: getCat(cat).label }));
      setPlaced((p) => [...p, base.id]);
      return;
    }
    setTool(null);
    setDraft(base);
  };

  const undoPlaced = () => {
    const last = placed[placed.length - 1];
    if (!last) return;
    remove(last);
    setPlaced((p) => p.slice(0, -1));
  };

  const save = (m) => {
    upsert(stamp({ ...m, lat: round(m.lat), lng: round(m.lng) }));
    setAddCat(m.category);
    setDraft(null);
    setFocus({ id: m.id, n: Date.now() });
  };

  const del = (m) => {
    if (!window.confirm(`Eliminare "${m.title}"?`)) return;
    remove(m.id);
    setDraft(null);
  };

  const move = (m, p) => upsert(stamp({ ...m, lat: round(p.lat), lng: round(p.lng) }));
  const toggleDone = (m) => upsert(stamp({ ...m, done: !m.done }));

  // ---- regioni
  const finishDraw = () => {
    // il doppio clic aggiunge due punti uguali: li tolgo
    const pts = drawPts.filter((p, i, a) => i === 0 || Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) > 0.5);
    if (pts.length < 3) return;
    setTool(null);
    setDrawPts([]);
    setRegionDraft({
      id: uid(),
      kind: 'region',
      name: '',
      color: REGION_COLORS[regions.length % REGION_COLORS.length],
      points: pts.map(([a, b]) => [round(a), round(b)]),
    });
  };

  const saveRegion = (r) => {
    upsert(stamp(r));
    setRegionDraft(null);
  };

  const delRegion = (r) => {
    if (!window.confirm(`Eliminare la regione "${r.name}"?`)) return;
    remove(r.id);
    setRegionDraft(null);
  };

  // ---- mappa
  async function onMapFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return setMapMsg("Il file deve essere un'immagine (JPG, PNG o WEBP)");
    if (map.status === 'ready' && !window.confirm('Sostituire la mappa attuale? Marker e regioni restano dove sono.')) return;
    setMapMsg('');
    const res = await upload(file);
    setMapMsg(res.ok ? `Mappa caricata (${res.w}×${res.h}px)` : `Errore: ${res.message}`);
  }

  // ---- backup
  function exportJson() {
    const blob = new Blob([JSON.stringify({ version: 1, markers: items }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `mappa-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importJson(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const obj = JSON.parse(await file.text());
      const list = (Array.isArray(obj) ? obj : obj.markers || []).filter(
        (m) =>
          m &&
          ((m.kind === 'region' && Array.isArray(m.points) && m.points.length >= 3) ||
            (typeof m.lat === 'number' && typeof m.lng === 'number'))
      );
      if (!list.length) return alert('Nessun elemento valido nel file');
      if (!window.confirm(`Importare ${list.length} elementi? Quelli con lo stesso ID verranno sovrascritti.`)) return;
      importMany(
        list.map((m) =>
          m.kind === 'region'
            ? { ...m, id: m.id || uid(), name: m.name || 'Regione', color: m.color || REGION_COLORS[0], author: m.author || session.username }
            : {
                ...m,
                id: m.id || uid(),
                title: m.title || getCat(m.category).label,
                note: m.note || '',
                category: m.category || 'nota',
                author: m.author || session.username,
              }
        )
      );
    } catch {
      alert('File non valido');
    }
  }

  useEffect(() => {
    if (!mapMsg || map.status !== 'ready') return;
    const t = setTimeout(() => setMapMsg(''), 4000);
    return () => clearTimeout(t);
  }, [mapMsg, map.status]);

  const doneCount = markers.filter((m) => m.done).length;
  const ready = map.status === 'ready';

  return (
    <div className={`app${panelOpen ? ' panel-open' : ''}`}>
      <aside className="panel">
        <header className="panel-head">
          <Crest size={36} />
          <div className="panel-title">
            <h1>{config.title || 'Hogwarts Legacy'}</h1>
            <span>{config.subtitle || 'Mappa interattiva'}</span>
          </div>
          <button className="icon-btn panel-close" onClick={() => setPanelOpen(false)} title="Chiudi pannello">
            ✕
          </button>
        </header>

        {canEdit && ready && (
          <div className="tools-row">
            <button className={`btn ${tool?.type === 'add' ? 'btn-ghost' : 'btn-gold'}`} onClick={startAdd}>
              {tool?.type === 'add' ? 'Fine' : '+ Marker'}
            </button>
            <button className={`btn btn-ghost${tool?.type === 'draw' ? ' active' : ''}`} onClick={startDraw}>
              {tool?.type === 'draw' ? 'Annulla regione' : '⬡ Regione'}
            </button>
          </div>
        )}
        {canEdit && ready && <p className="hint">Tasto destro = marker al volo · i marker si trascinano · clic su una regione per modificarla</p>}

        <input className="search" placeholder="Cerca nei marker e nelle note…" value={query} onChange={(e) => {
          setQuery(e.target.value);
          if (e.target.value) setTab('list');
        }} />

        <div className="tabs">
          <button className={tab === 'cats' ? 'on' : ''} onClick={() => setTab('cats')}>
            Categorie
          </button>
          <button className={tab === 'list' ? 'on' : ''} onClick={() => setTab('list')}>
            Elenco <span>{visible.length}</span>
          </button>
        </div>

        {tab === 'cats' ? (
          <div className="list">
        <div className="cats">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              className={`cat${hidden.has(c.id) ? ' off' : ''}`}
              style={{ '--c': c.color }}
              onClick={() => toggleCat(c.id)}
              title={hidden.has(c.id) ? 'Mostra' : 'Nascondi'}
            >
              <CatIcon id={c.id} size={20} />
              <span className="cat-name">{c.label}</span>
              <span className="cat-n">{counts[c.id] || 0}</span>
            </button>
          ))}
        </div>
        <div className="cats-tools">
          <button className="link" onClick={() => setHidden(new Set())}>
            Mostra tutte
          </button>
          <button className="link" onClick={() => setHidden(new Set(CATEGORIES.map((c) => c.id)))}>
            Nascondi tutte
          </button>
          <label className="check small">
            <input type="checkbox" checked={showRegions} onChange={(e) => setShowRegions(e.target.checked)} />
            <span>Regioni ({regions.length})</span>
          </label>
          <label className="check small">
            <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} />
            <span>Nascondi completati ({doneCount})</span>
          </label>
        </div>

          </div>
        ) : (
          <div className="list">
          {visible.length === 0 && (
            <div className="empty">Nessun marker{markers.length ? ' con questi filtri' : ' ancora: aggiungine uno!'}</div>
          )}
          {sortedList.slice(0, listLimit).map((m) => (
            <button
              key={m.id}
              className={`item${m.done ? ' done' : ''}`}
              onClick={() => {
                setFocus({ id: m.id, n: Date.now() });
                closePanelOnMobile();
              }}
            >
              <CatIcon id={m.category} size={28} done={m.done} />
              <span className="item-body">
                <strong>{m.title}</strong>
                {m.note && <small>{m.note}</small>}
              </span>
            </button>
          ))}
          {sortedList.length > listLimit && (
            <button className="link more" onClick={() => setListLimit((n) => n + 200)}>
              Mostra altri {Math.min(200, sortedList.length - listLimit)} di {sortedList.length - listLimit}
            </button>
          )}
        </div>
        )}

        <footer className="panel-foot">
          <StatusBadge status={status} mode={mode} onRetry={retry} />
          <div className="foot-row">
            <div className="user">
              <span className="avatar">{session.username.slice(0, 1).toUpperCase()}</span>
              <span>
                {session.username}
                <small>{canEdit ? 'Editor' : 'Viewer'}</small>
              </span>
            </div>
            <div className="foot-actions">
              <button className="icon-btn" title="Esporta backup JSON" onClick={exportJson}>
                ⤓
              </button>
              {canEdit && (mode === 'github' || mode === 'local') && (
                <button className="icon-btn" title="Cambia immagine mappa" disabled={uploading} onClick={() => mapFileRef.current?.click()}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14" />
                  </svg>
                </button>
              )}
              {canEdit && (
                <button className="icon-btn" title="Importa JSON" onClick={() => fileRef.current?.click()}>
                  ⤒
                </button>
              )}
              <button className="icon-btn" title="Esci" onClick={onLogout}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                </svg>
              </button>
            </div>
          </div>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={importJson} />
        </footer>
      </aside>

      {!panelOpen && (
        <button className="panel-toggle" onClick={() => setPanelOpen(true)}>
          ☰ <span>{markers.length}</span>
        </button>
      )}

      {canEdit && ready && !panelOpen && !tool && (
        <button className="fab" onClick={startAdd} title="Aggiungi marker">
          +
        </button>
      )}

      <main className="stage">
        {ready ? (
          <MapView
            map={map}
            markers={visible}
            regions={regions}
            showRegions={showRegions}
            canEdit={canEdit}
            tool={tool}
            drawPts={drawPts}
            focus={focus}
            onPick={pick}
            onDrawPoint={(p) => setDrawPts((pts) => [...pts, [p.lat, p.lng]])}
            onDrawFinish={finishDraw}
            onEdit={(m) => setDraft(m)}
            onDelete={del}
            onMove={move}
            onToggleDone={toggleDone}
            onRegionEdit={(r) => setRegionDraft(r)}
            onRegionDelete={delRegion}
          />
        ) : (
          <div className="map-empty">
            <div className="map-empty-card">
              <Crest size={48} />
              {map.status === 'loading' && <p>Carico la mappa…</p>}
              {map.status === 'error' && (
                <>
                  <h2>Mappa non disponibile</h2>
                  <p>{map.message}</p>
                  <button className="btn btn-ghost" onClick={reloadMap}>
                    Riprova
                  </button>
                </>
              )}
              {map.status === 'empty' && (
                <>
                  <h2>Nessuna mappa caricata</h2>
                  {canEdit ? (
                    <>
                      <p>
                        Carica l'immagine della mappa vista dall'alto, pulita e senza icone (JPG, PNG o WEBP). Più è grande, più potrai
                        zoomare nel dettaglio.
                      </p>
                      <button className="btn btn-gold" disabled={uploading} onClick={() => mapFileRef.current?.click()}>
                        {uploading ? 'Caricamento in corso…' : 'Carica mappa'}
                      </button>
                    </>
                  ) : (
                    <p>Un editor deve ancora caricare la mappa.</p>
                  )}
                </>
              )}
              {mapMsg && <p className="map-msg">{mapMsg}</p>}
            </div>
          </div>
        )}

        {tool?.type === 'add' && (
          <div className="toolbar">
            <div className="toolbar-cats">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  className={`tb-cat${addCat === c.id ? ' on' : ''}`}
                  style={{ '--c': c.color }}
                  onClick={() => setAddCat(c.id)}
                  title={c.label}
                >
                  <CatIcon id={c.id} size={26} />
                </button>
              ))}
            </div>
            <div className="toolbar-row">
              <span className="tb-label">
                <strong>{getCat(addCat).label}</strong> · clicca sulla mappa
              </span>
              <label className="check small">
                <input type="checkbox" checked={quick} onChange={(e) => setQuick(e.target.checked)} />
                <span>Rapido (senza note)</span>
              </label>
              {placed.length > 0 && (
                <button className="link" onClick={undoPlaced}>
                  Annulla ultimo ({placed.length})
                </button>
              )}
              <button className="btn btn-ghost btn-sm" onClick={stopTool}>
                Fine
              </button>
            </div>
          </div>
        )}

        {tool?.type === 'draw' && (
          <div className="toolbar">
            <div className="toolbar-row">
              <span className="tb-label">
                <strong>Nuova regione</strong> · clicca per aggiungere i punti del confine ({drawPts.length}) · doppio clic o clic sul
                primo punto per chiudere
              </span>
              {drawPts.length > 0 && (
                <button className="link" onClick={() => setDrawPts((p) => p.slice(0, -1))}>
                  Togli ultimo punto
                </button>
              )}
              <button className="btn btn-gold btn-sm" disabled={drawPts.length < 3} onClick={finishDraw}>
                Chiudi regione
              </button>
              <button className="btn btn-ghost btn-sm" onClick={stopTool}>
                Annulla
              </button>
            </div>
          </div>
        )}

        {uploading && ready && <div className="upload-toast">Caricamento della nuova mappa…</div>}
        {mapMsg && ready && !uploading && (
          <div className="upload-toast" onClick={() => setMapMsg('')}>
            {mapMsg}
          </div>
        )}
      </main>
      <input ref={mapFileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onMapFile} />

      {draft && <MarkerEditor draft={draft} onSave={save} onCancel={() => setDraft(null)} onDelete={del} />}
      {regionDraft && (
        <RegionEditor draft={regionDraft} onSave={saveRegion} onCancel={() => setRegionDraft(null)} onDelete={delRegion} />
      )}
    </div>
  );
}
