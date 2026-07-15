import { Router } from 'express';
import { pool } from '../../db.js';

const router = Router();

// GET /api/admin/etapes
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM fbelec.ref_etapes ORDER BY ordre');
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/admin/etapes — créer une étape + la propager aux chantiers existants
// L'ordre n'est plus saisi : la nouvelle étape est ajoutée en fin de liste
// (réordonnable ensuite par glisser-déposer).
router.post('/', async (req, res, next) => {
  try {
    const { label, sous_texte, ordre, avec_date } = req.body;
    if (!label) return res.status(400).json({ error: 'label requis.' });
    const { rows: [{ max }] } = await pool.query('SELECT COALESCE(MAX(ordre), 0) AS max FROM fbelec.ref_etapes');
    const finalOrdre = ordre != null ? ordre : parseInt(max) + 10;
    const { rows: [etape] } = await pool.query(
      'INSERT INTO fbelec.ref_etapes (label, sous_texte, ordre, avec_date) VALUES ($1, $2, $3, $4) RETURNING *',
      [label, sous_texte || null, finalOrdre, avec_date === true]
    );
    await pool.query('SELECT fbelec.propager_etape($1)', [etape.id]);
    res.status(201).json(etape);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Cet ordre est déjà utilisé par une étape active.' });
    next(err);
  }
});

// PUT /api/admin/etapes/reorder — réordonner en masse
// Body : [{ id, ordre }, ...]
// 2 passes : l'index unique sur ordre (étapes actives) interdit les collisions
// intermédiaires → on décale d'abord tout en négatif, puis on pose les valeurs finales.
router.put('/reorder', async (req, res, next) => {
  const items = Array.isArray(req.body) ? req.body : [];
  if (!items.length) return res.status(400).json({ error: 'Liste vide.' });
  if (items.some(i => !Number.isInteger(parseInt(i.id)) || !Number.isInteger(parseInt(i.ordre))))
    return res.status(400).json({ error: 'id et ordre entiers requis.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const { id } of items) {
      await client.query('UPDATE fbelec.ref_etapes SET ordre = -id WHERE id = $1', [parseInt(id)]);
    }
    for (const { id, ordre } of items) {
      await client.query('UPDATE fbelec.ref_etapes SET ordre = $1 WHERE id = $2', [parseInt(ordre), parseInt(id)]);
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) { await client.query('ROLLBACK'); next(err); }
  finally { client.release(); }
});

// PUT /api/admin/etapes/:id
router.put('/:id', async (req, res, next) => {
  try {
    const { label, sous_texte, ordre, actif, avec_date } = req.body;
    const { rows: [etape] } = await pool.query(
      `UPDATE fbelec.ref_etapes
       SET label      = COALESCE($1, label),
           sous_texte = COALESCE($2, sous_texte),
           ordre      = COALESCE($3, ordre),
           actif      = COALESCE($4, actif),
           avec_date  = COALESCE($5, avec_date)
       WHERE id = $6 RETURNING *`,
      [label, sous_texte, ordre, actif, avec_date, req.params.id]
    );
    if (!etape) return res.status(404).json({ error: 'Étape introuvable.' });
    res.json(etape);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Cet ordre est déjà utilisé par une étape active.' });
    next(err);
  }
});

// DELETE /api/admin/etapes/:id — suppression définitive (retirée de tous les chantiers)
router.delete('/:id', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // chantier_etapes n'a pas d'ON DELETE → nettoyer d'abord. photos.etape_id → SET NULL (FK).
    await client.query('DELETE FROM fbelec.chantier_etapes WHERE etape_id = $1', [req.params.id]);
    const { rowCount } = await client.query('DELETE FROM fbelec.ref_etapes WHERE id = $1', [req.params.id]);
    await client.query('COMMIT');
    if (!rowCount) return res.status(404).json({ error: 'Étape introuvable.' });
    res.json({ ok: true });
  } catch (err) { await client.query('ROLLBACK'); next(err); }
  finally { client.release(); }
});

export default router;
