import { Router } from 'express';
import fs from 'fs';
import { pool } from '../../db.js';
import { uploadDoc, toPublicUrl } from '../../middleware/upload.js';

const router = Router();

// POST /api/admin/chantiers/:id/documents
router.post('/chantiers/:id/documents', uploadDoc.single('fichier'), async (req, res, next) => {
  try {
    const chantierId = parseInt(req.params.id);
    const { nom, type_fichier, statut, visible_client = 'true', date_document, categorie } = req.body;
    if (!nom) return res.status(400).json({ error: 'nom requis.' });

    const url = req.file ? req.file.path : null;
    const type = type_fichier || (req.file ? req.file.originalname.split('.').pop().toUpperCase() : 'PDF');

    const { rows: [doc] } = await pool.query(
      `INSERT INTO fbelec.documents (chantier_id, nom, type_fichier, url, statut, visible_client, date_document, categorie)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [chantierId, nom, type, url, statut || 'attente', visible_client !== 'false', date_document || null, categorie || null]
    );
    res.status(201).json({ ...doc, url: toPublicUrl(doc.url) });
  } catch (err) { next(err); }
});

// PUT /api/admin/documents/:id
router.put('/:id', async (req, res, next) => {
  try {
    const { nom, type_fichier, statut, visible_client, date_document, ordre } = req.body;
    const { rows: [doc] } = await pool.query(
      `UPDATE fbelec.documents
       SET nom = COALESCE($1,nom), type_fichier = COALESCE($2,type_fichier),
           statut = COALESCE($3,statut), visible_client = COALESCE($4,visible_client),
           date_document = COALESCE($5,date_document), ordre = COALESCE($6,ordre)
       WHERE id = $7 RETURNING *`,
      [nom, type_fichier, statut, visible_client, date_document, ordre, req.params.id]
    );
    if (!doc) return res.status(404).json({ error: 'Document introuvable.' });
    res.json({ ...doc, url: toPublicUrl(doc.url) });
  } catch (err) { next(err); }
});

// DELETE /api/admin/documents/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { rows: [doc] } = await pool.query(
      'DELETE FROM fbelec.documents WHERE id = $1 RETURNING url', [req.params.id]
    );
    if (!doc) return res.status(404).json({ error: 'Document introuvable.' });
    if (doc.url && fs.existsSync(doc.url)) fs.unlinkSync(doc.url);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
