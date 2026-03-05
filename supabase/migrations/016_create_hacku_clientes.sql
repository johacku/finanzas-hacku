-- hackU Clientes table: 1 hackU cliente can have N customers (sociedades)
CREATE TABLE IF NOT EXISTS public.hacku_clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for name lookups
CREATE INDEX IF NOT EXISTS idx_hacku_clientes_nombre ON public.hacku_clientes(nombre);

-- Add FK reference from customers to hacku_clientes
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS hacku_cliente_id UUID REFERENCES public.hacku_clientes(id);

-- RLS
ALTER TABLE public.hacku_clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_hacku_clientes" ON public.hacku_clientes
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
