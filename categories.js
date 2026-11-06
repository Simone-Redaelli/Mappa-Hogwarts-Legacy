// Categorie dei marker: modifica liberamente etichette, colori e icone.
// style: 'badge' = tondo scuro con simbolo bianco e anello colorato
//        'coin'  = moneta dorata (per i collezionabili)
export const CATEGORIES = [
  { id: 'nota', label: 'Nota', color: '#d8b45a', icon: 'quill' },
  { id: 'collezionabile', label: 'Collezionabile', color: '#e9cf8f', icon: 'diamond', style: 'coin' },
  { id: 'luogo', label: 'Luogo di interesse', color: '#4fc3b0', icon: 'pin' },
  { id: 'missione', label: 'Missione', color: '#f2c94c', icon: 'star' },
  { id: 'floo', label: 'Fiamma Floo', color: '#3fa7ff', icon: 'flame' },
  { id: 'pagina', label: 'Pagina Guida da Campo', color: '#8fb8de', icon: 'page' },
  { id: 'merlino', label: 'Prova di Merlino', color: '#a98be0', icon: 'stones' },
  { id: 'baule', label: 'Baule', color: '#c98a3e', icon: 'chest' },
  { id: 'demiguise', label: 'Statua Demiguise', color: '#e8e4d8', icon: 'moon' },
  { id: 'astronomia', label: 'Tavola di Astronomia', color: '#6f7cff', icon: 'sparkle' },
  { id: 'cripta', label: 'Cripta / Dungeon', color: '#9aa3ad', icon: 'arch' },
  { id: 'nemici', label: 'Covo nemico', color: '#e0625c', icon: 'swords' },
  { id: 'bestie', label: 'Tana di Bestie', color: '#c9925f', icon: 'paw' },
  { id: 'raccolta', label: 'Ingredienti / Raccolta', color: '#6fd3ff', icon: 'leaf' },
  { id: 'negozio', label: 'Negozio', color: '#f0a35e', icon: 'house' },
  { id: 'panorama', label: 'Punto panoramico', color: '#7ee0a1', icon: 'eye' },
  { id: 'sfida', label: 'Sfida / Bersagli', color: '#ff8fb1', icon: 'target' },
];

export const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
export const getCat = (id) => CAT[id] || CATEGORIES[0];

// Colori per i confini delle regioni
export const REGION_COLORS = ['#3fd0d4', '#e0468f', '#f2c94c', '#3b6cff', '#ff8a3d', '#7ee0a1', '#a98be0', '#ffffff'];
