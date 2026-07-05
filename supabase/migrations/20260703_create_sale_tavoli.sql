-- Tabelle per il modulo Mappa Tavoli
-- Da eseguire nel SQL Editor di Supabase Dashboard

CREATE TABLE IF NOT EXISTS public.sale (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       TEXT        NOT NULL,
  sede_id    UUID        REFERENCES public.sedi(id) ON DELETE SET NULL,
  ordine     INT         NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tavoli (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sala_id    UUID        NOT NULL REFERENCES public.sale(id) ON DELETE CASCADE,
  nome       TEXT        NOT NULL,
  forma      TEXT        NOT NULL DEFAULT 'rettangolare',
  capienza   INT         NOT NULL DEFAULT 4,
  pos_x      NUMERIC     NOT NULL DEFAULT 100,
  pos_y      NUMERIC     NOT NULL DEFAULT 100,
  larghezza  NUMERIC     NOT NULL DEFAULT 110,
  altezza    NUMERIC     NOT NULL DEFAULT 80,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stato_tavoli (
  tavolo_id          UUID        PRIMARY KEY REFERENCES public.tavoli(id) ON DELETE CASCADE,
  stato              TEXT        NOT NULL DEFAULT 'libero',
  note               TEXT,
  coperti_effettivi  INT,
  aggiornato_at      TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.sale         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tavoli       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stato_tavoli ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_sale"   ON public.sale;
DROP POLICY IF EXISTS "authenticated_read_sale" ON public.sale;
CREATE POLICY "service_role_all_sale"   ON public.sale FOR ALL       TO service_role  USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_read_sale" ON public.sale FOR SELECT    TO authenticated USING (true);

DROP POLICY IF EXISTS "service_role_all_tavoli"   ON public.tavoli;
DROP POLICY IF EXISTS "authenticated_read_tavoli" ON public.tavoli;
CREATE POLICY "service_role_all_tavoli"   ON public.tavoli FOR ALL    TO service_role  USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_read_tavoli" ON public.tavoli FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "service_role_all_stato"   ON public.stato_tavoli;
DROP POLICY IF EXISTS "authenticated_read_stato" ON public.stato_tavoli;
CREATE POLICY "service_role_all_stato"   ON public.stato_tavoli FOR ALL    TO service_role  USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_read_stato" ON public.stato_tavoli FOR SELECT TO authenticated USING (true);

-- Verifica
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('sale','tavoli','stato_tavoli')
ORDER BY table_name;
