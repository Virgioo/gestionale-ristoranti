-- Abilita Supabase Realtime (postgres_changes) sulle tabelle usate per gli
-- aggiornamenti live in dashboard. Eseguire nel SQL Editor di Supabase Dashboard.
-- Idempotente: sicuro da rieseguire anche se una tabella è già nella publication
-- (ogni ALTER PUBLICATION è isolato nel proprio blocco DO, così un eventuale
-- errore su una tabella non blocca le altre).

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.prenotazioni;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.comande;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.stato_tavoli;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifiche;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.tavoli;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
