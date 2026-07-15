import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

import { pool } from './db.js';
import { uploadRoot } from './middleware/upload.js';
import authRouter from './routes/auth.js';
import clientRouter from './routes/client/chantiers.js';
import adminRouter from './routes/admin/index.js';

const app = express();

// ── Dossier uploads + protection exécution de scripts ─────────
if (!fs.existsSync(uploadRoot)) fs.mkdirSync(uploadRoot, { recursive: true });
// Défense en profondeur : si Apache sert ce dossier en statique, interdire
// l'exécution de tout script (un fichier uploadé ne doit jamais s'exécuter).
try {
  const htaccess = path.join(uploadRoot, '.htaccess');
  if (!fs.existsSync(htaccess)) {
    fs.writeFileSync(htaccess,
      'Options -ExecCGI -Indexes\n' +
      'RemoveHandler .php .phtml .php3 .php4 .php5 .php7 .pl .py .cgi .sh .asp .aspx .jsp\n' +
      '<FilesMatch "\\.(php[0-9]?|phtml|pl|py|cgi|sh|asp|aspx|jsp)$">\n' +
      '  Require all denied\n' +
      '</FilesMatch>\n');
  }
} catch (e) { console.error('[uploads] .htaccess:', e.message); }

// ── Derrière le proxy o2switch (Passenger) ───────────────────
app.set('trust proxy', 1);
app.disable('x-powered-by');

// ── Sécurité (helmet) ─────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));

// ── CORS : whitelist stricte ──────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin(origin, cb) {
    // Requêtes sans Origin (curl, health checks, même origine) : autorisées.
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return cb(null, true);
    // Origine non autorisée : pas d'en-tête ACAO → le navigateur bloque (pas d'erreur 500).
    return cb(null, false);
  },
}));

// ── Corps de requête borné ────────────────────────────────────
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// ── Fichiers uploadés (photos, documents) ────────────────────
app.use('/uploads', express.static(uploadRoot, { dotfiles: 'deny', index: false }));

// ── Health check ──────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', ts: new Date().toISOString() });
  } catch (err) {
    console.error('[health]', err.message);
    res.status(503).json({ status: 'error' });
  }
});

// ── Rate limiting ─────────────────────────────────────────────
const rlOpts = { standardHeaders: true, legacyHeaders: false, keyGenerator: (req) => req.ip };

// Limiteur global généreux (anti-abus / DoS applicatif léger).
app.use('/api', rateLimit({ ...rlOpts, windowMs: 15 * 60 * 1000, max: 600 }));

// Auth : strict, ne compte que les échecs.
const authLimiter = rateLimit({
  ...rlOpts, windowMs: 15 * 60 * 1000, max: 10, skipSuccessfulRequests: true,
  message: { error: 'Trop de tentatives, réessayez dans 15 minutes.' },
});

// Contact : envoi d'e-mails → limite serrée contre le spam.
const contactLimiter = rateLimit({
  ...rlOpts, windowMs: 60 * 60 * 1000, max: 5,
  message: { error: 'Trop de messages envoyés, réessayez plus tard.' },
});

// ── Routes ────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/client/contact', contactLimiter);
app.use('/api/client', clientRouter);
app.use('/api/admin', adminRouter);

// ── 404 ───────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// ── Gestionnaire d'erreurs ────────────────────────────────────
app.use((err, _req, res, _next) => {
  // Erreurs d'upload (multer) → 400 lisible.
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: 'Fichier invalide ou trop volumineux.' });
  }
  const status = err.status || err.statusCode || 500;
  if (status >= 500) {
    // On logue le détail côté serveur, mais on ne le renvoie jamais au client.
    console.error(err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
  // 4xx : message applicatif (volontairement destiné à l'utilisateur).
  res.status(status).json({ error: err.message || 'Requête invalide.' });
});

export default app;
