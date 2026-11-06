-- Point GPS facultatif saisi à la création (remplace l'adresse quand elle n'existe pas encore).
ALTER TABLE fbelec.chantiers ADD COLUMN IF NOT EXISTS gps_lat DOUBLE PRECISION;
ALTER TABLE fbelec.chantiers ADD COLUMN IF NOT EXISTS gps_lng DOUBLE PRECISION;

-- Chantier créé par un client et pas encore ouvert par FB ELEC (badge « Nouveau »).
-- Les chantiers existants sont considérés comme déjà vus (DEFAULT TRUE).
ALTER TABLE fbelec.chantiers ADD COLUMN IF NOT EXISTS vu_admin BOOLEAN NOT NULL DEFAULT TRUE;

-- Le marquage « vu » (vu_admin FALSE → TRUE à l'ouverture par l'admin) ne doit pas modifier
-- updated_at (qui ordonne les listes). La fonction du trigger diffère selon les bases
-- (fbelec.set_updated_at / core.set_updated_at) : on la relit dans le catalogue pour recréer
-- le même trigger avec une clause WHEN. Bloc DO atomique, rejouable.
DO $$
DECLARE fn text;
BEGIN
  SELECT t.tgfoid::regprocedure::text INTO fn
    FROM pg_trigger t
   WHERE t.tgrelid = 'fbelec.chantiers'::regclass AND t.tgname = 'trg_fbelec_chantiers_upd';
  IF fn IS NULL THEN
    RAISE NOTICE 'trg_fbelec_chantiers_upd introuvable : trigger inchangé.';
  ELSE
    EXECUTE 'DROP TRIGGER trg_fbelec_chantiers_upd ON fbelec.chantiers';
    EXECUTE format('CREATE TRIGGER trg_fbelec_chantiers_upd BEFORE UPDATE ON fbelec.chantiers '
      || 'FOR EACH ROW WHEN (OLD.vu_admin IS NOT DISTINCT FROM NEW.vu_admin) EXECUTE PROCEDURE %s', fn);
    RAISE NOTICE 'trg_fbelec_chantiers_upd recréé (fonction %).', fn;
  END IF;
END $$;
