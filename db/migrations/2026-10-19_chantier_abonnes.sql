-- Collaborateurs d'une société abonnés aux notifications d'un chantier (choisis par l'admin
-- de la société, chantier par chantier). Un abonné consulte le chantier en lecture seule.
CREATE TABLE IF NOT EXISTS fbelec.chantier_abonnes (
  chantier_id integer NOT NULL REFERENCES fbelec.chantiers(id) ON DELETE CASCADE,
  client_id   integer NOT NULL REFERENCES fbelec.clients(id)   ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (chantier_id, client_id)
);
CREATE INDEX IF NOT EXISTS chantier_abonnes_client_idx ON fbelec.chantier_abonnes (client_id);

-- Le rôle société « suivi » est abandonné : les comptes concernés redeviennent « basic ».
UPDATE fbelec.clients SET role_societe = 'basic' WHERE role_societe = 'suivi';
