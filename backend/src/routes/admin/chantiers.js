import { Router } from 'express';
import fs from 'fs';
import { pool } from '../../db.js';
import { toPublicUrl } from '../../middleware/upload.js';
import { sendEtapeAvancement } from '../../services/mailer.js';
import { genererMandat, genererMandatFichier } from '../../services/mandat.js';
import { str } from '../../utils/validate.js';

const router = Router();

// POST /api/admin/chantiers/mandat — mandat EDF prérempli (PDF)
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

// Libellés des états d'étape (miroir du front).
const ETAT_LABELS = {
  done: 'Terminée', current: 'En cours', future: 'À venir', blocked: 'Bloquée', na: 'Non applicable',
};

// GET /api/admin/chantiers  (?archived=1 → chantiers archivés ; défaut → en cours)
router.get('/', async (req, res, next) => {
  try {
    const archived = req.query.archived === '1' || req.query.archived === 'true';
    const { rows } = await pool.query(
      `SELECT c.id, c.reference, c.reference_client, c.nom, c.adresse, c.commune, c.statut,
              c.derniere_maj, c.updated_at, c.actif, c.archive, c.action_requise_titre,
              cl.nom AS client_nom, cl.email AS client_email, s.nom AS societe_nom,
              (SELECT COUNT(*) FROM fbelec.chantier_etapes WHERE chantier_id = c.id AND etat = 'done')  AS etapes_done,
              (SELECT COUNT(*) FROM fbelec.chantier_etapes WHERE chantier_id = c.id AND etat <> 'na')   AS etapes_total,
              (SELECT re.label FROM fbelec.chantier_etapes ce JOIN fbelec.ref_etapes re ON re.id = ce.etape_id
               WHERE ce.chantier_id = c.id AND ce.etat = 'current' AND re.actif = TRUE ORDER BY re.ordre LIMIT 1) AS etape_courante,
              EXISTS(SELECT 1 FROM fbelec.chantier_etapes ce JOIN fbelec.ref_etapes re ON re.id = ce.etape_id
               WHERE ce.chantier_id = c.id AND ce.etat = 'blocked' AND re.actif = TRUE) AS a_bloquee,
              (SELECT url FROM fbelec.photos p WHERE p.chantier_id = c.id AND p.visible_client = TRUE ORDER BY p.ordre, p.created_at LIMIT 1) AS photo_couverture
       FROM fbelec.chantiers c
       JOIN fbelec.clients cl ON cl.id = c.client_id
       LEFT JOIN fbelec.societes s ON s.id = cl.societe_id
       WHERE c.archive = $1
       ORDER BY c.updated_at DESC`,
      [archived]
    );
    res.json(rows.map(r => ({ ...r, photo_couverture: toPublicUrl(r.photo_couverture) })));
  } catch (err) { next(err); }
});

// GET /api/admin/chantiers/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { rows: [chantier] } = await pool.query(
      `SELECT c.*, cl.nom AS client_nom, cl.email AS client_email
       FROM fbelec.chantiers c JOIN fbelec.clients cl ON cl.id = c.client_id
       WHERE c.id = $1`, [req.params.id]);
    if (!chantier) return res.status(404).json({ error: 'Chantier introuvable.' });

    const { rows: etapes } = await pool.query(
      `SELECT ce.id, ce.etat, ce.note_admin, ce.masquee, re.avec_date,
              to_char(ce.date_valeur, 'YYYY-MM-DD') AS date_valeur,
              re.id AS etape_id, re.label, re.sous_texte, re.ordre
       FROM fbelec.chantier_etapes ce
       JOIN fbelec.ref_etapes re ON re.id = ce.etape_id
       WHERE ce.chantier_id = $1
       ORDER BY re.ordre`,
      [req.params.id]
    );
    const { rows: photos } = await pool.query(
      `SELECT p.*, re.label AS etape_label FROM fbelec.photos p
       LEFT JOIN fbelec.ref_etapes re ON re.id = p.etape_id
       WHERE p.chantier_id = $1 ORDER BY p.ordre, p.created_at`, [req.params.id]
    );
    const { rows: documents } = await pool.query(
      'SELECT * FROM fbelec.documents WHERE chantier_id = $1 ORDER BY ordre, created_at', [req.params.id]
    );
    const { rows: notes } = await pool.query(
      'SELECT * FROM fbelec.notes WHERE chantier_id = $1 ORDER BY created_at DESC', [req.params.id]
    );

    const photosWithUrl = photos.map(p => ({ ...p, url: toPublicUrl(p.url) }));
    const docsWithUrl = documents.map(d => ({ ...d, url: toPublicUrl(d.url) }));
    res.json({ ...chantier, etapes, photos: photosWithUrl, documents: docsWithUrl, notes });
  } catch (err) { next(err); }
});

// POST /api/admin/chantiers
router.post('/', async (req, res, next) => {
  try {
    const {
      client_id, nom, adresse, commune, code_postal, type_prestation,
      adresse_facturation, puissance_demandee, date_debut_chantier, duree_chantier, terrain_viabilise,
      reference_client, reference_facturation, puissance_type,
      facturation_telephone, facturation_email,
      statut, resume, prochaine_action, prochaine_action_qui, prochaine_action_date,
      action_requise_titre, action_requise_texte, action_requise_cta, derniere_maj,
      enedis_ref_affaire, enedis_delivery_id, enedis_contrat, enedis_pdl,
      enedis_type_prestation, enedis_delivery_status, enedis_date_demande,
      enedis_date_etude, enedis_date_travaux, enedis_lat, enedis_lng, enedis_point_arret,
    } = req.body;
    const commentaire = str(req.body.commentaire, { max: 5000, label: 'Commentaire' });
    if (!client_id || !adresse || !commune)
      return res.status(400).json({ error: 'Champs obligatoires manquants.' });
    if (typeof terrain_viabilise !== 'boolean')
      return res.status(400).json({ error: 'Le champ « Terrain viabilisé » est obligatoire.' });
    if (!['monophase', 'triphase'].includes(puissance_type))
      return res.status(400).json({ error: 'Le champ « Type » (Monophasé/Triphasé) est obligatoire.' });
    if (!reference_client?.trim())
      return res.status(400).json({ error: 'Le champ « Référence » est obligatoire.' });

    const chantierNom = nom || `${adresse}, ${commune}`;

    let chantier, reference;
    const dbClient = await pool.connect();
    try {
      await dbClient.query('BEGIN');

      // Insérer d'abord pour obtenir l'ID, puis calculer la référence.
      // Référence provisoire unique côté SQL : une valeur fixe ('TMP') restée en base
      // après un échec bloquerait toutes les créations suivantes (index unique).
      ({ rows: [chantier] } = await dbClient.query(
        `INSERT INTO fbelec.chantiers
           (client_id,reference,nom,adresse,commune,code_postal,type_prestation,
            adresse_facturation,puissance_demandee,date_debut_chantier,duree_chantier,
            statut,resume,prochaine_action,prochaine_action_qui,prochaine_action_date,
            action_requise_titre,action_requise_texte,action_requise_cta,derniere_maj,
            enedis_ref_affaire,enedis_delivery_id,enedis_contrat,enedis_pdl,
            enedis_type_prestation,enedis_delivery_status,enedis_date_demande,
            enedis_date_etude,enedis_date_travaux,enedis_lat,enedis_lng,enedis_point_arret,terrain_viabilise,
            reference_client,reference_facturation,puissance_type,facturation_telephone,facturation_email,commentaire)
         VALUES ($1,'TMP-'||md5(random()::text),$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38)
         RETURNING *`,
        [client_id,chantierNom,adresse,commune,code_postal||null,type_prestation||null,
         adresse_facturation||null,puissance_demandee||null,date_debut_chantier||null,duree_chantier||null,
         statut||'prepa',resume||null,prochaine_action||null,prochaine_action_qui||null,prochaine_action_date||null,
         action_requise_titre||null,action_requise_texte||null,action_requise_cta||null,derniere_maj||null,
         enedis_ref_affaire||null,enedis_delivery_id||null,enedis_contrat||null,enedis_pdl||null,
         enedis_type_prestation||null,enedis_delivery_status||null,enedis_date_demande||null,
         enedis_date_etude||null,enedis_date_travaux||null,enedis_lat||null,enedis_lng||null,enedis_point_arret||null,
         terrain_viabilise,reference_client.trim(),reference_facturation?.trim()||null,puissance_type,
         facturation_telephone?.trim()||null,facturation_email?.trim()||null,commentaire]
      ));

      // Référence fournie par l'admin ou générée automatiquement
      const dep = (code_postal || '').replace(/[^0-9]/g,'').slice(0,2).padEnd(2,'X');
      const vil = commune.normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^A-Za-z0-9]/g,'').toUpperCase().slice(0,3).padEnd(3,'X');
      reference = req.body.reference?.trim() || `${dep}-${vil}-ADM-${chantier.id}`;

      await dbClient.query('UPDATE fbelec.chantiers SET reference = $1 WHERE id = $2', [reference, chantier.id]);
      await dbClient.query('SELECT fbelec.init_etapes($1)', [chantier.id]);
      await dbClient.query('COMMIT');
    } catch (err) {
      await dbClient.query('ROLLBACK');
      throw err;
    } finally { dbClient.release(); }

    // Mandat EDF prérempli, enregistré parmi les documents du chantier
    // — sauf si un mandat est fourni dans le formulaire (uploadé juste après).
    // (échec non bloquant : la création reste valide).
    if (req.body.mandat_fourni !== true) try {
      const fichier = await genererMandatFichier({
        chantierId: chantier.id, schema: req.schema,
        reference: reference_client.trim(),
        adresse: [adresse, code_postal, commune].filter(Boolean).join(', '),
        ville: commune,
      });
      await pool.query(
        `INSERT INTO fbelec.documents (chantier_id, nom, type_fichier, url, categorie, statut, visible_client)
         VALUES ($1, 'Mandat', 'PDF', $2, 'mandat', 'attente', TRUE)`,
        [chantier.id, fichier]
      );
    } catch (e) { console.error('[mandat] génération auto:', e.message); }

    res.status(201).json({ ...chantier, reference, nom: chantierNom });
  } catch (err) {
    if (err.code === '23505') {
      // Trace la contrainte réelle (pkey = séquence désynchronisée, pas la référence)
      console.error('[chantiers] doublon 23505:', err.constraint || '', err.detail || '');
      return res.status(409).json({ error: 'Référence déjà utilisée.' });
    }
    next(err);
  }
});

// PUT /api/admin/chantiers/:id
router.put('/:id', async (req, res, next) => {
  try {
    const allowed = [
      'nom','adresse','commune','code_postal','type_prestation','statut','resume',
      'prochaine_action','prochaine_action_qui','prochaine_action_date',
      'action_requise_titre','action_requise_texte','action_requise_cta','derniere_maj',
      'enedis_ref_affaire','enedis_delivery_id','enedis_contrat','enedis_pdl',
      'enedis_type_prestation','enedis_delivery_status','enedis_date_demande',
      'enedis_date_etude','enedis_date_travaux','enedis_lat','enedis_lng','enedis_point_arret','actif','archive','terrain_viabilise',
      'reference_client','reference_facturation','puissance_type',
      'facturation_telephone','facturation_email',
    ];
    const fields = allowed.filter(f => req.body[f] !== undefined);
    if (!fields.length) return res.status(400).json({ error: 'Aucun champ à modifier.' });

    const set = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
    const vals = [...fields.map(f => req.body[f]), req.params.id];
    const { rows: [c] } = await pool.query(
      `UPDATE fbelec.chantiers SET ${set} WHERE id = $${vals.length} RETURNING *`, vals
    );
    if (!c) return res.status(404).json({ error: 'Chantier introuvable.' });
    res.json(c);
  } catch (err) { next(err); }
});

// PUT /api/admin/chantiers/:id/etapes/:etapeId — masquee et/ou date_valeur d'une étape
router.put('/:id/etapes/:etapeId', async (req, res, next) => {
  try {
    const sets = [], vals = [];
    if (req.body.masquee !== undefined)     { vals.push(req.body.masquee);            sets.push(`masquee = $${vals.length}`); }
    if (req.body.date_valeur !== undefined) { vals.push(req.body.date_valeur || null); sets.push(`date_valeur = $${vals.length}`); }
    if (!sets.length) return res.status(400).json({ error: 'Aucun champ à modifier.' });
    vals.push(req.params.id, req.params.etapeId);
    await pool.query(
      `UPDATE fbelec.chantier_etapes SET ${sets.join(', ')}
       WHERE chantier_id = $${vals.length - 1} AND etape_id = $${vals.length}`,
      vals
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// PUT /api/admin/chantiers/:id/etapes — mise à jour en masse des états
router.put('/:id/etapes', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // États avant modif → pour ne notifier que les étapes qui changent réellement.
    const ids = req.body.map(e => e.etape_id);
    const { rows: olds } = await client.query(
      'SELECT etape_id, etat FROM fbelec.chantier_etapes WHERE chantier_id = $1 AND etape_id = ANY($2)',
      [req.params.id, ids]
    );
    const oldMap = Object.fromEntries(olds.map(o => [o.etape_id, o.etat]));
    for (const { etape_id, etat, note_admin } of req.body) {
      await client.query(
        `UPDATE fbelec.chantier_etapes SET etat = $1, note_admin = COALESCE($2, note_admin)
         WHERE chantier_id = $3 AND etape_id = $4`,
        [etat, note_admin || null, req.params.id, etape_id]
      );
    }
    await client.query('COMMIT');
    res.json({ ok: true });

    // E-mail au client pour chaque étape dont l'état a réellement changé (asynchrone).
    const changed = req.body.filter(e => oldMap[e.etape_id] !== undefined && oldMap[e.etape_id] !== e.etat);
    if (changed.length) {
      pool.query(
        `SELECT c.nom AS chantier_nom, cl.nom AS client_nom, cl.email AS client_email
         FROM fbelec.chantiers c JOIN fbelec.clients cl ON cl.id = c.client_id WHERE c.id = $1`,
        [req.params.id]
      ).then(async ({ rows: [row] }) => {
        if (!row?.client_email) return;
        const { rows: labels } = await pool.query(
          'SELECT id, label FROM fbelec.ref_etapes WHERE id = ANY($1)', [changed.map(e => e.etape_id)]
        );
        const labelMap = Object.fromEntries(labels.map(l => [l.id, l.label]));
        for (const ch of changed) {
          sendEtapeAvancement({
            nom: row.client_nom, email: row.client_email, chantierNom: row.chantier_nom,
            etapeLabel: labelMap[ch.etape_id] || 'Étape', etatLabel: ETAT_LABELS[ch.etat] || ch.etat,
            chantierId: req.params.id,
          }).catch(e => console.error('[mailer] etape:', e.message));
        }
      }).catch(() => {});
    }
  } catch (err) { await client.query('ROLLBACK'); next(err); }
  finally { client.release(); }
});

// POST /api/admin/chantiers/:id/avancer
router.post('/:id/avancer', async (req, res, next) => {
  try {
    const { etape_id } = req.body;
    if (!etape_id) return res.status(400).json({ error: 'etape_id requis.' });
    await pool.query('SELECT fbelec.avancer_chantier($1, $2)', [req.params.id, etape_id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// DELETE /api/admin/chantiers/:id — suppression complète (fichiers + DB)
router.delete('/:id', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Récupérer les chemins des fichiers à supprimer
    const { rows: photos }    = await client.query('SELECT url FROM fbelec.photos     WHERE chantier_id = $1', [req.params.id]);
    const { rows: documents } = await client.query('SELECT url FROM fbelec.documents  WHERE chantier_id = $1', [req.params.id]);

    // Supprimer les enregistrements liés
    await client.query('DELETE FROM fbelec.photos          WHERE chantier_id = $1', [req.params.id]);
    await client.query('DELETE FROM fbelec.documents       WHERE chantier_id = $1', [req.params.id]);
    await client.query('DELETE FROM fbelec.notes           WHERE chantier_id = $1', [req.params.id]);
    await client.query('DELETE FROM fbelec.chantier_etapes WHERE chantier_id = $1', [req.params.id]);
    const { rowCount } = await client.query('DELETE FROM fbelec.chantiers WHERE id = $1', [req.params.id]);
    if (!rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Chantier introuvable.' }); }

    await client.query('COMMIT');

    // Supprimer les fichiers physiques (hors transaction)
    for (const { url } of [...photos, ...documents]) {
      if (url && fs.existsSync(url)) {
        try { fs.unlinkSync(url); } catch {}
      }
    }

    res.json({ ok: true });
  } catch (err) { await client.query('ROLLBACK'); next(err); }
  finally { client.release(); }
});

export default router;
