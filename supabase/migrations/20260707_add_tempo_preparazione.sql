-- Aggiunge tempo_preparazione_minuti alla tabella menu
-- Eseguire nel SQL Editor di Supabase Dashboard

-- 1. Colonna con default 10 minuti
ALTER TABLE public.menu
  ADD COLUMN IF NOT EXISTS tempo_preparazione_minuti INTEGER DEFAULT 10;

-- 2. Tempi realistici per categoria
UPDATE public.menu SET tempo_preparazione_minuti = CASE
  WHEN categoria = 'antipasti'  THEN (8  + floor(random() * 5))::int   -- 8-12 min
  WHEN categoria = 'primi'      THEN (12 + floor(random() * 7))::int   -- 12-18 min
  WHEN categoria = 'secondi'    THEN (15 + floor(random() * 11))::int  -- 15-25 min
  WHEN categoria = 'dolci'      THEN (5  + floor(random() * 4))::int   -- 5-8 min
  WHEN categoria = 'bevande'    THEN 2
  WHEN categoria = 'vini'       THEN 2
  WHEN categoria = 'menu_cani'  THEN 5
  ELSE 10
END;

-- 3. RLS: permette ai client autenticati di leggere e aggiornare
DROP POLICY IF EXISTS "authenticated_all_menu" ON public.menu;
CREATE POLICY "authenticated_all_menu"
  ON public.menu FOR ALL TO authenticated USING (true) WITH CHECK (true);
