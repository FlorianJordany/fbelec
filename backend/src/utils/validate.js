// Petit validateur interne (sans dépendance) : bornes de longueur et format e-mail.
// Lève une erreur 400 propre, interceptée par le gestionnaire d'erreurs global.

function bad(msg) {
  const e = new Error(msg);
  e.status = 400;
  throw e;
}

// Chaîne nettoyée (trim). Options : { required, min, max, label }.
export function str(value, { required = false, min = 0, max = 2000, label = 'Champ' } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) bad(`${label} requis.`);
    return null;
  }
  if (typeof value !== 'string') bad(`${label} invalide.`);
  const v = value.trim();
  if (required && v.length < Math.max(1, min)) bad(`${label} requis.`);
  if (v.length < min) bad(`${label} trop court.`);
  if (v.length > max) bad(`${label} trop long (max ${max} caractères).`);
  return v;
}

// Point GPS facultatif : les deux coordonnées (nombres) ou aucune. Renvoie {lat,lng} ou null.
export function gps(lat, lng) {
  const vide = v => v === undefined || v === null || v === '';
  if (vide(lat) && vide(lng)) return null;
  if (typeof lat !== 'number' || typeof lng !== 'number'
      || !Number.isFinite(lat) || !Number.isFinite(lng)
      || lat < -90 || lat > 90 || lng < -180 || lng > 180) bad('Point GPS invalide.');
  return { lat, lng };
}

// Libellé stocké dans chantiers.adresse quand le chantier est localisé par point GPS.
export function libelleGps({ lat, lng }) {
  return `Point GPS ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

// E-mail : format basique + longueur bornée.
export function email(value, { required = true } = {}) {
  const v = str(value, { required, max: 254, label: 'E-mail' });
  if (v === null) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) bad('E-mail invalide.');
  return v.toLowerCase();
}
