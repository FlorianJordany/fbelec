import { Router } from 'express';
import { pool } from '../../db.js';
import { str } from '../../utils/validate.js';

const router = Router();

// GET /api/admin/societes
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.id, s.nom,
              (SELECT COUNT(*) FROM fbelec.clients WHERE societe_id = s.id) AS nb_clients
       FROM fbelec.societes s ORDER BY s.nom`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/admin/societes
router.post('/', async (req, res, next) => {
  try {
    const nom = str(req.body.nom, { required: true, max: 200, label: 'Nom de la société' });
    const { rows: [societe] } = await pool.query(
      'INSERT INTO fbelec.societes (nom) VALUES ($1) RETURNING id, nom',
      [nom]
    );
    res.status(201).json({ ...societe, nb_clients: 0 });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Cette société existe déjà.' });
    next(err);
  }
});

// PUT /api/admin/societes/:id — renommer
router.put('/:id', async (req, res, next) => {
  try {
    const nom = str(req.body.nom, { required: true, max: 200, label: 'Nom de la société' });
    const { rows: [societe] } = await pool.query(
      'UPDATE fbelec.societes SET nom = $1 WHERE id = $2 RETURNING id, nom',
      [nom, req.params.id]
    );
    if (!societe) return res.status(404).json({ error: 'Société introuvable.' });
    res.json(societe);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Cette société existe déjà.' });
    next(err);
  }
});

// DELETE /api/admin/societes/:id — les clients rattachés repassent sans société (FK SET NULL)
router.delete('/:id', async (req, res, next) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM fbelec.societes WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Société introuvable.' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
