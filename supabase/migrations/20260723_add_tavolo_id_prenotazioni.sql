-- Collega una prenotazione a un tavolo specifico della mappa /tavoli.
-- Nullable: le prenotazioni telefoniche/senza mappa restano valide senza tavolo assegnato.
-- Eseguire nel SQL Editor di Supabase Dashboard.

ALTER TABLE public.prenotazioni
  ADD COLUMN IF NOT EXISTS tavolo_id UUID REFERENCES public.tavoli(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_prenotazioni_tavolo_id ON public.prenotazioni(tavolo_id);
