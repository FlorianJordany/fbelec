import { Router } from 'express';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { pool } from '../../db.js';
import { uploadPhotos, toPublicUrl } from '../../middleware/upload.js';

const router = Router();

// Compression optimisée : max 1600px, qualité 82%, toujours JPEG
async function compressImage(inputPath, outputPath) {
  await sharp(inputPath)
    .rotate()                        // respecte l'orientation EXIF
    .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82, progressive: true, mozjpeg: true })
    .toFile(outputPath);
}

// POST /api/admin/chantiers/:id/photos
router.post('/chantiers/:id/photos', uploadPhotos.array('photos', 10), async (req, res, next) => {
  try {
    if (!req.files?.length) return res.status(400).json({ error: 'Aucun fichier reçu.' });
    const chantierId = parseInt(req.params.id);
    const { legende, etape_id, pair, date_photo, visible_client = 'true' } = req.body;
    const inserted = [];

    for (const file of req.files) {
      const jpgPath = file.path.replace(/\.[^.]+$/, '.jpg');
      const tmpPath = file.path + '.tmp.jpg';

      try {
        await compressImage(file.path, tmpPath);
        // Supprimer l'original, renommer le compressé
        fs.unlinkSync(file.path);
        fs.renameSync(tmpPath, jpgPath);
      } catch (sharpErr) {
        // Si sharp échoue (format inconnu), garder l'original
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
        console.error('[photos] Compression échouée:', sharpErr.message);
      }

      const finalPath = fs.existsSync(jpgPath) ? jpgPath : file.path;

      const { rows: [photo] } = await pool.query(
        `INSERT INTO fbelec.photos (chantier_id, etape_id, url, nom_fichier, legende, pair, visible_client, date_photo)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [chantierId, etape_id ? parseInt(etape_id) : null, finalPath,
         file.originalname, legende || null, pair || null, visible_client !== 'false', date_photo || null]
      );
      inserted.push({ ...photo, url: toPublicUrl(photo.url) });
    }
    res.status(201).json(inserted);
  } catch (err) { next(err); }
});

// PUT /api/admin/photos/:id
router.put('/:id', async (req, res, next) => {
  try {
    const { legende, etape_id, pair, visible_client, date_photo, ordre } = req.body;
    const { rows: [photo] } = await pool.query(
      `UPDATE fbelec.photos
       SET legende = COALESCE($1,legende), etape_id = COALESCE($2,etape_id),
           pair = COALESCE($3,pair), visible_client = COALESCE($4,visible_client),
           date_photo = COALESCE($5,date_photo), ordre = COALESCE($6,ordre)
       WHERE id = $7 RETURNING *`,
      [legende, etape_id, pair, visible_client, date_photo, ordre, req.params.id]
    );
    if (!photo) return res.status(404).json({ error: 'Photo introuvable.' });
    res.json({ ...photo, url: toPublicUrl(photo.url) });
  } catch (err) { next(err); }
});

// DELETE /api/admin/photos/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { rows: [photo] } = await pool.query(
      'DELETE FROM fbelec.photos WHERE id = $1 RETURNING url', [req.params.id]
    );
    if (!photo) return res.status(404).json({ error: 'Photo introuvable.' });
    if (photo.url && fs.existsSync(photo.url)) fs.unlinkSync(photo.url);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
