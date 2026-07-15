-- ════════════════════════════════════════════════════════════════
--  Migration : archivage des chantiers
--  Idempotente (PostgreSQL 9.6 : ADD COLUMN IF NOT EXISTS supporté).
--  À lancer sur chaque base (dev + prod) :
--    PGPASSWORD='...' psql -h localhost -U <user> -d <base> < db/migrations/2026-06-19_archive_chantiers.sql
--
--  Sémantique :
--   - archive = FALSE → chantier "en cours" (listes par défaut).
--   - archive = TRUE  → chantier archivé : retiré des listes en cours,
--     mais toujours consultable (section "Archivés", admin ET client).
--   - distinct de `actif` (actif=FALSE bloque tout accès client).
-- ════════════════════════════════════════════════════════════════
ALTER TABLE fbelec.chantiers
  ADD COLUMN IF NOT EXISTS archive boolean NOT NULL DEFAULT false;
