// ── Base API ──────────────────────────────────────────────────
// L'URL de l'API est injectée au build par Vite (VITE_API_URL).
export const API_BASE = import.meta.env.VITE_API_URL || '';

export function apiFetch(path, opts = {}) {
  const token = localStorage.getItem('fb_token');
  return fetch(API_BASE + path, {
    ...opts,
    headers: {
      ...(opts.body && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { 'Authorization': 'Bearer ' + token } : {}),
      ...opts.headers,
    },
    body: opts.body instanceof FormData ? opts.body
          : opts.body ? JSON.stringify(opts.body) : undefined,
  }).then(async r => {
    if (r.status === 401) { localStorage.removeItem('fb_token'); window.location.reload(); }
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Erreur serveur');
    return data;
  });
}

// ── Téléchargement d'un fichier (photos) ─────────────────────
// L'API est sur un autre sous-domaine : l'attribut download d'un <a> est ignoré
// en cross-origin → on passe par fetch + blob. Repli : ouverture dans un onglet.
export async function downloadFile(url, filename) {
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error('download failed');
    const blob = await r.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename || decodeURIComponent(url.split('/').pop().split('?')[0]) || 'photo';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

// ── Génération + téléchargement d'un PDF via l'API (authentifié) ─
export async function downloadPdf(path, body, filename) {
  const token = localStorage.getItem('fb_token');
  const r = await fetch(API_BASE + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': 'Bearer ' + token } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    let msg = 'Erreur serveur';
    try { msg = (await r.json()).error || msg; } catch {}
    throw new Error(msg);
  }
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'document.pdf';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ── Constantes de statut (UI uniquement, pas de logique métier) ──
export const STATUS_META = {
  prepa:       { label:"Dossier en préparation",    kind:"neutral" },
  attente:     { label:"En attente Enedis",         kind:"wait" },
  etude:       { label:"Étude en cours",            kind:"wait" },
  planifie:    { label:"Intervention planifiée",    kind:"progress" },
  service:     { label:"Mise en service réalisée",  kind:"done" },
  alimente:    { label:"Chantier alimenté",         kind:"done" },
  resiliation: { label:"En attente de résiliation", kind:"wait" },
  depose:      { label:"Dépose planifiée",          kind:"progress" },
  cloture:     { label:"Chantier clôturé",          kind:"muted" },
  action:      { label:"Action client requise",     kind:"action" },
  bloque:      { label:"Point bloquant",            kind:"blocked" },
};

// Badge affiché au client, dérivé des étapes (l'étape « En cours » prime).
// Couleur gérée ici car les étapes sont dynamiques (pas de mapping figé par statut).
// - détail : passe l'objet avec `etapes` (tableau d'étapes).
// - listes : passe l'objet avec `etape_courante` / `a_bloquee` / `etapes_done` / `etapes_total`.
export function chantierBadge(c = {}) {
  const etapes = Array.isArray(c.etapes) ? c.etapes : null;
  if (etapes && etapes.length) {
    const cur = etapes.find(e => e.etat === 'current');
    if (cur) return { label: cur.label, kind: 'progress' };
    const blk = etapes.find(e => e.etat === 'blocked');
    if (blk) return { label: blk.label, kind: 'blocked' };
    const active = etapes.filter(e => e.etat !== 'na');
    const done = active.filter(e => e.etat === 'done');
    if (active.length && done.length === active.length) return { label: 'Terminé', kind: 'done' };
    if (done.length) return { label: done[done.length - 1].label, kind: 'done' };
    return { label: 'En préparation', kind: 'neutral' };
  }
  if (c.etape_courante) return { label: c.etape_courante, kind: 'progress' };
  if (c.a_bloquee) return { label: 'Point bloquant', kind: 'blocked' };
  const total = parseInt(c.etapes_total) || 0, doneN = parseInt(c.etapes_done) || 0;
  if (total > 0 && doneN >= total) return { label: 'Terminé', kind: 'done' };
  return { label: 'En préparation', kind: 'neutral' };
}

export const CAT_LABELS = {
  permis_construire: 'Permis de construire',
  plan_situation:    'Plan de situation',
  plan_masse:        'Plan de masse',
  mandat:            'Mandat',
};
export const CAT_REQUIRED = ['permis_construire','plan_situation'];

// Libellé d'adresse d'un chantier localisé par point GPS (identique au backend, utils/validate.js).
export const libelleGps = p => `Point GPS ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;

export const DOC_OPTIONS = [
  ...Object.entries(CAT_LABELS).map(([k,v])=>({value:k,label:v})),
  {value:'autre',label:'Autre'},
];
