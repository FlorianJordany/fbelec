-- ════════════════════════════════════════════════════════════════
--  Migration : références optionnelles (chantier créé par un client
--  pour l'un de ses propres clients)
--  Idempotente (PostgreSQL 9.6 : ADD COLUMN IF NOT EXISTS supporté).
--  À lancer sur chaque base :
--    PGPASSWORD='...' psql -h localhost -U <user> -d <base> < db/migrations/2026-06-26_references.sql
--
--  - reference_client      : nom/société du client final (facultatif).
--  - reference_facturation : référence liée à l'adresse de facturation
--    différente (facultatif).
-- ════════════════════════════════════════════════════════════════
ALTER TABLE fbelec.chantiers
  ADD COLUMN IF NOT EXISTS reference_client text;

ALTER TABLE fbelec.chantiers
  ADD COLUMN IF NOT EXISTS reference_facturation text;
