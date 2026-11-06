import { useEffect, useMemo, useRef, useState } from 'react';
import {
  MapContainer,
  ImageOverlay,
  Marker,
  Popup,
  Polygon,
  Polyline,
  CircleMarker,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import { getCat } from '../lib/categories.js';
import CatIcon, { badgeHtml } from './CatIcon.jsx';

// Coordinate indipendenti dalla risoluzione: la mappa è sempre larga 1000 unità.
// Così se carichi un'immagine più grande/piccola i marker restano al loro posto.
export const MAP_UNITS = 1000;

const iconCache = new Map();
function pinIcon(catId, done) {
  const key = `${catId}:${done}`;
  if (!iconCache.has(key)) {
    iconCache.set(
      key,
      L.divIcon({ className: 'pin-wrap', html: badgeHtml(catId, done), iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -14] })
    );
  }
  return iconCache.get(key);
}

function Events({ tool, canEdit, onPick, onDrawPoint, onDrawFinish, onCursor }) {
  const map = useMapEvents({
    click(e) {
      if (tool?.type === 'add') onPick(e.latlng, { quick: tool.quick });
      else if (tool?.type === 'draw') onDrawPoint(e.latlng);
    },
    dblclick() {
      if (tool?.type === 'draw') onDrawFinish();
    },
    contextmenu(e) {
      if (canEdit && !tool) onPick(e.latlng, { quick: false });
    },
    mousemove(e) {
      onCursor(e.latlng);
    },
  });
  useEffect(() => {
    if (tool?.type === 'draw') map.doubleClickZoom.disable();
    else map.doubleClickZoom.enable();
  }, [tool, map]);
  return null;
}

/** Rimpicciolisce icone ed etichette quando la mappa è vista da lontano. */
function ZoomClass() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const update = () => {
      const px = MAP_UNITS * Math.pow(2, map.getZoom()); // larghezza mappa in pixel
      el.classList.toggle('z-far', px < 1500);
      el.classList.toggle('z-mid', px >= 1500 && px < 2800);
    };
    update();
    map.on('zoomend', update);
    return () => map.off('zoomend', update);
  }, [map]);
  return null;
}

function Focus({ focus, markers, refs, detailZoom }) {
  const map = useMap();
  useEffect(() => {
    if (!focus) return;
    const m = markers.find((x) => x.id === focus.id);
    if (!m) return;
    map.once('moveend', () => refs.current[m.id]?.openPopup());
    map.flyTo([m.lat, m.lng], Math.max(map.getZoom(), detailZoom - 1), { duration: 0.6 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);
  return null;
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

export default function MapView({
  map,
  markers,
  regions,
  showRegions,
  canEdit,
  tool,
  drawPts,
  focus,
  onPick,
  onDrawPoint,
  onDrawFinish,
  onEdit,
  onDelete,
  onMove,
  onToggleDone,
  onRegionEdit,
  onRegionDelete,
}) {
  const refs = useRef({});
  const [cursor, setCursor] = useState(null);
  const busy = !!tool;

  const geo = useMemo(() => {
    const H = (MAP_UNITS * map.h) / map.w;
    const native = Math.log2(map.w / MAP_UNITS); // zoom in cui 1 px immagine = 1 px schermo
    return {
      bounds: [[0, 0], [H, MAP_UNITS]],
      maxBounds: [[-H * 0.35, -MAP_UNITS * 0.35], [H * 1.35, MAP_UNITS * 1.35]],
      native,
      maxZoom: Math.max(2, Math.ceil(native) + 2), // fino a 4x oltre la risoluzione originale
    };
  }, [map.w, map.h]);

  return (
    <div className={`map-wrap${busy ? ' adding' : ''}`}>
      <MapContainer
        key={map.url}
        crs={L.CRS.Simple}
        bounds={geo.bounds}
        maxBounds={geo.maxBounds}
        maxBoundsViscosity={0.8}
        minZoom={-3}
        maxZoom={geo.maxZoom}
        zoomSnap={0.25}
        zoomDelta={0.5}
        wheelPxPerZoomLevel={110}
        attributionControl={false}
        zoomControl={false}
        className="map"
      >
        <ImageOverlay url={map.url} bounds={geo.bounds} className="map-img" />
        <Events
          tool={tool}
          canEdit={canEdit}
          onPick={onPick}
          onDrawPoint={onDrawPoint}
          onDrawFinish={onDrawFinish}
          onCursor={setCursor}
        />
        <ZoomClass />
        <Focus focus={focus} markers={markers} refs={refs} detailZoom={geo.native} />
        <ZoomButtons bounds={geo.bounds} native={geo.native} />

        {showRegions &&
          regions.map((r) => (
            <Polygon
              key={`${r.id}-${busy ? 'b' : 'i'}-${r.updatedAt}`}
              positions={r.points}
              interactive={!busy}
              pathOptions={{ color: r.color, weight: 3, opacity: 0.95, fillColor: r.color, fillOpacity: 0.05, className: 'region-path' }}
            >
              <Tooltip permanent direction="center" className="region-label" interactive={false}>
                {r.name}
              </Tooltip>
              {!busy && (
                <Popup minWidth={200}>
                  <div className="pop">
                    <div className="pop-cat" style={{ color: r.color }}>
                      Regione
                    </div>
                    <h3>{r.name}</h3>
                    {r.note && <p className="pop-note">{r.note}</p>}
                    {canEdit && (
                      <div className="pop-actions">
                        <span className="grow" />
                        <button className="icon-btn" title="Modifica" onClick={() => onRegionEdit(r)}>
                          ✎
                        </button>
                        <button className="icon-btn danger" title="Elimina" onClick={() => onRegionDelete(r)}>
                          🗑
                        </button>
                      </div>
                    )}
                  </div>
                </Popup>
              )}
            </Polygon>
          ))}

        {tool?.type === 'draw' && drawPts.length > 0 && (
          <>
            <Polyline positions={drawPts} pathOptions={{ color: '#f0d48a', weight: 3, dashArray: '6 6', interactive: false }} />
            {cursor && (
              <Polyline
                positions={[drawPts[drawPts.length - 1], [cursor.lat, cursor.lng]]}
                pathOptions={{ color: '#f0d48a', weight: 2, opacity: 0.6, dashArray: '2 6', interactive: false }}
              />
            )}
            {drawPts.map((p, i) => (
              <CircleMarker
                key={i}
                center={p}
                radius={i === 0 ? 8 : 4}
                bubblingMouseEvents={false}
                pathOptions={{ color: '#f0d48a', weight: 2, fillColor: i === 0 ? '#f0d48a' : '#14111a', fillOpacity: 1 }}
                eventHandlers={i === 0 && drawPts.length >= 3 ? { click: onDrawFinish } : {}}
              />
            ))}
          </>
        )}

        {markers.map((m) => {
          const c = getCat(m.category);
          return (
            <Marker
              key={m.id}
              position={[m.lat, m.lng]}
              icon={pinIcon(m.category, m.done)}
              draggable={canEdit && !busy}
              ref={(r) => {
                if (r) refs.current[m.id] = r;
                else delete refs.current[m.id];
              }}
              eventHandlers={{ dragend: (e) => onMove(m, e.target.getLatLng()) }}
            >
              <Popup maxWidth={320} minWidth={240}>
                <div className="pop">
                  <div className="pop-cat" style={{ color: c.color }}>
                    <CatIcon id={m.category} size={20} /> {c.label}
                  </div>
                  <h3>{m.title}</h3>
                  {m.note ? <p className="pop-note">{m.note}</p> : <p className="pop-note muted">Nessuna nota</p>}
                  <div className="pop-meta">
                    {m.author} · {formatDate(m.updatedAt || m.createdAt)}
                  </div>
                  {canEdit && (
                    <div className="pop-actions">
                      <button className={`chip${m.done ? ' on' : ''}`} onClick={() => onToggleDone(m)}>
                        {m.done ? '✓ Completato' : 'Segna completato'}
                      </button>
                      <span className="grow" />
                      <button className="icon-btn" title="Modifica" onClick={() => onEdit(m)}>
                        ✎
                      </button>
                      <button className="icon-btn danger" title="Elimina" onClick={() => onDelete(m)}>
                        🗑
                      </button>
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {cursor && (
        <div className="coords">
          X {cursor.lng.toFixed(1)} · Y {cursor.lat.toFixed(1)}
        </div>
      )}
    </div>
  );
}

function ZoomButtons({ bounds, native }) {
  const map = useMap();
  const el = useRef(null);
  useEffect(() => {
    if (!el.current) return;
    L.DomEvent.disableClickPropagation(el.current);
    L.DomEvent.disableScrollPropagation(el.current);
  }, []);
  return (
    <div className="zoom-ctrl" ref={el}>
      <button onClick={() => map.zoomIn()} title="Zoom avanti">
        +
      </button>
      <button onClick={() => map.zoomOut()} title="Zoom indietro">
        −
      </button>
      <button className="zoom-1to1" onClick={() => map.flyTo(map.getCenter(), native, { duration: 0.5 })} title="Dettaglio massimo (1:1)">
        1:1
      </button>
      <button onClick={() => map.flyToBounds(bounds, { duration: 0.5 })} title="Vista intera">
        ⤢
      </button>
    </div>
  );
}
