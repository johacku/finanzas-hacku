-- =====================================================
-- CONSOLIDATED MIGRATION: hackU Clientes + fecha_factoraje + tipos_documento
-- =====================================================

-- 1. hackU Clientes table
CREATE TABLE IF NOT EXISTS public.hacku_clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hacku_clientes_nombre ON public.hacku_clientes(nombre);

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS hacku_cliente_id UUID REFERENCES public.hacku_clientes(id);

ALTER TABLE public.hacku_clientes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'hacku_clientes' AND policyname = 'auth_all_hacku_clientes') THEN
    CREATE POLICY "auth_all_hacku_clientes" ON public.hacku_clientes FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 2. fecha_factoraje on income_invoices
ALTER TABLE public.income_invoices ADD COLUMN IF NOT EXISTS fecha_factoraje DATE;

-- 3. tipos_documento table (fixed list)
CREATE TABLE IF NOT EXISTS public.tipos_documento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  orden INT NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.tipos_documento ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tipos_documento' AND policyname = 'auth_all_tipos_documento') THEN
    CREATE POLICY "auth_all_tipos_documento" ON public.tipos_documento FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Seed default tipos_documento
INSERT INTO public.tipos_documento (nombre, orden) VALUES
  ('Factura', 1),
  ('Nota Crédito', 2),
  ('Nota Débito', 3),
  ('Cuenta de Cobro', 4),
  ('Recibo', 5),
  ('Comprobante de Egreso', 6),
  ('Orden de Compra', 7),
  ('Contrato', 8),
  ('Otro', 9)
ON CONFLICT (nombre) DO NOTHING;
