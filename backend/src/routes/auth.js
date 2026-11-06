import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { sendMotDePasseOublie } from '../services/mailer.js';
import authClient from '../middleware/authClient.js';
import { motDePasse, email as vEmail } from '../utils/validate.js';

function genPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from(crypto.randomBytes(12)).map(b => chars[b % chars.length]).join('');
}

const router = Router();

const VALIDITE_TEMPORAIRE_HEURES = 24;
const DELAI_DEMANDES_MS = 5 * 60 * 1000;
const MAX_DEMANDES_JOUR = 6;
// Comparé quand il n'y a rien à vérifier : le délai de réponse ne révèle ni un compte ni une demande en cours.
const HASH_FACTICE = bcrypt.hashSync('compte-inexistant', 12);

export function makeToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

// Mot de passe temporaire (« mot de passe oublié ») : il ne remplace le mot de passe actuel qu'une
// fois utilisé. La personne a prouvé qu'elle lit la boîte mail : les sessions ouvertes sont coupées.
async function utiliserTemporaire(client, saisi) {
  const enCours = client.code_provisoire_hash && new Date(client.code_provisoire_expire) > new Date();
  const correct = await bcrypt.compare(saisi, enCours ? client.code_provisoire_hash : HASH_FACTICE);
  if (!enCours || !correct) return null;
  const { rows: [maj] } = await pool.query(
    `UPDATE fbelec.clients
        SET code_suivi_hash = code_provisoire_hash, must_change_code = TRUE, mdp_version = mdp_version + 1,
            code_provisoire_hash = NULL, code_provisoire_expire = NULL
      WHERE id = $1 AND code_provisoire_hash = $2 RETURNING mdp_version`,
    [client.id, client.code_provisoire_hash]
  );
  return maj || null;
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

    const saisi = String(code_suivi).trim();
    if (!client) {
      // Autant de comparaisons qu'un mauvais mot de passe sur un vrai compte (actuel, puis temporaire).
      await bcrypt.compare(saisi, HASH_FACTICE);
      await bcrypt.compare(saisi, HASH_FACTICE);
      return res.status(401).json({ error: 'Identifiants incorrects.' });
    }

    let provisoire = client.must_change_code;
    let version = client.mdp_version;
    if (!await bcrypt.compare(saisi, client.code_suivi_hash)) {
      const maj = await utiliserTemporaire(client, saisi);
      if (!maj) return res.status(401).json({ error: 'Identifiants incorrects.' });
      provisoire = true;
      version = maj.mdp_version;
    }

    // mv : version lue avec le hash, pour refuser ce jeton si le mot de passe change entre-temps.
    // provisoire : seule une session ouverte avec le mot de passe provisoire peut utiliser change-code.
    const token = makeToken({
      sub: client.id, role: 'client', schema: 'fbelec', mv: version,
      ...(provisoire ? { provisoire: true } : {}),
    });
    res.json({
      token,
      must_change_code: provisoire,
      client: { id: client.id, nom: client.nom, email: client.email },
    });
  } catch (err) { next(err); }
});

// POST /api/auth/client/change-code — mot de passe provisoire (première connexion, mot de passe
// oublié) : choisir le sien, sans redonner l'ancien. Réservé à une session ouverte avec ce mot de
// passe provisoire, sinon une session déjà ouverte contournerait « Mon compte ». Coupe les autres
// sessions et renvoie un nouveau jeton pour garder celle-ci.
router.post('/client/change-code', authClient, async (req, res, next) => {
  try {
    const refus = { error: 'Mot de passe déjà choisi : changez-le depuis « Mon compte ».' };
    if (!req.jetonProvisoire) return res.status(403).json(refus);
    const nouveau = motDePasse(req.body?.new_code);
    const { rows: [maj] } = await pool.query(
      `UPDATE fbelec.clients SET code_suivi_hash = $1, must_change_code = FALSE, mdp_version = mdp_version + 1,
              code_provisoire_hash = NULL, code_provisoire_expire = NULL
        WHERE id = $2 AND must_change_code = TRUE RETURNING mdp_version`,
      [await bcrypt.hash(nouveau, 12), req.clientId]
    );
    if (!maj) return res.status(403).json(refus);
    res.json({ ok: true, token: makeToken({ sub: req.clientId, role: 'client', schema: 'fbelec', mv: maj.mdp_version }) });
  } catch (err) { next(err); }
});

// POST /api/auth/forgot-password — génère un mot de passe temporaire et l'envoie par mail. Le mot
// de passe actuel n'est pas touché : la route est anonyme, un tiers ne doit pas pouvoir bloquer un compte.
router.post('/forgot-password', async (req, res, next) => {
  let adresse;
  try { adresse = vEmail(req.body?.email); } catch (err) { return next(err); }

  // Réponse immédiate et identique, hachage fait même sans compte : ni la réponse ni la charge du
  // serveur ne révèlent si le compte existe.
  res.json({ ok: true });

  try {
    const code = genPassword();
    const hash = await bcrypt.hash(code, 12);
    const { rows: [client] } = await pool.query(
      'SELECT id, nom, email FROM fbelec.clients WHERE email = $1 AND actif = TRUE', [adresse]
    );
    if (!client) return;

    const validite = VALIDITE_TEMPORAIRE_HEURES * 60 * 60 * 1000;
    // Par compte : une demande toutes les 5 minutes et 6 par 24 h. Cela borne les mails qu'un tiers
    // peut provoquer et les remplacements du code que la personne s'apprête à utiliser. Le test sur
    // l'e-mail écarte un changement d'adresse survenu depuis la lecture : le code partirait à l'ancienne.
    const { rows: [demande] } = await pool.query(
      `UPDATE fbelec.clients
          SET code_provisoire_hash = $1, code_provisoire_expire = $2,
              oubli_nb = CASE WHEN oubli_depuis > now() - interval '24 hours' THEN oubli_nb + 1 ELSE 1 END,
              oubli_depuis = CASE WHEN oubli_depuis > now() - interval '24 hours' THEN oubli_depuis ELSE now() END
        WHERE id = $3 AND email = $5
          AND (code_provisoire_expire IS NULL OR code_provisoire_expire <= $4)
          AND (oubli_depuis IS NULL OR oubli_depuis <= now() - interval '24 hours' OR oubli_nb < $6)
        RETURNING id`,
      [hash, new Date(Date.now() + validite), client.id, new Date(Date.now() + validite - DELAI_DEMANDES_MS), client.email, MAX_DEMANDES_JOUR]
    );
    if (!demande) return;
    try {
      await sendMotDePasseOublie({ nom: client.nom, email: client.email, code, heures: VALIDITE_TEMPORAIRE_HEURES });
    } catch (err) {
      // Mail non parti : ne pas garder un code que personne n'a reçu, ni bloquer la demande suivante.
      await pool.query(
        `UPDATE fbelec.clients SET code_provisoire_hash = NULL, code_provisoire_expire = NULL
          WHERE id = $1 AND code_provisoire_hash = $2`,
        [client.id, hash]
      );
      throw err;
    }
  } catch (err) { console.error('[auth] forgot-password:', err.message); }
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
    // trim : les claviers mobiles ajoutent souvent un espace final (autocomplétion)
    const ok = await bcrypt.compare(String(password).trim(), admin ? admin.password_hash : HASH_FACTICE);
    if (!admin) return res.status(401).json({ error: 'Identifiants incorrects.' });
    if (!ok) return res.status(401).json({ error: 'Identifiants incorrects.' });

    const token = makeToken({ sub: admin.id, role: 'admin', schema: 'fbelec', mv: admin.mdp_version });
    res.json({ token, admin: { id: admin.id, nom: admin.nom, email: admin.email, role: 'admin' } });
  } catch (err) { next(err); }
});

export default router;
