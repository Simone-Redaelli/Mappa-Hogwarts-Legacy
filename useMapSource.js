import { useCallback, useEffect, useRef, useState } from 'react';
import { readJsonFile, readJsonPublic, fetchRawFile, rawUrl, uploadMap, describeError } from './github.js';
import { idbGet, idbSet } from './idb.js';

const base = import.meta.env.BASE_URL;
const MAX_SIDE = 12000; // oltre questa misura riduco (limite memoria browser)
const MAX_BYTES = 45 * 1024 * 1024;
const RESIZE_TO = 8192;

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = reject;
    img.src = url;
  });
}

/** Prepara il file: lo tiene originale se possibile, altrimenti lo riduce. */
export async function prepareImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const { w, h } = await loadImage(url);
    const okType = /^image\/(jpeg|png|webp)$/.test(file.type);
    if (okType && w <= MAX_SIDE && h <= MAX_SIDE && file.size <= MAX_BYTES) {
      const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
      return { blob: file, w, h, ext };
    }
    const scale = Math.min(1, RESIZE_TO / Math.max(w, h));
    const cw = Math.round(w * scale);
    const ch = Math.round(h * scale);
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, cw, ch);
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.9));
    if (!blob) throw new Error('Immagine troppo grande per questo browser');
    return { blob, w: cw, h: ch, ext: 'jpg' };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Da dove arriva la mappa:
 *  github → map.json + immagine sul branch dati (caricata dal sito)
 *  public → idem, letta senza token
 *  local  → IndexedDB del browser
 *  in tutti i casi, se non c'è niente, prova public/<config.map.image>
 */
export function useMapSource(session, repo, mode, config) {
  const [map, setMap] = useState({ status: 'loading' });
  const [uploading, setUploading] = useState(false);
  const objectUrl = useRef(null);

  const setBlobUrl = (blob) => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = URL.createObjectURL(blob);
    return objectUrl.current;
  };

  const bundled = useCallback(async () => {
    const url = `${base}${config.map?.image || 'map.jpg'}`;
    try {
      const { w, h } = await loadImage(url);
      return { status: 'ready', url, w, h, source: 'bundled' };
    } catch {
      return { status: 'empty' };
    }
  }, [config]);

  const load = useCallback(async () => {
    try {
      if (mode === 'local') {
        const rec = await idbGet('map');
        if (rec?.blob) return setMap({ status: 'ready', url: setBlobUrl(rec.blob), w: rec.w, h: rec.h, source: 'local' });
        return setMap(await bundled());
      }
      const meta = mode === 'github' ? await readJsonFile(repo, session.token, 'map.json') : await readJsonPublic(repo, 'map.json');
      if (!meta?.file) return setMap(await bundled());
      const url = mode === 'github' ? setBlobUrl(await fetchRawFile(repo, session.token, meta.file)) : rawUrl(repo, meta.file);
      setMap({ status: 'ready', url, w: meta.w, h: meta.h, source: 'repo', meta });
    } catch (e) {
      setMap({ status: 'error', message: describeError(e) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, repo, session?.token, bundled]);

  useEffect(() => {
    load();
    return () => objectUrl.current && URL.revokeObjectURL(objectUrl.current);
  }, [load]);

  const upload = useCallback(
    async (file) => {
      setUploading(true);
      try {
        const img = await prepareImage(file);
        if (mode === 'local') {
          await idbSet('map', { blob: img.blob, w: img.w, h: img.h, name: file.name });
          setMap({ status: 'ready', url: setBlobUrl(img.blob), w: img.w, h: img.h, source: 'local' });
        } else if (mode === 'github') {
          const meta = await uploadMap(repo, session.token, img, session.username);
          setMap({ status: 'ready', url: setBlobUrl(img.blob), w: img.w, h: img.h, source: 'repo', meta });
        }
        return { ok: true, w: img.w, h: img.h };
      } catch (e) {
        return { ok: false, message: describeError(e) };
      } finally {
        setUploading(false);
      }
    },
    [mode, repo, session?.token, session?.username]
  );

  return { map, upload, uploading, reload: load };
}
