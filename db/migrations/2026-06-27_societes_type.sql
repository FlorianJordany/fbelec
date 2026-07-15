-- ════════════════════════════════════════════════════════════════
--  Migration : sociétés + rôles clients + type de courant
--  Idempotente (PostgreSQL 9.6).
--  À lancer sur chaque base :
--    PGPASSWORD='...' psql -h localhost -U <user> -d <base> < db/migrations/2026-06-27_societes_type.sql
--
--  - societes             : sociétés créées par l'admin FB ELEC.
--  - clients.societe_id   : rattachement facultatif d'un compte à une société.
--  - clients.role_societe : 'basic' (voit ses propres chantiers) ou
--                           'admin' (voit tous les chantiers de sa société).
--                           Validé côté backend (pas de CHECK : simplicité 9.6).
--  - chantiers.puissance_type : 'monophase' | 'triphase' (obligatoire à la
--                           création, validé backend ; NULL sur l'existant).
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS fbelec.societes (
  id         serial PRIMARY KEY,
  nom        text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_fbelec_societes_upd') THEN
    CREATE TRIGGER trg_fbelec_societes_upd BEFORE UPDATE ON fbelec.societes
      FOR EACH ROW EXECUTE PROCEDURE fbelec.set_updated_at();
  END IF;
END $$;

ALTER TABLE fbelec.clients
  ADD COLUMN IF NOT EXISTS societe_id integer REFERENCES fbelec.societes(id) ON DELETE SET NULL;

ALTER TABLE fbelec.clients
  ADD COLUMN IF NOT EXISTS role_societe text DEFAULT 'basic' NOT NULL;

ALTER TABLE fbelec.chantiers
  ADD COLUMN IF NOT EXISTS puissance_type text;
