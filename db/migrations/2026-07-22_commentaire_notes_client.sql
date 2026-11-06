-- Commentaire libre saisi à l'étape Documents lors de la création d'un chantier.
ALTER TABLE fbelec.chantiers ADD COLUMN IF NOT EXISTS commentaire TEXT;

-- Messages envoyés par le client : stockés dans le fil de notes du chantier,
-- marqués de_client pour les distinguer des messages FB ELEC.
ALTER TABLE fbelec.notes ADD COLUMN IF NOT EXISTS de_client BOOLEAN NOT NULL DEFAULT FALSE;
