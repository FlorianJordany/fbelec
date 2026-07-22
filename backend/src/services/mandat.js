import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { uploadRoot } from '../middleware/upload.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(__dirname, '..', '..', 'assets');

// Coordonnées calées sur backend/assets/mandat-vierge.pdf (A4, 595×842 pt).
// Page 1
const P1 = {
  mandant:   { x: 170, y: 708 },              // « Je soussigné(e) … »
  mandataire:{ x: 120, y: 686 },              // « autorise … »
  rgpdX: 80.5,                                 // colonne des cases RGPD (interligne 13)
  rgpdYs: [523, 510, 497, 484, 471, 458, 445, 432],
  sousX: 80.5,                                 // cases Souscription
  sousYs: [374, 360.5, 347],                   // [électricité, gaz, branchement]
  sousAdresse: { x: 95, y: 325 },
  resiX: 80.5,                                 // cases Résiliation
  resiYs: [288, 274.5, 261],
  resiAdresse: { x: 95, y: 224 },
};
// Page 2
const P2 = {
  faitA: { x: 92, y: 227 },
  le:    { x: 80, y: 215 },
  exemplaires: { x: 73, y: 204 },
  signature: { x: 118, y: 96, w: 150 },        // sous « Signature du mandant »
};

// Réduit la taille de police pour tenir dans maxW (jamais < 7pt).
function fitSize(font, text, maxW, size) {
  let s = size;
  while (s > 7 && font.widthOfTextAtSize(text, s) > maxW) s -= 0.5;
  return s;
}

export async function genererMandat({ reference, adresse, ville }) {
  const doc = await PDFDocument.load(fs.readFileSync(path.join(ASSETS, 'mandat-vierge.pdf')));
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const sig = await doc.embedPng(fs.readFileSync(path.join(ASSETS, 'signature-fbelec.png')));
  const [p1, p2] = doc.getPages();
  const ink = rgb(0.10, 0.10, 0.40);

  const T = (page, text, x, y, { size = 10, f = font, maxW = 0 } = {}) => {
    const t = String(text ?? '');
    if (!t) return;
    const s = maxW ? fitSize(f, t, maxW, size) : size;
    page.drawText(t, { x, y, size: s, font: f, color: ink });
  };
  const X = (page, x, y) => T(page, 'X', x, y, { size: 9, f: bold });

  // Page 1 — identités
  T(p1, reference, P1.mandant.x, P1.mandant.y, { maxW: 320 });
  T(p1, 'F.B ELEC', P1.mandataire.x, P1.mandataire.y, { maxW: 320 });
  // Droits RGPD : tout cocher
  for (const y of P1.rgpdYs) X(p1, P1.rgpdX, y);
  // Souscription : électricité + branchement provisoire (pas le gaz)
  X(p1, P1.sousX, P1.sousYs[0]);
  X(p1, P1.sousX, P1.sousYs[2]);
  T(p1, adresse, P1.sousAdresse.x, P1.sousAdresse.y, { size: 9, maxW: 460 });
  // Résiliation : électricité + branchement provisoire
  X(p1, P1.resiX, P1.resiYs[0]);
  X(p1, P1.resiX, P1.resiYs[2]);
  T(p1, adresse, P1.resiAdresse.x, P1.resiAdresse.y, { size: 9, maxW: 460 });

  // Page 2 — fait à / le / exemplaires / signature mandataire
  T(p2, ville, P2.faitA.x, P2.faitA.y, { maxW: 130 });
  T(p2, new Date().toLocaleDateString('fr-FR'), P2.le.x, P2.le.y);
  T(p2, '1', P2.exemplaires.x, P2.exemplaires.y, { f: bold });
  const sigH = P2.signature.w * (sig.height / sig.width);
  p2.drawImage(sig, { x: P2.signature.x, y: P2.signature.y, width: P2.signature.w, height: sigH });

  return Buffer.from(await doc.save());
}

// Génère le mandat et l'écrit dans le dossier uploads du chantier
// (même arborescence et nommage que les documents uploadés via multer).
// Renvoie le chemin disque à insérer dans fbelec.documents.url.
export async function genererMandatFichier({ chantierId, schema, reference, adresse, ville }) {
  const id = parseInt(chantierId, 10);
  if (!Number.isInteger(id) || id <= 0) throw new Error('chantierId invalide');
  const safeSchema = /^[a-z0-9_]+$/.test(schema || '') ? schema : 'fbelec';
  const pdf = await genererMandat({ reference, adresse, ville });
  const dir = path.join(uploadRoot, safeSchema, 'chantiers', String(id), 'documents');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.pdf`);
  fs.writeFileSync(file, pdf);
  return file;
}
