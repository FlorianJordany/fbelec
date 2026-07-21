-- ════════════════════════════════════════════════════════════════
--  Migration : contact de facturation (facultatif) sur les chantiers
--  Idempotente (PostgreSQL 9.6).
--  À lancer sur chaque base :
--    PGPASSWORD='...' psql -h localhost -U <user> -d <base> < db/migrations/2026-07-21_facturation_contact.sql
--
--  Renseignés (facultativement) quand l'adresse de facturation est
--  « différente » à la création d'un chantier.
-- ════════════════════════════════════════════════════════════════
ALTER TABLE fbelec.chantiers
  ADD COLUMN IF NOT EXISTS facturation_telephone text;

ALTER TABLE fbelec.chantiers
  ADD COLUMN IF NOT EXISTS facturation_email text;
