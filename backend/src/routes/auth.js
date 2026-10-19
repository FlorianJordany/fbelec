import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { sendCodeReset } from '../services/mailer.js';

function genPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#';
  return Array.from(crypto.randomBytes(12)).map(b => chars[b % chars.length]).join('');
}

const router = Router();

function makeToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

// POST /api/auth/client/login
router.post('/client/login', async (req, res, next) => {
  try {
    const { email, pdl, code_suivi } = req.body;
    if (!code_suivi) return res.status(400).json({ error: 'Code de suivi requis.' });

    let client;
    if (email) {
      const r = await pool.query(
        'SELECT * FROM fbelec.clients WHERE email = $1 AND actif = TRUE',
        [email.toLowerCase().trim()]
      );
      client = r.rows[0];
    } else if (pdl) {
      const r = await pool.query(
        'SELECT * FROM fbelec.clients WHERE pdl = $1 AND actif = TRUE', [pdl.trim()]
      );
      client = r.rows[0];
    }

    if (!client) return res.status(401).json({ error: 'Identifiants incorrects.' });

    const ok = await bcrypt.compare(code_suivi.trim(), client.code_suivi_hash);
    if (!ok) return res.status(401).json({ error: 'Identifiants incorrects.' });

    const token = makeToken({ sub: client.id, role: 'client', schema: 'fbelec' });
    res.json({
      token,
      must_change_code: client.must_change_code || false,
      client: { id: client.id, nom: client.nom, email: client.email },
    });
  } catch (err) { next(err); }
});

// POST /api/auth/client/change-code — premier login : choisir son propre code
router.post('/client/change-code', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Token requis.' });
    const token = authHeader.replace('Bearer ', '');
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (payload.role !== 'client') return res.status(403).json({ error: 'Accès refusé.' });

    const { new_code } = req.body;
    if (!new_code || new_code.trim().length < 6)
      return res.status(400).json({ error: 'Le code doit faire au moins 6 caractères.' });

    const hash = await bcrypt.hash(new_code.trim(), 12);
    await pool.query(
      'UPDATE fbelec.clients SET code_suivi_hash = $1, must_change_code = FALSE WHERE id = $2',
      [hash, payload.sub]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// POST /api/auth/forgot-password — génère un mot de passe temporaire et l'envoie par mail
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'E-mail requis.' });

    const { rows: [client] } = await pool.query(
      'SELECT id, nom, email FROM fbelec.clients WHERE email = $1 AND actif = TRUE',
      [email.toLowerCase().trim()]
    );

    // Toujours répondre 200 pour ne pas révéler si l'email existe
    if (!client) return res.json({ ok: true });

    const code = genPassword();
    const hash = await bcrypt.hash(code, 12);
    await pool.query(
      'UPDATE fbelec.clients SET code_suivi_hash = $1, must_change_code = TRUE WHERE id = $2',
      [hash, client.id]
    );

    sendCodeReset({ nom: client.nom, email: client.email, code }).catch(e =>
      console.error('[mailer] forgot-password:', e.message)
    );

    res.json({ ok: true });
  } catch (err) { next(err); }
});

// POST /api/auth/admin/login
router.post('/admin/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis.' });

    const { rows: [admin] } = await pool.query(
      'SELECT * FROM fbelec.admins WHERE email = $1 AND actif = TRUE',
      [email.toLowerCase().trim()]
    );
    if (!admin) return res.status(401).json({ error: 'Identifiants incorrects.' });

    // trim : les claviers mobiles ajoutent souvent un espace final (autocomplétion)
    const ok = await bcrypt.compare(String(password).trim(), admin.password_hash);
    if (!ok) return res.status(401).json({ error: 'Identifiants incorrects.' });

    const token = makeToken({ sub: admin.id, role: 'admin', schema: 'fbelec' });
    res.json({ token, admin: { id: admin.id, nom: admin.nom, email: admin.email, role: 'admin' } });
  } catch (err) { next(err); }
});

export default router;
