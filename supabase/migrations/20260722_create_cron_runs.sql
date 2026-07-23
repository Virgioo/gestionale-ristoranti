-- Storico esecuzioni del cron giornaliero di auto-seed (/api/cron/daily-seed)
-- Eseguire nel SQL Editor di Supabase Dashboard

CREATE TABLE IF NOT EXISTS public.cron_runs (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  data                  DATE          NOT NULL DEFAULT CURRENT_DATE,
  giorno_settimana      TEXT          NOT NULL,
  stagione              TEXT          NOT NULL,
  trigger               TEXT          NOT NULL DEFAULT 'cron',
  prenotazioni_inserite INTEGER       NOT NULL DEFAULT 0,
  no_show_aggiornati    INTEGER       NOT NULL DEFAULT 0,
  visite_inserite       INTEGER       NOT NULL DEFAULT 0,
  revenue_aggiunto      NUMERIC(10,2) NOT NULL DEFAULT 0,
  notifiche_generate    INTEGER       NOT NULL DEFAULT 0,
  log                   JSONB         DEFAULT '[]'::jsonb,
  created_at            TIMESTAMPTZ   DEFAULT NOW()
);

ALTER TABLE public.cron_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_all_cron_runs" ON public.cron_runs;
CREATE POLICY "authenticated_all_cron_runs"
  ON public.cron_runs FOR ALL TO authenticated USING (true) WITH CHECK (true);
