-- Crea tabelle menu e staff per il gestionale ristorante
-- Da eseguire nel SQL Editor di Supabase Dashboard (una volta sola)

-- ============================================================
-- TABELLA MENU
-- ============================================================
CREATE TABLE IF NOT EXISTS public.menu (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        TEXT         NOT NULL,
  descrizione TEXT,
  prezzo      NUMERIC(10,2) NOT NULL,
  categoria   TEXT         NOT NULL,
  disponibile BOOLEAN      NOT NULL DEFAULT true,
  allergeni   TEXT[],
  adatto_cani BOOLEAN      NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ  DEFAULT now(),
  updated_at  TIMESTAMPTZ  DEFAULT now()
);

ALTER TABLE public.menu ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_menu" ON public.menu;
CREATE POLICY "authenticated_read_menu"
  ON public.menu FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "service_role_all_menu" ON public.menu;
CREATE POLICY "service_role_all_menu"
  ON public.menu FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- TABELLA STAFF
-- ============================================================
CREATE TABLE IF NOT EXISTS public.staff (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       TEXT        NOT NULL,
  cognome    TEXT        NOT NULL,
  ruolo      TEXT        NOT NULL,
  email      TEXT,
  telefono   TEXT,
  attivo     BOOLEAN     NOT NULL DEFAULT true,
  sede_id    UUID        REFERENCES public.sedi(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_staff" ON public.staff;
CREATE POLICY "authenticated_read_staff"
  ON public.staff FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "service_role_all_staff" ON public.staff;
CREATE POLICY "service_role_all_staff"
  ON public.staff FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Verifica
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('menu', 'staff')
ORDER BY table_name;
