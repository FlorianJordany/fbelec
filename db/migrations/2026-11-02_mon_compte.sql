-- Mon compte. À appliquer AVANT de déployer le backend : les contrôles de session lisent mdp_version.

-- Version du mot de passe : portée par le jeton et incrémentée à chaque changement ; un jeton d'une
-- autre version est refusé. Les jetons déjà émis comptent pour 0 : aucune déconnexion au déploiement.
ALTER TABLE fbelec.clients ADD COLUMN IF NOT EXISTS mdp_version integer DEFAULT 0 NOT NULL;
ALTER TABLE fbelec.admins  ADD COLUMN IF NOT EXISTS mdp_version integer DEFAULT 0 NOT NULL;

-- E-mails enregistrés avec des majuscules par l'ancienne modification FB ELEC : la connexion et le
-- mot de passe oublié cherchent en minuscules, ces comptes ne pouvaient plus se connecter.
UPDATE fbelec.clients SET email = lower(email) WHERE email <> lower(email);
