import { getCat } from '../lib/categories.js';
import { glyphSvg } from '../lib/icons.js';

/** Icona tonda della categoria, stessa grafica dei marker sulla mappa. */
export default function CatIcon({ id, size = 26, done = false }) {
  const c = getCat(id);
  const coin = c.style === 'coin';
  return (
    <span
      className={`badge${coin ? ' badge-coin' : ''}${done ? ' badge-done' : ''}`}
      style={{ '--c': c.color, width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: glyphSvg(done ? 'check' : c.icon, coin && !done ? '#4a3510' : '#fff') }}
    />
  );
}

export function badgeHtml(id, done) {
  const c = getCat(id);
  const coin = c.style === 'coin';
  return `<div class="pin badge${coin ? ' badge-coin' : ''}${done ? ' badge-done' : ''}" style="--c:${c.color}">${glyphSvg(
    done ? 'check' : c.icon,
    coin && !done ? '#4a3510' : '#fff'
  )}</div>`;
}
