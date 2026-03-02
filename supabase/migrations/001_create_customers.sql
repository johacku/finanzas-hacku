-- Migration 001: customers table
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_cliente TEXT NOT NULL,
  sociedad_cliente TEXT,
  pais TEXT,
  ciudad TEXT,
  industria TEXT,
  kam_responsable TEXT,
  plan_actual TEXT,
  tiene_factoraje BOOLEAN NOT NULL DEFAULT FALSE,
  comentarios_factoraje TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customers_sociedad_cliente ON public.customers(sociedad_cliente);
CREATE INDEX idx_customers_kam ON public.customers(kam_responsable);
CREATE INDEX idx_customers_tiene_factoraje ON public.customers(tiene_factoraje);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_customers"
  ON public.customers FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
