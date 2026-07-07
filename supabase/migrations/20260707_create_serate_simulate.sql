-- Tabella serate simulate per storico simulazioni e analisi trend
-- Eseguire nel SQL Editor di Supabase Dashboard

CREATE TABLE IF NOT EXISTS public.serate_simulate (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  data                     DATE        NOT NULL DEFAULT CURRENT_DATE,
  giorno_settimana         TEXT        NOT NULL,
  meteo                    TEXT        NOT NULL,
  evento_speciale          TEXT,
  coperti_totali           INTEGER     NOT NULL DEFAULT 0,
  tavoli_serviti           INTEGER     NOT NULL DEFAULT 0,
  no_show                  INTEGER     NOT NULL DEFAULT 0,
  revenue_totale           NUMERIC(10,2) NOT NULL DEFAULT 0,
  tempo_medio_servizio_min INTEGER     NOT NULL DEFAULT 0,
  cameriere_top            TEXT,
  problemi                 JSONB       DEFAULT '[]'::jsonb,
  log_serata               JSONB       DEFAULT '[]'::jsonb,
  created_at               TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.serate_simulate ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_all_serate_simulate" ON public.serate_simulate;
CREATE POLICY "authenticated_all_serate_simulate"
  ON public.serate_simulate FOR ALL TO authenticated USING (true) WITH CHECK (true);
