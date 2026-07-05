-- Migrazione avanzata modulo Mappa Tavoli
-- Da eseguire nel SQL Editor di Supabase Dashboard

-- Nuove colonne per SALE
ALTER TABLE public.sale
  ADD COLUMN IF NOT EXISTS colore TEXT NOT NULL DEFAULT '#94a3b8',
  ADD COLUMN IF NOT EXISTS note TEXT,
  ADD COLUMN IF NOT EXISTS larghezza_metri NUMERIC,
  ADD COLUMN IF NOT EXISTS altezza_metri NUMERIC,
  ADD COLUMN IF NOT EXISTS punti_poligono JSONB,
  ADD COLUMN IF NOT EXISTS sfondo_url TEXT;

-- Nuove colonne per TAVOLI
ALTER TABLE public.tavoli
  ADD COLUMN IF NOT EXISTS rotazione NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS capienza_min INT,
  ADD COLUMN IF NOT EXISTS capienza_max INT,
  ADD COLUMN IF NOT EXISTS capienza_evento INT,
  ADD COLUMN IF NOT EXISTS note TEXT,
  ADD COLUMN IF NOT EXISTS accessibile BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nome_cameriere TEXT,
  ADD COLUMN IF NOT EXISTS unione_gruppo TEXT;

-- Nuove colonne per STATO_TAVOLI
ALTER TABLE public.stato_tavoli
  ADD COLUMN IF NOT EXISTS ora_apertura TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cameriere_assegnato TEXT;

-- Verifica
SELECT table_name, column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name IN ('sale','tavoli','stato_tavoli')
ORDER BY table_name, ordinal_position;
