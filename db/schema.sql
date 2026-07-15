-- ════════════════════════════════════════════════════════════════
--  FB ELEC — Suivi de chantier · Schéma PostgreSQL (v2, prêt o2switch)
--  ----------------------------------------------------------------
--  Compatible PostgreSQL ancien (o2switch) : colonnes `serial`,
--  triggers en `EXECUTE PROCEDURE`. Issu du pg_dump d'origine,
--  converti en UTF-8 et nettoyé des dépendances au schéma « core ».
--
--  Import (réinitialise le schéma fbelec) :
--    PGPASSWORD='...' psql -h localhost -U <user> -d <base> < db/schema.sql
-- ════════════════════════════════════════════════════════════════

-- Repart d'un schéma propre (⚠️ supprime tout le contenu fbelec existant)
DROP SCHEMA IF EXISTS fbelec CASCADE;
CREATE SCHEMA fbelec;

-- ── Fonction updated_at (anciennement core.set_updated_at) ──────
CREATE FUNCTION fbelec.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- ── Types énumérés ──────────────────────────────────────────────
CREATE TYPE fbelec.etat_etape AS ENUM ('done','current','future','blocked','na');

CREATE TYPE fbelec.statut_chantier AS ENUM (
  'prepa','attente','etude','planifie','service','alimente',
  'resiliation','depose','cloture','action','bloque'
);

CREATE TYPE fbelec.statut_document AS ENUM ('attente','recu','valide');

-- ════════════════════════════════════════════════════════════════
--  Tables
-- ════════════════════════════════════════════════════════════════

CREATE TABLE fbelec.admins (
  id            serial PRIMARY KEY,
  nom           text NOT NULL,
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  actif         boolean DEFAULT true NOT NULL,
  created_at    timestamptz DEFAULT now() NOT NULL,
  updated_at    timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE fbelec.societes (
  id         serial PRIMARY KEY,
  nom        text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE fbelec.clients (
  id               serial PRIMARY KEY,
  nom              text NOT NULL,
  email            text NOT NULL UNIQUE,
  code_suivi_hash  text NOT NULL,
  pdl              character(14),
  telephone        text,
  actif            boolean DEFAULT true NOT NULL,
  must_change_code boolean DEFAULT false NOT NULL,
  societe_id       integer REFERENCES fbelec.societes(id) ON DELETE SET NULL,
  role_societe     text DEFAULT 'basic' NOT NULL,
  created_at       timestamptz DEFAULT now() NOT NULL,
  updated_at       timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX clients_email_idx ON fbelec.clients (email);
CREATE INDEX clients_pdl_idx ON fbelec.clients (pdl) WHERE (pdl IS NOT NULL);

CREATE TABLE fbelec.ref_etapes (
  id         serial PRIMARY KEY,
  label      text NOT NULL,
  sous_texte text,
  ordre      smallint DEFAULT 0 NOT NULL,
  actif      boolean DEFAULT true NOT NULL,
  avec_date  boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX ref_etapes_ordre_idx ON fbelec.ref_etapes (ordre) WHERE (actif = true);

CREATE TABLE fbelec.chantiers (
  id                     serial PRIMARY KEY,
  client_id              integer NOT NULL REFERENCES fbelec.clients(id) ON DELETE RESTRICT,
  reference              text NOT NULL UNIQUE,
  nom                    text NOT NULL,
  adresse                text NOT NULL,
  commune                text NOT NULL,
  code_postal            character(5),
  type_prestation        text,
  statut                 fbelec.statut_chantier DEFAULT 'prepa' NOT NULL,
  resume                 text,
  prochaine_action       text,
  prochaine_action_qui   text,
  prochaine_action_date  text,
  action_requise_titre   text,
  action_requise_texte   text,
  action_requise_cta     text,
  derniere_maj           text,
  enedis_ref_affaire     text,
  enedis_delivery_id     text,
  enedis_contrat         text,
  enedis_pdl             character(14),
  enedis_type_prestation text,
  enedis_delivery_status text,
  enedis_date_demande    date,
  enedis_date_etude      date,
  enedis_date_travaux    date,
  enedis_lat             numeric(9,6),
  enedis_lng             numeric(9,6),
  enedis_point_arret     text,
  actif                  boolean DEFAULT true NOT NULL,
  archive                boolean DEFAULT false NOT NULL,
  created_at             timestamptz DEFAULT now() NOT NULL,
  updated_at             timestamptz DEFAULT now() NOT NULL,
  adresse_facturation    text,
  puissance_demandee     text,
  puissance_type         text,
  date_debut_chantier    date,
  duree_chantier         text,
  terrain_viabilise      boolean,
  reference_client       text,
  reference_facturation  text,
  cree_par_client        boolean DEFAULT false NOT NULL
);
CREATE INDEX chantiers_client_id_idx ON fbelec.chantiers (client_id);
CREATE INDEX chantiers_statut_idx ON fbelec.chantiers (statut);

CREATE TABLE fbelec.chantier_etapes (
  id          serial PRIMARY KEY,
  chantier_id integer NOT NULL REFERENCES fbelec.chantiers(id) ON DELETE CASCADE,
  etape_id    integer NOT NULL REFERENCES fbelec.ref_etapes(id),
  etat        fbelec.etat_etape DEFAULT 'future' NOT NULL,
  note_admin  text,
  masquee     boolean DEFAULT false NOT NULL,
  date_valeur date,
  updated_at  timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT chantier_etapes_chantier_id_etape_id_key UNIQUE (chantier_id, etape_id)
);
CREATE INDEX chantier_etapes_chantier_id_idx ON fbelec.chantier_etapes (chantier_id);

CREATE TABLE fbelec.documents (
  id             serial PRIMARY KEY,
  chantier_id    integer NOT NULL REFERENCES fbelec.chantiers(id) ON DELETE CASCADE,
  nom            text NOT NULL,
  type_fichier   text DEFAULT 'PDF' NOT NULL,
  url            text,
  statut         fbelec.statut_document DEFAULT 'attente' NOT NULL,
  visible_client boolean DEFAULT true NOT NULL,
  date_document  date,
  ordre          smallint DEFAULT 0 NOT NULL,
  created_at     timestamptz DEFAULT now() NOT NULL,
  updated_at     timestamptz DEFAULT now() NOT NULL,
  categorie      text
);
CREATE INDEX documents_chantier_id_idx ON fbelec.documents (chantier_id);

CREATE TABLE fbelec.photos (
  id             serial PRIMARY KEY,
  chantier_id    integer NOT NULL REFERENCES fbelec.chantiers(id) ON DELETE CASCADE,
  etape_id       integer REFERENCES fbelec.ref_etapes(id) ON DELETE SET NULL,
  url            text NOT NULL,
  nom_fichier    text,
  legende        text,
  pair           text,
  visible_client boolean DEFAULT true NOT NULL,
  date_photo     date,
  ordre          smallint DEFAULT 0 NOT NULL,
  created_at     timestamptz DEFAULT now() NOT NULL,
  updated_at     timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT photos_pair_check CHECK ((pair = ANY (ARRAY['avant'::text, 'apres'::text])))
);
CREATE INDEX photos_chantier_id_visible_client_ordre_idx
  ON fbelec.photos (chantier_id, visible_client, ordre);

CREATE TABLE fbelec.notes (
  id             serial PRIMARY KEY,
  chantier_id    integer NOT NULL REFERENCES fbelec.chantiers(id) ON DELETE CASCADE,
  admin_id       integer REFERENCES fbelec.admins(id) ON DELETE SET NULL,
  auteur         text DEFAULT 'Franck Bordier' NOT NULL,
  texte          text NOT NULL,
  visible_client boolean DEFAULT true NOT NULL,
  date_affichee  text,
  created_at     timestamptz DEFAULT now() NOT NULL,
  updated_at     timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX notes_chantier_id_created_at_idx ON fbelec.notes (chantier_id, created_at DESC);

-- ════════════════════════════════════════════════════════════════
--  Fonctions métier
-- ════════════════════════════════════════════════════════════════

-- Marque l'étape cible "current", les précédentes "done", les suivantes "future".
CREATE FUNCTION fbelec.avancer_chantier(p_chantier_id integer, p_etape_id integer) RETURNS void
  LANGUAGE plpgsql AS $$
DECLARE
  v_ordre SMALLINT;
BEGIN
  SELECT ordre INTO v_ordre FROM fbelec.ref_etapes WHERE id = p_etape_id;

  UPDATE fbelec.chantier_etapes ce
  SET etat = 'done'
  FROM fbelec.ref_etapes re
  WHERE ce.etape_id = re.id
    AND ce.chantier_id = p_chantier_id
    AND re.ordre < v_ordre
    AND ce.etat <> 'na';

  UPDATE fbelec.chantier_etapes
  SET etat = 'current'
  WHERE chantier_id = p_chantier_id AND etape_id = p_etape_id;

  UPDATE fbelec.chantier_etapes ce
  SET etat = 'future'
  FROM fbelec.ref_etapes re
  WHERE ce.etape_id = re.id
    AND ce.chantier_id = p_chantier_id
    AND re.ordre > v_ordre
    AND ce.etat NOT IN ('na','blocked');
END;
$$;

-- Initialise les étapes d'un nouveau chantier (toutes en 'future').
CREATE FUNCTION fbelec.init_etapes(p_chantier_id integer) RETURNS void
  LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO fbelec.chantier_etapes (chantier_id, etape_id, etat)
  SELECT p_chantier_id, re.id, 'future'
  FROM fbelec.ref_etapes re
  WHERE re.actif = TRUE
  ON CONFLICT (chantier_id, etape_id) DO NOTHING;
END;
$$;

-- Propage une nouvelle étape de référentiel à tous les chantiers actifs.
CREATE FUNCTION fbelec.propager_etape(p_etape_id integer) RETURNS void
  LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO fbelec.chantier_etapes (chantier_id, etape_id, etat)
  SELECT c.id, p_etape_id, 'future'
  FROM fbelec.chantiers c
  WHERE c.actif = TRUE
  ON CONFLICT (chantier_id, etape_id) DO NOTHING;
END;
$$;

-- ════════════════════════════════════════════════════════════════
--  Triggers updated_at  (EXECUTE PROCEDURE = compatible toutes versions)
-- ════════════════════════════════════════════════════════════════
CREATE TRIGGER trg_fbelec_admins_upd     BEFORE UPDATE ON fbelec.admins          FOR EACH ROW EXECUTE PROCEDURE fbelec.set_updated_at();
CREATE TRIGGER trg_fbelec_societes_upd   BEFORE UPDATE ON fbelec.societes        FOR EACH ROW EXECUTE PROCEDURE fbelec.set_updated_at();
CREATE TRIGGER trg_fbelec_clients_upd    BEFORE UPDATE ON fbelec.clients         FOR EACH ROW EXECUTE PROCEDURE fbelec.set_updated_at();
CREATE TRIGGER trg_fbelec_ref_etapes_upd BEFORE UPDATE ON fbelec.ref_etapes      FOR EACH ROW EXECUTE PROCEDURE fbelec.set_updated_at();
CREATE TRIGGER trg_fbelec_chantiers_upd  BEFORE UPDATE ON fbelec.chantiers       FOR EACH ROW EXECUTE PROCEDURE fbelec.set_updated_at();
CREATE TRIGGER trg_fbelec_etapes_upd     BEFORE UPDATE ON fbelec.chantier_etapes FOR EACH ROW EXECUTE PROCEDURE fbelec.set_updated_at();
CREATE TRIGGER trg_fbelec_documents_upd  BEFORE UPDATE ON fbelec.documents       FOR EACH ROW EXECUTE PROCEDURE fbelec.set_updated_at();
CREATE TRIGGER trg_fbelec_photos_upd     BEFORE UPDATE ON fbelec.photos          FOR EACH ROW EXECUTE PROCEDURE fbelec.set_updated_at();
CREATE TRIGGER trg_fbelec_notes_upd      BEFORE UPDATE ON fbelec.notes           FOR EACH ROW EXECUTE PROCEDURE fbelec.set_updated_at();

-- ════════════════════════════════════════════════════════════════
--  Données de départ
-- ════════════════════════════════════════════════════════════════

-- Référentiel d'étapes par défaut (à ajuster selon le métier).
INSERT INTO fbelec.ref_etapes (label, sous_texte, ordre) VALUES
  ('Dossier reçu',           'Réception de votre demande',       10),
  ('Étude technique',        'Analyse du raccordement',          20),
  ('Demande Enedis déposée', 'Transmission du dossier à Enedis', 30),
  ('Validation Enedis',      'Accord de raccordement',           40),
  ('Travaux planifiés',      'Date d''intervention fixée',       50),
  ('Mise en service',        'Raccordement réalisé',             60);

-- Compte administrateur initial.
-- Générer le hash : node -e "console.log(require('bcryptjs').hashSync('VOTRE_MDP',12))"
-- INSERT INTO fbelec.admins (nom, email, password_hash)
-- VALUES ('Franck Bordier', 'contact@fbelec.fr', '$2a$12$REMPLACER_PAR_LE_HASH');
