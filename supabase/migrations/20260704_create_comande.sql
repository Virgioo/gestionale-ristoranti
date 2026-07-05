-- Adatta tabella comande esistente
-- Usa ALTER TABLE ADD COLUMN IF NOT EXISTS — non ricrea nulla
-- Eseguire nel SQL Editor di Supabase Dashboard

-- 1. Rendi sede_id nullable (le comande offline non hanno sempre una sede nota)
ALTER TABLE public.comande
  ALTER COLUMN sede_id DROP NOT NULL;

-- 2. Aggiungi colonne mancanti
ALTER TABLE public.comande
  ADD COLUMN IF NOT EXISTS tavolo_id     UUID,
  ADD COLUMN IF NOT EXISTS tavolo_nome   TEXT,
  ADD COLUMN IF NOT EXISTS cameriere     TEXT,
  ADD COLUMN IF NOT EXISTS note          TEXT,
  ADD COLUMN IF NOT EXISTS totale        NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS righe         JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS inviata_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completata_at TIMESTAMPTZ;

-- 3. RLS
ALTER TABLE public.comande ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_comande" ON public.comande;
DROP POLICY IF EXISTS "authenticated_all_comande" ON public.comande;
CREATE POLICY "service_role_all_comande"  ON public.comande FOR ALL TO service_role  USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all_comande" ON public.comande FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Indici utili (IF NOT EXISTS — sicuri da rieseguire)
CREATE INDEX IF NOT EXISTS idx_comande_stato      ON public.comande(stato);
CREATE INDEX IF NOT EXISTS idx_comande_created_at ON public.comande(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comande_tavolo_id  ON public.comande(tavolo_id);
