// Services publics communs aux deux cartes de localisation (Google et IGN/Leaflet).
// Schémas https explicites assumés (services tiers fixes, jamais en mixed-content).
const BAN_URL = 'https://api-adresse.data.gouv.fr/search/';
const GEO_URL = 'https://geo.api.gouv.fr/communes';

// Commune qui CONTIENT le point. Code postal : celui saisi s'il appartient à la commune, sinon
// l'unique code de la commune ; vide si la commune en a plusieurs (l'utilisateur le précise).
// null si le service ne répond pas (la commune reste saisissable à la main).
export async function communeDuPoint(p, codePostalSaisi) {
  try {
    const r = await fetch(`${GEO_URL}?lat=${p.lat}&lon=${p.lng}&fields=nom,codesPostaux&format=json`);
    const c = (await r.json())?.[0];
    if (!c) return null;
    const cps = c.codesPostaux || [];
    const saisi = (codePostalSaisi || '').trim();
    return { commune: c.nom, code_postal: cps.includes(saisi) ? saisi : (cps.length === 1 ? cps[0] : '') };
  } catch { return null; }
}

// Centre de la commune saisie ({ lat, lng }), ou null (centrage indicatif).
export async function centreCommune(commune, codePostal) {
  try {
    const cp = /^\d{5}$/.test(codePostal || '') ? `&postcode=${codePostal}` : '';
    const r = await fetch(`${BAN_URL}?q=${encodeURIComponent(commune)}&type=municipality&limit=1${cp}`);
    const f = (await r.json())?.features?.[0];
    return f ? { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] } : null;
  } catch { return null; }
}
