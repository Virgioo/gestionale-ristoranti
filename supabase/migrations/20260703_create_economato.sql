-- Modulo Economato
-- Da eseguire nel SQL Editor di Supabase Dashboard

CREATE TABLE IF NOT EXISTS public.categorie_economato (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       TEXT        NOT NULL,
  colore     TEXT        NOT NULL DEFAULT '#94a3b8',
  icona      TEXT        NOT NULL DEFAULT '📦',
  ordine     INT         NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.prodotti_economato (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_id    UUID          REFERENCES public.categorie_economato(id) ON DELETE SET NULL,
  nome            TEXT          NOT NULL,
  unita           TEXT          NOT NULL DEFAULT 'pz',
  qta_attuale     NUMERIC       NOT NULL DEFAULT 0,
  qta_minima      NUMERIC       NOT NULL DEFAULT 0,
  qta_massima     NUMERIC,
  fornitore       TEXT,
  prezzo_unitario NUMERIC(10,2),
  note            TEXT,
  created_at      TIMESTAMPTZ   DEFAULT now(),
  updated_at      TIMESTAMPTZ   DEFAULT now()
);

-- RLS
ALTER TABLE public.categorie_economato ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prodotti_economato  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_cat_eco" ON public.categorie_economato;
DROP POLICY IF EXISTS "authenticated_read_cat_eco" ON public.categorie_economato;
CREATE POLICY "service_role_all_cat_eco"   ON public.categorie_economato FOR ALL    TO service_role  USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_read_cat_eco" ON public.categorie_economato FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "service_role_all_prod_eco" ON public.prodotti_economato;
DROP POLICY IF EXISTS "authenticated_read_prod_eco" ON public.prodotti_economato;
CREATE POLICY "service_role_all_prod_eco"   ON public.prodotti_economato FOR ALL    TO service_role  USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_read_prod_eco" ON public.prodotti_economato FOR SELECT TO authenticated USING (true);

-- Categorie di default
INSERT INTO public.categorie_economato (nome, colore, icona, ordine) VALUES
  ('Vini',        '#7c3aed', '🍷', 1),
  ('Bevande',     '#2563eb', '🥂', 2),
  ('Ingredienti', '#16a34a', '🥩', 3),
  ('Tovagliati',  '#db2777', '🪣', 4),
  ('Accessori',   '#d97706', '🍽️', 5),
  ('Altro',       '#64748b', '📦', 6)
ON CONFLICT DO NOTHING;

-- Verifica
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('categorie_economato','prodotti_economato')
ORDER BY table_name;
