import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { toPublicUrl, uploadRoot } from '../middleware/upload.js';

// Formats enregistrés sur le disque à côté de chaque photo (l'original est conservé tel quel) :
//   mini  : 128×128 recadré  → vignettes carrées de 40 à 64 px (écrans haute densité compris)
//   moyen : 800 px max       → cartes, grilles de photos, avant/après, bandeau
//   grand : 1600 px max      → affichage plein écran (visionneuse)
// Rangement : <dossier photos>/<format>/<nom de la photo>.jpg
// Les pages chargent directement le fichier du bon format : aucune réduction dans le navigateur.
export const FORMATS = {
  mini:  { width: 128,  height: 128,  fit: 'cover',  quality: 75 },
  moyen: { width: 800,  height: 800,  fit: 'inside', quality: 80 },
  grand: { width: 1600, height: 1600, fit: 'inside', quality: 82 },
};
const NOMS = Object.keys(FORMATS);
const enCours = new Map();     // une seule génération à la fois par photo
const illisibles = new Set();  // images que sharp ne sait pas lire (ex. HEIC) : pas de nouvel essai

export function cheminFormat(url, nom) {
  return path.join(path.dirname(url), nom, `${path.basename(url, path.extname(url))}.jpg`);
}

// Crée les formats manquants d'une photo. Ne lève jamais d'erreur : en cas d'échec,
// les pages retombent sur l'original.
export async function genererFormats(url) {
  if (!url || illisibles.has(url) || !fs.existsSync(url)) return;
  const manquants = NOMS.filter(n => !fs.existsSync(cheminFormat(url, n)));
  if (!manquants.length) return;
  if (!enCours.has(url)) {
    enCours.set(url, (async () => {
      const tmps = [];
      try {
        const base = sharp(url).rotate(); // respecte l'orientation EXIF
        await Promise.all(manquants.map(async n => {
          const f = FORMATS[n], cible = cheminFormat(url, n), tmp = `${cible}.${process.pid}.tmp`;
          tmps.push(tmp);
          fs.mkdirSync(path.dirname(cible), { recursive: true });
          await base.clone()
            .resize(f.width, f.height, { fit: f.fit, withoutEnlargement: f.fit === 'inside' })
            .jpeg({ quality: f.quality, progressive: true, mozjpeg: true })
            .toFile(tmp);
          fs.renameSync(tmp, cible);
        }));
      } catch (e) {
        tmps.forEach(t => { try { fs.unlinkSync(t); } catch { /* déjà renommé ou absent */ } });
        illisibles.add(url);
        console.error('[formats] échec :', e.message);
      } finally { enCours.delete(url); }
    })());
  }
  return enCours.get(url);
}

// URLs publiques de chaque format ; l'original sert de repli si un format manque.
export function urlsFormats(url) {
  const original = toPublicUrl(url);
  const res = { url: original };
  for (const n of NOMS) {
    const f = url && cheminFormat(url, n);
    res[`url_${n}`] = (f && fs.existsSync(f) && toPublicUrl(f)) || original;
  }
  return res;
}

// Photo renvoyée par l'API : url (original) + url_mini / url_moyen / url_grand.
export const avecFormats = p => ({ ...p, ...urlsFormats(p.url) });

// Photo de couverture des listes : original + formats utiles aux cartes et vignettes.
export function couverture(url) {
  const f = urlsFormats(url);
  return { photo_couverture: f.url, photo_couverture_mini: f.url_mini, photo_couverture_moyen: f.url_moyen };
}

export function supprimerFormats(url) {
  if (!url) return;
  for (const n of NOMS) { try { fs.unlinkSync(cheminFormat(url, n)); } catch { /* absent */ } }
}

// Au démarrage : crée en arrière-plan les formats manquants des photos déjà en ligne,
// une photo à la fois pour ménager l'hébergement mutualisé.
export async function rattraperFormats() {
  const photos = [];
  const lister = d => { try { return fs.readdirSync(d, { withFileTypes: true }); } catch { return []; } };
  for (const schema of lister(uploadRoot).filter(e => e.isDirectory())) {
    const dirChantiers = path.join(uploadRoot, schema.name, 'chantiers');
    for (const ch of lister(dirChantiers).filter(e => e.isDirectory())) {
      const dir = path.join(dirChantiers, ch.name, 'photos');
      for (const f of lister(dir)) {
        if (f.isFile() && /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(f.name)) photos.push(path.join(dir, f.name));
      }
    }
  }
  const aFaire = photos.filter(u => NOMS.some(n => !fs.existsSync(cheminFormat(u, n))));
  if (!aFaire.length) return;
  console.log(`[formats] ${aFaire.length} photo(s) à préparer…`);
  for (const u of aFaire) await genererFormats(u);
  console.log('[formats] rattrapage terminé.');
}
