import jwt from 'jsonwebtoken';

export default function authClient(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token manquant.' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (payload.role !== 'client') return res.status(403).json({ error: 'Accès refusé.' });
    req.clientId = payload.sub;
    req.schema   = payload.schema || 'fbelec';
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide ou expiré.' });
  }
}
