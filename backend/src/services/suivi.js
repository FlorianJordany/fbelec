import { pool } from '../db.js';

// Comptes « suivi » actifs de la société du propriétaire du chantier, à notifier par e-mail
// de tout ce qui arrive sur les chantiers de la société. exclure : ids déjà prévenus
// autrement (propriétaire, auteur de l'action).
export async function destinatairesSuivi(chantierId, exclure = []) {
  const { rows } = await pool.query(
    `SELECT s.id, s.nom, s.email
       FROM fbelec.chantiers c
       JOIN fbelec.clients p ON p.id = c.client_id
       JOIN fbelec.clients s ON s.societe_id = p.societe_id
      WHERE c.id = $1 AND p.societe_id IS NOT NULL
        AND s.role_societe = 'suivi' AND s.actif = TRUE
        AND s.id <> ALL($2::int[])`,
    [chantierId, exclure.map(Number).filter(Number.isInteger)]
  );
  return rows;
}
