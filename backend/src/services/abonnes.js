import { pool } from '../db.js';

// Collègues abonnés aux notifications d'un chantier (choisis par l'admin de la société),
// actifs et toujours membres de la société du propriétaire. exclure : ids déjà prévenus
// autrement (propriétaire, auteur de l'action).
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
