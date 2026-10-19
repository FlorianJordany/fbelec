import jwt from 'jsonwebtoken';
import { pool } from '../db.js';

export default async function authClient(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token manquant.' });
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return res.status(401).json({ error: 'Token invalide ou expiré.' });
  }
  if (payload.role !== 'client') return res.status(403).json({ error: 'Accès refusé.' });
  // Un compte désactivé perd l'accès dès sa requête suivante, sans attendre l'expiration du jeton.
  try {
    const { rows: [c] } = await pool.query('SELECT actif FROM fbelec.clients WHERE id = $1', [payload.sub]);
    if (!c?.actif) return res.status(401).json({ error: 'Compte désactivé.' });
  } catch (err) { return next(err); }
  req.clientId = payload.sub;
  req.schema   = payload.schema || 'fbelec';
  next();
}
