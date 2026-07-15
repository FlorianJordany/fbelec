import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_ROOT = process.env.UPLOAD_ROOT
  ? path.resolve(process.env.UPLOAD_ROOT)
  : path.join(__dirname, '..', '..', 'uploads');
const MAX_MB = parseInt(process.env.MAX_FILE_SIZE_MB || '20');

// Types MIME autorisés + extensions correspondantes (liste blanche stricte).
const IMAGE_MIME = ['image/jpeg','image/png','image/webp','image/heic','image/heif','image/gif'];
const IMAGE_EXT  = ['.jpg','.jpeg','.png','.webp','.heic','.heif','.gif'];
const DOC_MIME   = ['application/pdf','application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
const DOC_EXT    = ['.pdf','.doc','.docx','.xls','.xlsx'];

// Refus avec un statut 400 propre (au lieu d'un 500 masqué).
function reject(msg) {
  const e = new Error(msg);
  e.status = 400;
  return e;
}

// Valide req.params.id : doit être un entier strictement positif (anti path-traversal).
function safeChantierId(req) {
  const id = Number.parseInt(req.params.id, 10);
  return Number.isInteger(id) && id > 0 && String(id) === String(req.params.id) ? id : null;
}

function makeStorage(subdir, allowedExt) {
  return multer.diskStorage({
    destination(req, file, cb) {
      const id = safeChantierId(req);
      if (id === null) return cb(reject('Identifiant de chantier invalide.'));
      // schema vient du JWT ; on n'accepte qu'une valeur connue (anti path-traversal).
      const schema = /^[a-z0-9_]+$/.test(req.schema || '') ? req.schema : 'fbelec';
      const dir = path.join(UPLOAD_ROOT, schema, 'chantiers', String(id), subdir);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename(_req, file, cb) {
      // Extension forcée depuis la liste blanche, jamais directement le nom d'origine.
      let ext = path.extname(file.originalname).toLowerCase();
      if (!allowedExt.includes(ext)) ext = '.bin';
      cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
    },
  });
}

// Le fichier doit avoir un mimetype ET une extension dans la liste blanche.
function makeFilter(mimes, exts) {
  return (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (mimes.includes(file.mimetype) && exts.includes(ext)) return cb(null, true);
    cb(reject('Type de fichier non autorisé.'));
  };
}

export const uploadPhotos = multer({
  storage: makeStorage('photos', IMAGE_EXT),
  fileFilter: makeFilter(IMAGE_MIME, IMAGE_EXT),
  limits: { fileSize: MAX_MB * 1024 * 1024, files: 10 },
});

export const uploadDoc = multer({
  storage: makeStorage('documents', [...IMAGE_EXT, ...DOC_EXT]),
  fileFilter: makeFilter([...IMAGE_MIME, ...DOC_MIME], [...IMAGE_EXT, ...DOC_EXT]),
  limits: { fileSize: MAX_MB * 1024 * 1024, files: 1 },
});

// Construit une URL publique absolue vers le fichier (frontend sur un autre domaine).
export function toPublicUrl(filePath) {
  if (!filePath) return null;
  const rel = path.relative(path.resolve(UPLOAD_ROOT), path.resolve(filePath));
  // Sécurité : ne jamais produire d'URL qui sort du dossier uploads.
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  const base = (process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
  return `${base}/uploads/${rel.replace(/\\/g, '/')}`;
}

// Dossier racine des uploads (réutilisé par le serveur pour la protection .htaccess).
export const uploadRoot = UPLOAD_ROOT;
