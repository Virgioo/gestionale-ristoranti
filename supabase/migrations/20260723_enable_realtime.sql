-- Abilita Supabase Realtime (postgres_changes) sulle tabelle usate per gli
-- aggiornamenti live in dashboard. Eseguire nel SQL Editor di Supabase Dashboard.
-- Idempotente: sicuro da rieseguire anche se una tabella è già nella publication.

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.prenotazioni;  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.comande;      EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.stato_tavoli; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifiche;    EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.tavoli;       EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
