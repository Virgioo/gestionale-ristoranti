-- Aggiunge slug pubblico univoco a sedi, per pagina di prenotazione diretta /prenota/[slug]
-- Eseguire nel SQL Editor di Supabase Dashboard

ALTER TABLE public.sedi ADD COLUMN IF NOT EXISTS slug TEXT;

-- Backfill: slug derivato dal nome (minuscolo, spazi -> trattini, senza accenti/simboli)
UPDATE public.sedi
SET slug = lower(
  regexp_replace(
    regexp_replace(
      translate(nome, 'àáâäèéêëìíîïòóôöùúûüñç', 'aaaaeeeeiiiiooooouuuunc'),
      '[^a-zA-Z0-9]+', '-', 'g'
    ),
    '(^-+)|(-+$)', '', 'g'
  )
)
WHERE slug IS NULL;

-- Disambigua eventuali slug duplicati aggiungendo un suffisso numerico progressivo
WITH numerati AS (
  SELECT id, slug, row_number() OVER (PARTITION BY slug ORDER BY created_at) AS rn
  FROM public.sedi
)
UPDATE public.sedi s
SET slug = s.slug || '-' || numerati.rn
FROM numerati
WHERE s.id = numerati.id AND numerati.rn > 1;

ALTER TABLE public.sedi ALTER COLUMN slug SET NOT NULL;
ALTER TABLE public.sedi ADD CONSTRAINT sedi_slug_key UNIQUE (slug);

-- Permette lettura pubblica anonima della sede tramite slug (pagina di prenotazione senza login)
DROP POLICY IF EXISTS "sedi_public_select_by_slug" ON public.sedi;
CREATE POLICY "sedi_public_select_by_slug" ON public.sedi
  FOR SELECT TO anon USING (attiva = true);

-- Permette inserimento pubblico anonimo di prenotazioni (form senza login)
DROP POLICY IF EXISTS "prenotazioni_public_insert" ON public.prenotazioni;
CREATE POLICY "prenotazioni_public_insert" ON public.prenotazioni
  FOR INSERT TO anon WITH CHECK (origine = 'web');

ALTER TABLE public.sedi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prenotazioni ENABLE ROW LEVEL SECURITY;
