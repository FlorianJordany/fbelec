import { Router } from 'express';
import { pool } from '../../db.js';
import { toPublicUrl } from '../../middleware/upload.js';

const router = Router();

// GET /api/admin/vue-client/chantiers — tous les chantiers de tous les clients (format client)
router.get('/chantiers', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         c.id, c.reference, c.nom, c.adresse, c.commune, c.type_prestation,
         c.statut, c.prochaine_action, c.prochaine_action_qui, c.prochaine_action_date,
         c.derniere_maj, c.action_requise_titre,
         cl.nom AS client_nom, cl.email AS client_email,
         (SELECT url FROM fbelec.photos p
          WHERE p.chantier_id = c.id AND p.visible_client = TRUE
          ORDER BY p.ordre, p.created_at LIMIT 1) AS photo_couverture,
         (SELECT COUNT(*) FROM fbelec.chantier_etapes
          WHERE chantier_id = c.id AND etat = 'done' AND masquee = FALSE)  AS etapes_done,
         (SELECT COUNT(*) FROM fbelec.chantier_etapes
          WHERE chantier_id = c.id AND etat <> 'na' AND masquee = FALSE)   AS etapes_total,
         (SELECT re.label FROM fbelec.chantier_etapes ce JOIN fbelec.ref_etapes re ON re.id = ce.etape_id
          WHERE ce.chantier_id = c.id AND ce.etat = 'current' AND re.actif = TRUE AND ce.masquee = FALSE
          ORDER BY re.ordre LIMIT 1) AS etape_courante,
         EXISTS(SELECT 1 FROM fbelec.chantier_etapes ce JOIN fbelec.ref_etapes re ON re.id = ce.etape_id
          WHERE ce.chantier_id = c.id AND ce.etat = 'blocked' AND re.actif = TRUE AND ce.masquee = FALSE) AS a_bloquee
       FROM fbelec.chantiers c
       JOIN fbelec.clients cl ON cl.id = c.client_id
       WHERE c.actif = TRUE
       ORDER BY c.updated_at DESC`
    );
    res.json(rows.map(r => ({ ...r, photo_couverture: toPublicUrl(r.photo_couverture) })));
  } catch (err) { next(err); }
});

// GET /api/admin/vue-client/chantiers/:id — détail en vue client (étapes masquées filtrées)
router.get('/chantiers/:id', async (req, res, next) => {
  try {
    const { rows: [chantier] } = await pool.query(
      `SELECT c.*, cl.nom AS client_nom, cl.email AS client_email
       FROM fbelec.chantiers c
       JOIN fbelec.clients cl ON cl.id = c.client_id
       WHERE c.id = $1 AND c.actif = TRUE`,
      [req.params.id]
    );
    if (!chantier) return res.status(404).json({ error: 'Chantier introuvable.' });

    const { rows: etapes } = await pool.query(
      `SELECT ce.etat, re.id AS etape_id, re.label, re.sous_texte, re.ordre, re.avec_date,
              to_char(ce.date_valeur, 'YYYY-MM-DD') AS date_valeur
       FROM fbelec.chantier_etapes ce
       JOIN fbelec.ref_etapes re ON re.id = ce.etape_id
       WHERE ce.chantier_id = $1 AND re.actif = TRUE AND ce.masquee = FALSE
       ORDER BY re.ordre`,
      [req.params.id]
    );

    const { rows: photos } = await pool.query(
      `SELECT p.id, p.url, p.legende, p.pair, p.date_photo, p.ordre,
              re.id AS etape_id, re.label AS etape_label
       FROM fbelec.photos p
       LEFT JOIN fbelec.ref_etapes re ON re.id = p.etape_id
       WHERE p.chantier_id = $1 AND p.visible_client = TRUE
       ORDER BY p.ordre, p.created_at`,
      [req.params.id]
    );

    const { rows: documents } = await pool.query(
      'SELECT id, nom, type_fichier, url, statut, date_document, categorie FROM fbelec.documents WHERE chantier_id = $1 AND visible_client = TRUE ORDER BY ordre, created_at',
      [req.params.id]
    );

    const { rows: notes } = await pool.query(
      'SELECT id, auteur, texte, date_affichee, created_at FROM fbelec.notes WHERE chantier_id = $1 AND visible_client = TRUE ORDER BY created_at DESC',
      [req.params.id]
    );

    res.json({
      ...chantier,
      etapes,
      photos: photos.map(p => ({ ...p, url: toPublicUrl(p.url) })),
      documents: documents.map(d => ({ ...d, url: toPublicUrl(d.url) })),
      notes,
    });
  } catch (err) { next(err); }
});

export default router;
