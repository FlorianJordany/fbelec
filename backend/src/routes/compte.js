import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { makeToken } from './auth.js';
import { sendEmailModifie } from '../services/mailer.js';
import { str, email as vEmail, motDePasse } from '../utils/validate.js';

// Noms de tables et de colonnes : constantes du code, jamais de valeur utilisateur dans le SQL.
const RAZ_TEMPORAIRE = ', code_provisoire_hash = NULL, code_provisoire_expire = NULL';
// Un changement d'e-mail écrit à l'ancienne adresse : un client ne peut pas le répéter à volonté
// pour faire envoyer des mails par FB ELEC.
const MAX_EMAILS_JOUR = 3;
const DANS_24H = "email_modifs_depuis > now() - interval '24 hours'";
const COMPTE_EMAIL = `, email_modifs = CASE WHEN ${DANS_24H} THEN email_modifs + 1 ELSE 1 END, email_modifs_depuis = CASE WHEN ${DANS_24H} THEN email_modifs_depuis ELSE now() END`;
const PLAFOND_EMAIL = ` AND (email_modifs_depuis IS NULL OR NOT ${DANS_24H} OR email_modifs < ${MAX_EMAILS_JOUR})`;
const TYPES = {
  client: {
    table: 'fbelec.clients', autreTable: 'fbelec.admins', hash: 'code_suivi_hash', infos: 'nom, email, telephone',
    id: req => req.clientId, razEmail: RAZ_TEMPORAIRE + COMPTE_EMAIL, plafondEmail: PLAFOND_EMAIL,
    razProvisoire: `, must_change_code = FALSE${RAZ_TEMPORAIRE}`,
  },
  admin: {
    table: 'fbelec.admins', autreTable: 'fbelec.clients', hash: 'password_hash', infos: 'nom, email',
    id: req => req.adminId, razEmail: '', plafondEmail: '', razProvisoire: '',
  },
};

// trim : mêmes règles que la connexion et la création du mot de passe.
const motDePasseCorrect = (saisi, hash) =>
  typeof saisi === 'string' && saisi !== '' ? bcrypt.compare(saisi.trim(), hash) : false;

// « Mon compte » : le compte connecté (client ou FB ELEC) gère ses propres informations et son
// mot de passe. L'identifiant vient uniquement du jeton, jamais de la requête (anti-IDOR).
export default function compteRouter(role) {
  const t = TYPES[role];
  const router = Router();

  // GET / — informations du compte
  router.get('/', async (req, res, next) => {
    try {
      const { rows: [c] } = await pool.query(`SELECT ${t.infos} FROM ${t.table} WHERE id = $1`, [t.id(req)]);
      if (!c) return res.status(404).json({ error: 'Compte introuvable.' });
      res.json(c);
    } catch (err) { next(err); }
  });

  // PUT / — nom, e-mail, téléphone (champs absents conservés). L'e-mail sert à se connecter et à
  // réinitialiser le mot de passe : le changer exige le mot de passe actuel, annule un mot de passe
  // temporaire envoyé à l'ancienne adresse, et prévient cette ancienne adresse.
  router.put('/', async (req, res, next) => {
    try {
      const { rows: [c] } = await pool.query(
        `SELECT ${t.infos}, ${t.hash} AS hash FROM ${t.table} WHERE id = $1`, [t.id(req)]
      );
      if (!c) return res.status(404).json({ error: 'Compte introuvable.' });
      const body = req.body || {};
      const nom = body.nom !== undefined ? str(body.nom, { required: true, max: 200, label: 'Nom' }) : c.nom;
      const email = body.email !== undefined ? vEmail(body.email) : c.email;
      const emailChange = email !== c.email;
      if (emailChange) {
        if (!await motDePasseCorrect(body.mot_de_passe_actuel, c.hash)) {
          return res.status(403).json({ error: 'Mot de passe actuel incorrect.' });
        }
        // Le formulaire de connexion est commun aux clients et à FB ELEC ; UNIQUE ne couvre qu'une table.
        const { rows: [pris] } = await pool.query(`SELECT 1 FROM ${t.autreTable} WHERE email = $1`, [email]);
        if (pris) return res.status(409).json({ error: 'Cet e-mail est déjà utilisé.' });
      }
      const vals = [nom, email, t.id(req)];
      let setTelephone = '';
      if (role === 'client' && body.telephone !== undefined) {
        vals.push(str(body.telephone, { max: 40, label: 'Téléphone' }));
        setTelephone = ', telephone = $4';
      }
      const { rows: [maj] } = await pool.query(
        `UPDATE ${t.table} SET nom = $1, email = $2${setTelephone}${emailChange ? t.razEmail : ''}
          WHERE id = $3${emailChange ? t.plafondEmail : ''} RETURNING ${t.infos}`, vals
      );
      if (!maj) return res.status(429).json({ error: "Trop de changements d'adresse aujourd'hui : contactez FB ELEC." });
      if (emailChange) {
        sendEmailModifie({ ancienEmail: c.email }).catch(e =>
          console.error('[mailer] e-mail modifié:', e.message)
        );
      }
      res.json(maj);
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'Cet e-mail est déjà utilisé.' });
      next(err);
    }
  });

  // PUT /mot-de-passe — { actuel, nouveau }. Coupe les autres sessions (mdp_version) et renvoie
  // un nouveau jeton pour garder celle-ci.
  router.put('/mot-de-passe', async (req, res, next) => {
    try {
      const nouveau = motDePasse(req.body?.nouveau);
      const { rows: [c] } = await pool.query(
        `SELECT ${t.hash} AS hash FROM ${t.table} WHERE id = $1`, [t.id(req)]
      );
      if (!c) return res.status(404).json({ error: 'Compte introuvable.' });
      if (!await motDePasseCorrect(req.body?.actuel, c.hash)) {
        return res.status(403).json({ error: 'Mot de passe actuel incorrect.' });
      }
      const { rows: [maj] } = await pool.query(
        `UPDATE ${t.table} SET ${t.hash} = $1, mdp_version = mdp_version + 1${t.razProvisoire} WHERE id = $2 RETURNING mdp_version`,
        [await bcrypt.hash(nouveau, 12), t.id(req)]
      );
      res.json({ ok: true, token: makeToken({ sub: t.id(req), role, schema: 'fbelec', mv: maj.mdp_version }) });
    } catch (err) { next(err); }
  });

  return router;
}
