import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { sessionPerimee } from './session.js';

export default async function authAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token manquant.' });
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return res.status(401).json({ error: 'Token invalide ou expiré.' });
  }
  if (payload.role !== 'admin') return res.status(403).json({ error: 'Accès refusé.' });
  // Compte désactivé ou mot de passe changé depuis l'ouverture de la session : accès coupé
  // dès la requête suivante, sans attendre l'expiration du jeton.
  try {
    const { rows: [a] } = await pool.query(
      'SELECT actif, mdp_version FROM fbelec.admins WHERE id = $1', [payload.sub]
    );
    if (!a?.actif) return res.status(401).json({ error: 'Compte désactivé.' });
    if (sessionPerimee(payload, a.mdp_version)) return res.status(401).json({ error: 'Session expirée.' });
  } catch (err) { return next(err); }
  req.adminId = payload.sub;
  req.schema  = payload.schema || 'fbelec';
  req.role    = payload.role;
  next();
}
