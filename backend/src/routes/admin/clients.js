import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs';
import { pool } from '../../db.js';
import { str, email as vEmail } from '../../utils/validate.js';
import { sendWelcomeClient, sendCodeReset, sendEmailModifie } from '../../services/mailer.js';

const router = Router();

function genPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from(crypto.randomBytes(12))
    .map(b => chars[b % chars.length])
    .join('');
}

// GET /api/admin/clients
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.id, c.nom, c.email, c.pdl, c.telephone, c.actif, c.created_at,
              c.societe_id, c.role_societe, s.nom AS societe_nom,
              (SELECT COUNT(*) FROM fbelec.chantiers WHERE client_id = c.id AND actif = TRUE) AS nb_chantiers
       FROM fbelec.clients c
       LEFT JOIN fbelec.societes s ON s.id = c.societe_id
       ORDER BY c.nom`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/admin/clients — crée un client, génère son code, envoie l'email
router.post('/', async (req, res, next) => {
  try {
    const nom = str(req.body.nom, { required: true, max: 200, label: 'Nom' });
    const email = vEmail(req.body.email);
    const pdl = str(req.body.pdl, { max: 20, label: 'PDL' });
    const telephone = str(req.body.telephone, { max: 40, label: 'Téléphone' });
    // Société (facultative) + rôle : validés côté backend, jamais de confiance au front.
    const societeId = Number.isInteger(parseInt(req.body.societe_id)) ? parseInt(req.body.societe_id) : null;
    const roleSociete = ['basic', 'admin'].includes(req.body.role_societe) ? req.body.role_societe : 'basic';

    const code = genPassword();
    const hash = await bcrypt.hash(code, 12);

    const { rows: [client] } = await pool.query(
      `INSERT INTO fbelec.clients (nom, email, code_suivi_hash, pdl, telephone, must_change_code, societe_id, role_societe)
       VALUES ($1, $2, $3, $4, $5, TRUE, $6, $7)
       RETURNING id, nom, email, pdl, telephone, societe_id, role_societe, created_at`,
      [nom, email, hash, pdl, telephone, societeId, roleSociete]
    );

    // Envoi email en arrière-plan (non bloquant)
    sendWelcomeClient({ nom: client.nom, email: client.email, code }).catch(e =>
      console.error('[mailer] Erreur envoi welcome:', e.message)
    );

    res.status(201).json({ ...client, code_suivi: code });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email déjà utilisé.' });
    next(err);
  }
});

// PUT /api/admin/clients/:id
router.put('/:id', async (req, res, next) => {
  try {
    const { nom, pdl, telephone, actif } = req.body;
    // En minuscules comme à la création : la connexion cherche l'e-mail en minuscules.
    const email = req.body.email !== undefined ? vEmail(req.body.email) : null;
    // societe_id peut être remis à NULL (retrait de la société) → traité hors COALESCE.
    const hasSociete = req.body.societe_id !== undefined;
    const societeId = hasSociete && req.body.societe_id !== null && req.body.societe_id !== ''
      ? parseInt(req.body.societe_id) : null;
    const roleSociete = ['basic', 'admin'].includes(req.body.role_societe) ? req.body.role_societe : null;

    const { rows: [avant] } = await pool.query('SELECT email, must_change_code FROM fbelec.clients WHERE id = $1', [req.params.id]);
    if (!avant) return res.status(404).json({ error: 'Client introuvable.' });
    // E-mail remplacé : le mot de passe temporaire envoyé à l'ancienne adresse ne vaut plus, et
    // cette ancienne adresse est prévenue.
    const emailChange = email !== null && email !== avant.email;
    // Mot de passe provisoire pas encore remplacé : il est parti à l'ancienne adresse (souvent une
    // faute de frappe, donc la boîte d'un tiers). Il cesse de valoir et un nouveau part à la bonne.
    const nouveauCode = emailChange && avant.must_change_code ? genPassword() : null;
    const nouveauHash = nouveauCode ? await bcrypt.hash(nouveauCode, 12) : null;

    const { rows: [client] } = await pool.query(
      `UPDATE fbelec.clients
       SET nom          = COALESCE($1, nom),
           email        = COALESCE($2, email),
           pdl          = COALESCE($3, pdl),
           telephone    = COALESCE($4, telephone),
           actif        = COALESCE($5, actif),
           societe_id   = CASE WHEN $6 THEN $7::integer ELSE societe_id END,
           role_societe = COALESCE($8, role_societe),
           code_provisoire_hash   = CASE WHEN $10 THEN NULL ELSE code_provisoire_hash END,
           code_provisoire_expire = CASE WHEN $10 THEN NULL ELSE code_provisoire_expire END,
           code_suivi_hash = COALESCE($11::text, code_suivi_hash),
           mdp_version  = CASE WHEN $11::text IS NULL THEN mdp_version ELSE mdp_version + 1 END
       WHERE id = $9 RETURNING id, nom, email, pdl, telephone, actif, societe_id, role_societe`,
      [nom, email, pdl, telephone, actif, hasSociete, societeId, roleSociete, req.params.id, emailChange, nouveauHash]
    );
    if (!client) return res.status(404).json({ error: 'Client introuvable.' });
    if (emailChange) {
      sendEmailModifie({ ancienEmail: avant.email }).catch(e =>
        console.error('[mailer] e-mail modifié:', e.message)
      );
    }
    if (nouveauCode) {
      sendCodeReset({ nom: client.nom, email: client.email, code: nouveauCode }).catch(e =>
        console.error('[mailer] Erreur envoi reset:', e.message)
      );
    }
    res.json(nouveauCode ? { ...client, code_renvoye: true } : client);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email déjà utilisé.' });
    next(err);
  }
});

// POST /api/admin/clients/:id/reset-code — régénère le code + renvoi email
router.post('/:id/reset-code', async (req, res, next) => {
  try {
    const code = genPassword();
    const { rows: [client] } = await pool.query(
      `UPDATE fbelec.clients
       SET code_suivi_hash = $1, must_change_code = TRUE, mdp_version = mdp_version + 1,
           code_provisoire_hash = NULL, code_provisoire_expire = NULL
       WHERE id = $2
       RETURNING nom, email`,
      [await bcrypt.hash(code, 12), req.params.id]
    );
    if (!client) return res.status(404).json({ error: 'Client introuvable.' });

    sendCodeReset({ nom: client.nom, email: client.email, code }).catch(e =>
      console.error('[mailer] Erreur envoi reset:', e.message)
    );

    res.json({ code_suivi: code });
  } catch (err) { next(err); }
});

// DELETE /api/admin/clients/:id — suppression client + toutes ses données
router.delete('/:id', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Récupérer tous les fichiers liés aux chantiers du client
    const { rows: photos }    = await client.query(
      'SELECT url FROM fbelec.photos WHERE chantier_id IN (SELECT id FROM fbelec.chantiers WHERE client_id=$1)', [req.params.id]
    );
    const { rows: documents } = await client.query(
      'SELECT url FROM fbelec.documents WHERE chantier_id IN (SELECT id FROM fbelec.chantiers WHERE client_id=$1)', [req.params.id]
    );

    await client.query('DELETE FROM fbelec.photos          WHERE chantier_id IN (SELECT id FROM fbelec.chantiers WHERE client_id=$1)', [req.params.id]);
    await client.query('DELETE FROM fbelec.documents       WHERE chantier_id IN (SELECT id FROM fbelec.chantiers WHERE client_id=$1)', [req.params.id]);
    await client.query('DELETE FROM fbelec.notes           WHERE chantier_id IN (SELECT id FROM fbelec.chantiers WHERE client_id=$1)', [req.params.id]);
    await client.query('DELETE FROM fbelec.chantier_etapes WHERE chantier_id IN (SELECT id FROM fbelec.chantiers WHERE client_id=$1)', [req.params.id]);
    await client.query('DELETE FROM fbelec.chantiers WHERE client_id=$1', [req.params.id]);
    const { rowCount } = await client.query('DELETE FROM fbelec.clients WHERE id=$1', [req.params.id]);
    if (!rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Client introuvable.' }); }

    await client.query('COMMIT');

    for (const { url } of [...photos, ...documents]) {
      if (url && fs.existsSync(url)) { try { fs.unlinkSync(url); } catch {} }
    }

    res.json({ ok: true });
  } catch (err) { await client.query('ROLLBACK'); next(err); }
  finally { client.release(); }
});

export default router;
