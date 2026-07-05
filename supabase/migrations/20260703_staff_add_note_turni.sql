-- Aggiunge colonne note e turni alla tabella staff
-- Da eseguire nel SQL Editor di Supabase Dashboard

ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS turni JSONB;

-- Verifica
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'staff'
ORDER BY ordinal_position;
