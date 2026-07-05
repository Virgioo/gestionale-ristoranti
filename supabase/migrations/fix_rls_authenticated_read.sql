-- Abilita RLS + policy SELECT per utenti autenticati su tutte le tabelle del gestionale
-- Da eseguire nel SQL Editor di Supabase Dashboard

-- SEDI
ALTER TABLE public.sedi ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_read_sedi" ON public.sedi;
CREATE POLICY "authenticated_read_sedi"
  ON public.sedi FOR SELECT TO authenticated USING (true);

-- CLIENTI
ALTER TABLE public.clienti ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_read_clienti" ON public.clienti;
CREATE POLICY "authenticated_read_clienti"
  ON public.clienti FOR SELECT TO authenticated USING (true);

-- ANIMALI
ALTER TABLE public.animali ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_read_animali" ON public.animali;
CREATE POLICY "authenticated_read_animali"
  ON public.animali FOR SELECT TO authenticated USING (true);

-- PRENOTAZIONI
ALTER TABLE public.prenotazioni ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_read_prenotazioni" ON public.prenotazioni;
CREATE POLICY "authenticated_read_prenotazioni"
  ON public.prenotazioni FOR SELECT TO authenticated USING (true);

-- VISITE
ALTER TABLE public.visite ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_read_visite" ON public.visite;
CREATE POLICY "authenticated_read_visite"
  ON public.visite FOR SELECT TO authenticated USING (true);

-- CAMPAGNE
ALTER TABLE public.campagne ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_read_campagne" ON public.campagne;
CREATE POLICY "authenticated_read_campagne"
  ON public.campagne FOR SELECT TO authenticated USING (true);

-- NOTE
ALTER TABLE public.note ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_read_note" ON public.note;
CREATE POLICY "authenticated_read_note"
  ON public.note FOR SELECT TO authenticated USING (true);

-- NOTIFICHE
ALTER TABLE public.notifiche ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_read_notifiche" ON public.notifiche;
CREATE POLICY "authenticated_read_notifiche"
  ON public.notifiche FOR SELECT TO authenticated USING (true);

-- Verifica finale
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;
