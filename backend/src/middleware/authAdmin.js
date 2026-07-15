import jwt from 'jsonwebtoken';

export default function authAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token manquant.' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (payload.role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé.' });
    }
    req.adminId = payload.sub;
    req.schema  = payload.schema || 'fbelec';
    req.role    = payload.role;
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide ou expiré.' });
  }
}
