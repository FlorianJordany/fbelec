import { pool } from '../db.js';

export const INT_MAX = 2147483647; // borne du type integer PostgreSQL

// Collègues abonnés aux notifications d'un chantier (choisis par le créateur, l'admin de la
// société ou FB ELEC), actifs et toujours membres de la société du propriétaire. exclure : ids
// déjà prévenus autrement (propriétaire, auteur de l'action).
export async function destinatairesAbonnes(chantierId, exclure = []) {
  const { rows } = await pool.query(
    `SELECT m.id, m.nom, m.email
       FROM fbelec.chantier_abonnes a
       JOIN fbelec.chantiers c ON c.id = a.chantier_id
       JOIN fbelec.clients p ON p.id = c.client_id
       JOIN fbelec.clients m ON m.id = a.client_id
      WHERE a.chantier_id = $1 AND m.actif = TRUE AND m.societe_id = p.societe_id
        AND m.id <> ALL($2::int[])`,
    [chantierId, exclure.map(Number).filter(Number.isInteger)]
  );
  return rows;
}

// Membres actifs de la société du propriétaire, avec leur abonnement (écran de gestion).
// Vide si le propriétaire n'est rattaché à aucune société.
export async function membresAbonnes(chantierId, proprietaireId) {
  const { rows } = await pool.query(
    `SELECT m.id, m.nom, m.email, (a.client_id IS NOT NULL) AS abonne
       FROM fbelec.clients p
       JOIN fbelec.clients m ON m.societe_id = p.societe_id AND m.actif = TRUE
       LEFT JOIN fbelec.chantier_abonnes a ON a.chantier_id = $2 AND a.client_id = m.id
      WHERE p.id = $1
      ORDER BY m.nom`,
    [proprietaireId, chantierId]
  );
  return rows.map(m => ({ ...m, proprietaire: m.id === proprietaireId }));
}

// Corps { client_ids: [entiers] } → liste dédupliquée, ou null si invalide.
export function lireClientIds(body) {
  const ids = body?.client_ids;
  if (!Array.isArray(ids) || ids.length > 500 || !ids.every(v => Number.isInteger(v) && v > 0 && v <= INT_MAX)) {
    return null;
  }
  return [...new Set(ids)];
}

// Remplace la liste des abonnés du chantier. Uniquement des membres actifs de la société du
// propriétaire, hors propriétaire (toujours notifié). Renvoie false si la liste est refusée.
export async function remplacerAbonnes(chantierId, proprietaireId, societeId, ids) {
  const { rows: valides } = await pool.query(
    'SELECT id FROM fbelec.clients WHERE id = ANY($1::int[]) AND societe_id = $2 AND actif = TRUE AND id <> $3',
    [ids, societeId, proprietaireId]
  );
  if (valides.length !== ids.length) return false;
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    // Verrou : deux enregistrements simultanés de la liste s'exécutent l'un après l'autre.
    await db.query('SELECT 1 FROM fbelec.chantiers WHERE id = $1 FOR NO KEY UPDATE', [chantierId]);
    await db.query('DELETE FROM fbelec.chantier_abonnes WHERE chantier_id = $1', [chantierId]);
    if (ids.length) {
      await db.query(
        'INSERT INTO fbelec.chantier_abonnes (chantier_id, client_id) SELECT $1, unnest($2::int[])',
        [chantierId, ids]
      );
    }
    await db.query('COMMIT');
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  } finally { db.release(); }
  return true;
}
