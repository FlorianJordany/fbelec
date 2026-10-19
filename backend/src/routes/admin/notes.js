import { Router } from 'express';
import { pool } from '../../db.js';
import { sendNouvelleNote } from '../../services/mailer.js';
import { destinatairesAbonnes } from '../../services/abonnes.js';

const router = Router();

// POST /api/admin/chantiers/:id/notes
router.post('/chantiers/:id/notes', async (req, res, next) => {
  try {
    const { texte, auteur, date_affichee, visible_client = true } = req.body;
    if (!texte) return res.status(400).json({ error: 'texte requis.' });
    const { rows: [note] } = await pool.query(
      `INSERT INTO fbelec.notes (chantier_id, admin_id, auteur, texte, visible_client, date_affichee)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.params.id, req.adminId, auteur || 'Franck Bordier', texte, visible_client, date_affichee || null]
    );
    res.status(201).json(note);

    // Envoyer un email au client si la note est visible côté client
    if (visible_client !== false && visible_client !== 'false') {
      pool.query(
        `SELECT c.nom AS chantier_nom, c.reference_client, c.client_id, cl.nom AS client_nom, cl.email AS client_email
         FROM fbelec.chantiers c JOIN fbelec.clients cl ON cl.id = c.client_id
         WHERE c.id = $1`, [req.params.id]
      ).then(async ({ rows: [row] }) => {
        if (!row) return;
        const commun = {
          chantierNom: row.chantier_nom, referenceClient: row.reference_client,
          texte, chantierId: req.params.id,
        };
        if (row.client_email) sendNouvelleNote({ nom: row.client_nom, email: row.client_email, ...commun })
          .catch(e => console.error('[mailer] note:', e.message));
        // Collègues abonnés à ce chantier (hors propriétaire, déjà prévenu).
        for (const s of await destinatairesAbonnes(req.params.id, [row.client_id])) {
          sendNouvelleNote({ nom: s.nom, email: s.email, ...commun, pourAbonne: true })
            .catch(e => console.error('[mailer] note (abonné):', e.message));
        }
      }).catch(e => console.error('[mailer] note:', e.message));
    }
  } catch (err) { next(err); }
});

// PUT /api/admin/notes/:id
router.put('/:id', async (req, res, next) => {
  try {
    const { texte, auteur, date_affichee, visible_client } = req.body;
    const { rows: [note] } = await pool.query(
      `UPDATE fbelec.notes
       SET texte = COALESCE($1,texte), auteur = COALESCE($2,auteur),
           date_affichee = COALESCE($3,date_affichee), visible_client = COALESCE($4,visible_client)
       WHERE id = $5 RETURNING *`,
      [texte, auteur, date_affichee, visible_client, req.params.id]
    );
    if (!note) return res.status(404).json({ error: 'Note introuvable.' });
    res.json(note);
  } catch (err) { next(err); }
});

// DELETE /api/admin/notes/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await pool.query('DELETE FROM fbelec.notes WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
