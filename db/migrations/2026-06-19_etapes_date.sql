-- ════════════════════════════════════════════════════════════════
--  Migration : option "date" sur les étapes
--  Idempotente (PostgreSQL 9.6 : ADD COLUMN IF NOT EXISTS supporté).
--  À lancer sur chaque base (dev + prod) :
--    PGPASSWORD='...' psql -h localhost -U <user> -d <base> < db/migrations/2026-06-19_etapes_date.sql
--
--  - ref_etapes.avec_date   : l'étape comporte-t-elle une date à renseigner ?
--  - chantier_etapes.date_valeur : date saisie par l'admin pour ce chantier,
--    affichée au client sur sa timeline.
-- ════════════════════════════════════════════════════════════════
ALTER TABLE fbelec.ref_etapes
  ADD COLUMN IF NOT EXISTS avec_date boolean NOT NULL DEFAULT false;

ALTER TABLE fbelec.chantier_etapes
  ADD COLUMN IF NOT EXISTS date_valeur date;
