-- ════════════════════════════════════════════════════════════════
--  Migration : champ "Terrain viabilisé" (Oui/Non) sur les chantiers
--  Idempotente (PostgreSQL 9.6 : ADD COLUMN IF NOT EXISTS supporté).
--  À lancer sur chaque base (dev + prod) :
--    PGPASSWORD='...' psql -h localhost -U <user> -d <base> < db/migrations/2026-06-26_terrain_viabilise.sql
--
--  Nullable : les chantiers existants restent NULL (= non renseigné).
--  Le caractère obligatoire est imposé à la CRÉATION (front + back).
-- ════════════════════════════════════════════════════════════════
ALTER TABLE fbelec.chantiers
  ADD COLUMN IF NOT EXISTS terrain_viabilise boolean;
