import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { pool } from '../../db.js';
import authClient from '../../middleware/authClient.js';
import { toPublicUrl, uploadDoc, uploadPhotos } from '../../middleware/upload.js';
import { str } from '../../utils/validate.js';
import { sendContactClient, sendNouveauChantierAdmin } from '../../services/mailer.js';
import { genererMandat, genererMandatFichier } from '../../services/mandat.js';

const router = Router();
router.use(authClient);

// ── Visibilité société ────────────────────────────────────────
// Un client 'basic' n'accède qu'à ses propres chantiers.
// L'admin d'une société accède aux chantiers de TOUS les comptes de sa société.
// Renvoie la liste des client_id accessibles (toujours >= [soi-même]).
async function allowedClientIds(clientId) {
  const { rows: [me] } = await pool.query(
    'SELECT societe_id, role_societe FROM fbelec.clients WHERE id = $1', [clientId]
  );
  if (me?.societe_id && me.role_societe === 'admin') {
    const { rows } = await pool.query(
      'SELECT id FROM fbelec.clients WHERE societe_id = $1', [me.societe_id]
    );
    return rows.map(r => r.id);
  }
  return [clientId];
}

// GET /api/client/etapes — référentiel des étapes actives
router.get('/etapes', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, label, sous_texte, ordre FROM fbelec.ref_etapes WHERE actif = TRUE ORDER BY ordre'
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// GET /api/client/chantiers — liste des chantiers du client connecté
// (?archived=1 → chantiers archivés ; défaut → en cours)
router.get('/chantiers', async (req, res, next) => {
  try {
    const archived = req.query.archived === '1' || req.query.archived === 'true';
    const ids = await allowedClientIds(req.clientId);
    const { rows } = await pool.query(
      `SELECT
         c.id, c.reference, c.reference_client, c.nom, c.adresse, c.commune, c.type_prestation,
         c.statut, c.prochaine_action, c.prochaine_action_qui, c.prochaine_action_date,
         c.derniere_maj, c.action_requise_titre, c.archive,
         CASE WHEN c.client_id <> $3
              THEN (SELECT nom FROM fbelec.clients WHERE id = c.client_id) END AS proprietaire_nom,
         (SELECT url FROM fbelec.photos p
          WHERE p.chantier_id = c.id AND p.visible_client = TRUE
          ORDER BY p.ordre, p.created_at LIMIT 1) AS photo_couverture,
         (SELECT COUNT(*) FROM fbelec.chantier_etapes WHERE chantier_id = c.id AND etat = 'done')  AS etapes_done,
         (SELECT COUNT(*) FROM fbelec.chantier_etapes WHERE chantier_id = c.id AND etat <> 'na')   AS etapes_total,
         (SELECT re.label FROM fbelec.chantier_etapes ce JOIN fbelec.ref_etapes re ON re.id = ce.etape_id
          WHERE ce.chantier_id = c.id AND ce.etat = 'current' AND re.actif = TRUE AND ce.masquee = FALSE
          ORDER BY re.ordre LIMIT 1) AS etape_courante,
         EXISTS(SELECT 1 FROM fbelec.chantier_etapes ce JOIN fbelec.ref_etapes re ON re.id = ce.etape_id
          WHERE ce.chantier_id = c.id AND ce.etat = 'blocked' AND re.actif = TRUE AND ce.masquee = FALSE) AS a_bloquee
       FROM fbelec.chantiers c
       WHERE c.client_id = ANY($1) AND c.actif = TRUE AND c.archive = $2
       ORDER BY c.updated_at DESC`,
      [ids, archived, req.clientId]
    );
    res.json(rows.map(c => ({ ...c, photo_couverture: toPublicUrl(c.photo_couverture) })));
  } catch (err) { next(err); }
});

// GET /api/client/chantiers/:id — détail complet
router.get('/chantiers/:id', async (req, res, next) => {
  try {
    const chantierId = parseInt(req.params.id);
    const ids = await allowedClientIds(req.clientId);
    const { rows: [chantier] } = await pool.query(
      'SELECT * FROM fbelec.chantiers WHERE id = $1 AND client_id = ANY($2) AND actif = TRUE',
      [chantierId, ids]
    );
    if (!chantier) return res.status(404).json({ error: 'Chantier introuvable.' });

    const { rows: etapes } = await pool.query(
      `SELECT ce.etat, re.id AS etape_id, re.label, re.sous_texte, re.ordre, re.avec_date,
              to_char(ce.date_valeur, 'YYYY-MM-DD') AS date_valeur
       FROM fbelec.chantier_etapes ce
       JOIN fbelec.ref_etapes re ON re.id = ce.etape_id
       WHERE ce.chantier_id = $1 AND re.actif = TRUE AND ce.masquee = FALSE
       ORDER BY re.ordre`,
      [chantierId]
    );

    const { rows: photos } = await pool.query(
      `SELECT p.id, p.url, p.legende, p.pair, p.date_photo, p.ordre,
              re.id AS etape_id, re.label AS etape_label
       FROM fbelec.photos p
       LEFT JOIN fbelec.ref_etapes re ON re.id = p.etape_id
       WHERE p.chantier_id = $1 AND p.visible_client = TRUE
       ORDER BY p.ordre, p.created_at`,
      [chantierId]
    );

    const { rows: documents } = await pool.query(
      'SELECT id, nom, type_fichier, url, statut, date_document, categorie FROM fbelec.documents WHERE chantier_id = $1 AND visible_client = TRUE ORDER BY ordre, created_at',
      [chantierId]
    );

    const { rows: notes } = await pool.query(
      'SELECT id, auteur, texte, date_affichee, de_client, created_at FROM fbelec.notes WHERE chantier_id = $1 AND visible_client = TRUE ORDER BY created_at DESC',
      [chantierId]
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

// Formate 3 lettres sans accents pour la référence
function toRef3(s) {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 3).padEnd(3, 'X');
}

// POST /api/client/chantiers — le client crée son propre chantier
router.post('/chantiers', async (req, res, next) => {
  try {
    const { adresse, commune, code_postal, adresse_facturation, puissance_demandee,
            date_debut_chantier, duree_chantier, terrain_viabilise,
            reference_client, reference_facturation, puissance_type,
            facturation_telephone, facturation_email } = req.body;
    const commentaire = str(req.body.commentaire, { max: 5000, label: 'Commentaire' });

    if (!adresse?.trim() || !commune?.trim() || !adresse_facturation?.trim()
        || !puissance_demandee?.trim() || !date_debut_chantier || !duree_chantier?.trim()) {
      return res.status(400).json({ error: 'Champs obligatoires manquants.' });
    }
    if (typeof terrain_viabilise !== 'boolean')
      return res.status(400).json({ error: 'Le champ « Terrain viabilisé » est obligatoire.' });
    if (!['monophase', 'triphase'].includes(puissance_type))
      return res.status(400).json({ error: 'Le champ « Type » (Monophasé/Triphasé) est obligatoire.' });
    if (!reference_client?.trim())
      return res.status(400).json({ error: 'Le champ « Référence » est obligatoire.' });

    const { rows: [clientInfo] } = await pool.query(
      'SELECT nom, email FROM fbelec.clients WHERE id = $1', [req.clientId]
    );
    if (!clientInfo) return res.status(404).json({ error: 'Client introuvable.' });

    const nom = `${adresse.trim()}, ${commune.trim()}`;

    const dbClient = await pool.connect();
    try {
      await dbClient.query('BEGIN');

      // Insérer d'abord pour obtenir l'ID.
      // Référence provisoire unique côté SQL : une valeur fixe ('TMP') restée en base
      // après un échec bloquerait toutes les créations suivantes (index unique).
      const { rows: [chantier] } = await dbClient.query(
        `INSERT INTO fbelec.chantiers
           (client_id, reference, nom, adresse, commune, code_postal,
            adresse_facturation, puissance_demandee, date_debut_chantier,
            duree_chantier, statut, cree_par_client, terrain_viabilise,
            reference_client, reference_facturation, puissance_type,
            facturation_telephone, facturation_email, commentaire)
         VALUES ($1,'TMP-'||md5(random()::text),$2,$3,$4,$5,$6,$7,$8,$9,'prepa',TRUE,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
        [req.clientId, nom,
         adresse.trim(), commune.trim(), code_postal?.trim()||null,
         adresse_facturation.trim(), puissance_demandee.trim(),
         date_debut_chantier, duree_chantier.trim(), terrain_viabilise,
         reference_client.trim(), reference_facturation?.trim()||null, puissance_type,
         facturation_telephone?.trim()||null, facturation_email?.trim()||null, commentaire]
      );

      // Construire la référence : DEP-VIL-NOM-ID
      const dep = (code_postal || '').replace(/[^0-9]/g, '').slice(0, 2).padEnd(2, 'X');
      const vil = toRef3(commune);
      const nomRef = toRef3(clientInfo.nom.split(' ').pop()); // nom de famille
      const reference = `${dep}-${vil}-${nomRef}-${chantier.id}`;

      await dbClient.query('UPDATE fbelec.chantiers SET reference = $1 WHERE id = $2',
        [reference, chantier.id]);

      // Initialiser les étapes depuis le référentiel
      await dbClient.query('SELECT fbelec.init_etapes($1)', [chantier.id]);

      await dbClient.query('COMMIT');

      // Mandat EDF prérempli, enregistré parmi les documents du chantier
      // — sauf si l'utilisateur fournit son propre mandat (uploadé juste après).
      // (échec non bloquant : la création reste valide).
      if (req.body.mandat_fourni !== true) try {
        const fichier = await genererMandatFichier({
          chantierId: chantier.id, schema: req.schema,
          reference: reference_client.trim(),
          adresse: [adresse.trim(), code_postal?.trim(), commune.trim()].filter(Boolean).join(', '),
          ville: commune.trim(),
        });
        await pool.query(
          `INSERT INTO fbelec.documents (chantier_id, nom, type_fichier, url, categorie, statut, visible_client)
           VALUES ($1, 'Mandat', 'PDF', $2, 'mandat', 'attente', TRUE)`,
          [chantier.id, fichier]
        );
      } catch (e) { console.error('[mandat] génération auto:', e.message); }

      sendNouveauChantierAdmin({
        clientNom: clientInfo.nom, clientEmail: clientInfo.email,
        chantierNom: nom, chantierAdresse: nom, reference,
        chantierId: chantier.id,
      }).catch(e => console.error('[mailer] nouveau chantier:', e.message));

      res.status(201).json({ ...chantier, reference });
    } catch (err) {
      await dbClient.query('ROLLBACK');
      throw err;
    } finally { dbClient.release(); }
  } catch (err) { next(err); }
});

// PUT /api/client/chantiers/:id/infos — modifier les infos administratives
router.put('/chantiers/:id/infos', async (req, res, next) => {
  try {
    const chantierId = parseInt(req.params.id);
    const allowed = ['adresse','commune','code_postal','adresse_facturation',
                     'puissance_demandee','date_debut_chantier','duree_chantier','terrain_viabilise',
                     'reference_client','reference_facturation','puissance_type',
                     'facturation_telephone','facturation_email'];
    const fields = allowed.filter(f => req.body[f] !== undefined && req.body[f] !== null);
    if (!fields.length) return res.status(400).json({ error: 'Aucun champ à modifier.' });

    const set = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
    // '' → null (champs texte) ; on préserve les booléens (false ne doit pas devenir null).
    const ids = await allowedClientIds(req.clientId);
    const vals = [...fields.map(f => req.body[f] === '' ? null : req.body[f]), chantierId, ids];

    const { rows: [c] } = await pool.query(
      `UPDATE fbelec.chantiers SET ${set}
       WHERE id = $${fields.length + 1} AND client_id = ANY($${fields.length + 2}) AND actif = TRUE
       RETURNING *`,
      vals
    );
    if (!c) return res.status(404).json({ error: 'Chantier introuvable.' });
    res.json(c);
  } catch (err) { next(err); }
});

// POST /api/client/chantiers/:id/documents — déposer un document
router.post('/chantiers/:id/documents', uploadDoc.single('fichier'), async (req, res, next) => {
  try {
    const chantierId = parseInt(req.params.id);
    const { rows: [c] } = await pool.query(
      'SELECT id FROM fbelec.chantiers WHERE id = $1 AND client_id = ANY($2) AND actif = TRUE',
      [chantierId, await allowedClientIds(req.clientId)]
    );
    if (!c) return res.status(404).json({ error: 'Chantier introuvable.' });

    if (!req.file) return res.status(400).json({ error: 'Fichier manquant.' });

    const { categorie, nom } = req.body;
    const ext = path.extname(req.file.originalname).slice(1).toUpperCase() || 'FICH';
    const docNom = nom?.trim() || categorie || req.file.originalname;

    const { rows: [doc] } = await pool.query(
      `INSERT INTO fbelec.documents
         (chantier_id, nom, type_fichier, url, categorie, statut, visible_client)
       VALUES ($1,$2,$3,$4,$5,'attente',TRUE) RETURNING *`,
      [chantierId, docNom, ext, req.file.path, categorie || null]
    );
    res.status(201).json({ ...doc, url: toPublicUrl(doc.url) });
  } catch (err) { next(err); }
});

// POST /api/client/chantiers/:id/photos — déposer des photos
router.post('/chantiers/:id/photos', uploadPhotos.single('photo'), async (req, res, next) => {
  try {
    const chantierId = parseInt(req.params.id);
    const { rows: [c] } = await pool.query(
      'SELECT id FROM fbelec.chantiers WHERE id = $1 AND client_id = ANY($2) AND actif = TRUE',
      [chantierId, await allowedClientIds(req.clientId)]
    );
    if (!c) return res.status(404).json({ error: 'Chantier introuvable.' });

    if (!req.file) return res.status(400).json({ error: 'Photo manquante.' });

    const { rows: [photo] } = await pool.query(
      'INSERT INTO fbelec.photos (chantier_id, url, visible_client) VALUES ($1,$2,TRUE) RETURNING *',
      [chantierId, req.file.path]
    );
    res.status(201).json({ ...photo, url: toPublicUrl(photo.url) });
  } catch (err) { next(err); }
});

// DELETE /api/client/chantiers/:id/documents/:docId
router.delete('/chantiers/:id/documents/:docId', async (req, res, next) => {
  try {
    const chantierId = parseInt(req.params.id);
    const { rows: [c] } = await pool.query(
      'SELECT id FROM fbelec.chantiers WHERE id=$1 AND client_id=ANY($2) AND actif=TRUE',
      [chantierId, await allowedClientIds(req.clientId)]
    );
    if (!c) return res.status(404).json({ error: 'Chantier introuvable.' });

    const { rows: [doc] } = await pool.query(
      'DELETE FROM fbelec.documents WHERE id=$1 AND chantier_id=$2 RETURNING url',
      [req.params.docId, chantierId]
    );
    if (!doc) return res.status(404).json({ error: 'Document introuvable.' });

    if (doc.url && fs.existsSync(doc.url)) { try { fs.unlinkSync(doc.url); } catch {} }
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// DELETE /api/client/chantiers/:id/photos/:photoId
router.delete('/chantiers/:id/photos/:photoId', async (req, res, next) => {
  try {
    const chantierId = parseInt(req.params.id);
    const { rows: [c] } = await pool.query(
      'SELECT id FROM fbelec.chantiers WHERE id=$1 AND client_id=ANY($2) AND actif=TRUE',
      [chantierId, await allowedClientIds(req.clientId)]
    );
    if (!c) return res.status(404).json({ error: 'Chantier introuvable.' });

    const { rows: [photo] } = await pool.query(
      'DELETE FROM fbelec.photos WHERE id=$1 AND chantier_id=$2 RETURNING url',
      [req.params.photoId, chantierId]
    );
    if (!photo) return res.status(404).json({ error: 'Photo introuvable.' });

    if (photo.url && fs.existsSync(photo.url)) { try { fs.unlinkSync(photo.url); } catch {} }
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// POST /api/client/mandat — mandat EDF prérempli (PDF) pour la création de chantier
router.post('/mandat', async (req, res, next) => {
  try {
    const reference = str(req.body.reference, { required: true, max: 200, label: 'Référence' });
    const adresse = str(req.body.adresse, { required: true, max: 300, label: 'Adresse' });
    const ville = str(req.body.ville, { required: true, max: 100, label: 'Ville' });
    const pdf = await genererMandat({ reference, adresse, ville });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="mandat-edf.pdf"');
    res.send(pdf);
  } catch (err) { next(err); }
});

// POST /api/client/contact — le client envoie un message à FB ELEC
// Si chantier_id est fourni : le message est stocké dans le fil du chantier
// (fbelec.notes, de_client=TRUE) et l'e-mail est enrichi des infos du chantier.
router.post('/contact', async (req, res, next) => {
  try {
    const message = str(req.body.message, { required: true, max: 5000, label: 'Message' });
    const chantierId = parseInt(req.body.chantier_id, 10);

    const { rows: [client] } = await pool.query(
      `SELECT cl.nom, cl.email, cl.telephone, s.nom AS societe_nom
       FROM fbelec.clients cl
       LEFT JOIN fbelec.societes s ON s.id = cl.societe_id
       WHERE cl.id = $1`, [req.clientId]
    );
    if (!client) return res.status(404).json({ error: 'Client introuvable.' });

    let chantier = null;
    if (Number.isInteger(chantierId) && chantierId > 0) {
      const { rows: [c] } = await pool.query(
        `SELECT id, nom, reference, reference_client, adresse, commune
         FROM fbelec.chantiers WHERE id = $1 AND client_id = ANY($2) AND actif = TRUE`,
        [chantierId, await allowedClientIds(req.clientId)]
      );
      if (!c) return res.status(404).json({ error: 'Chantier introuvable.' });
      chantier = c;
      await pool.query(
        `INSERT INTO fbelec.notes (chantier_id, auteur, texte, visible_client, de_client, date_affichee)
         VALUES ($1, $2, $3, TRUE, TRUE, $4)`,
        [chantier.id, client.nom, message,
         new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })]
      );
    }

    sendContactClient({
      clientNom: client.nom, clientEmail: client.email,
      clientTelephone: client.telephone, societeNom: client.societe_nom, message,
      chantier: chantier && {
        id: chantier.id, nom: chantier.nom, reference: chantier.reference,
        referenceClient: chantier.reference_client,
        adresse: [chantier.adresse, chantier.commune].filter(Boolean).join(', '),
      },
    }).catch(e => console.error('[mailer] contact:', e.message));

    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
