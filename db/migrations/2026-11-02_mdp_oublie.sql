-- Mot de passe oublié : le mot de passe temporaire est rangé à part. Le mot de passe actuel reste
-- valable jusqu'à ce que le temporaire serve à se connecter : un tiers qui connaît l'e-mail ne peut
-- plus bloquer le compte. À appliquer AVANT de déployer le backend (la route écrit ces colonnes).
ALTER TABLE fbelec.clients ADD COLUMN IF NOT EXISTS code_provisoire_hash text;
ALTER TABLE fbelec.clients ADD COLUMN IF NOT EXISTS code_provisoire_expire timestamptz;
-- Plafonds par compte sur 24 h : demandes de mot de passe oublié, changements d'e-mail du client.
ALTER TABLE fbelec.clients ADD COLUMN IF NOT EXISTS oubli_nb integer NOT NULL DEFAULT 0;
ALTER TABLE fbelec.clients ADD COLUMN IF NOT EXISTS oubli_depuis timestamptz;
ALTER TABLE fbelec.clients ADD COLUMN IF NOT EXISTS email_modifs integer NOT NULL DEFAULT 0;
ALTER TABLE fbelec.clients ADD COLUMN IF NOT EXISTS email_modifs_depuis timestamptz;
