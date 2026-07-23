-- Aggiunge il valore 'scorte_basse' all'enum tipo_notifica, usato dal cron
-- giornaliero (/api/cron/daily-seed) per gli alert di economato sotto scorta minima.
-- Eseguire nel SQL Editor di Supabase Dashboard (fuori da una transazione esplicita).

ALTER TYPE public.tipo_notifica ADD VALUE IF NOT EXISTS 'scorte_basse';
