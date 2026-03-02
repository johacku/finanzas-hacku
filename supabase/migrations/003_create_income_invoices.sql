-- Migration 003: income_invoices + shared enums + trigger function
CREATE TYPE public.sociedad_enum AS ENUM (
  'hackÜ SAS',
  'hackÜ LLC',
  'hackÜ MEX',
  'hackÜ PER',
  'hackÜ BRA'
);

CREATE TYPE public.invoice_estado AS ENUM (
  'Pagada',
  'Pendiente',
  'Anulada',
  'Vencida'
);

CREATE TYPE public.moneda_enum AS ENUM (
  'COP',
  'USD',
  'MXN',
  'BRL',
  'EUR'
);

-- Shared updated_at trigger function (used by all tables with updated_at)
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE public.income_invoices (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sociedad                  public.sociedad_enum NOT NULL,
  razon_social_cliente      TEXT NOT NULL,
  hacku_cliente             TEXT,
  tipo_documento            TEXT,
  numero_documento          TEXT,
  estado                    public.invoice_estado NOT NULL DEFAULT 'Pendiente',
  moneda                    public.moneda_enum NOT NULL,
  fecha_creacion            DATE NOT NULL,
  fecha_vencimiento         DATE NOT NULL,
  dia_pago_cliente          INTEGER NOT NULL DEFAULT 0,
  dia_adelanto_factoraje    INTEGER,
  tiene_factoraje           BOOLEAN NOT NULL DEFAULT FALSE,
  monto_no_recurrente       NUMERIC(18, 2) NOT NULL DEFAULT 0,
  monto_creacion_contenido  NUMERIC(18, 2) NOT NULL DEFAULT 0,
  monto_recurrente          NUMERIC(18, 2) NOT NULL DEFAULT 0,
  total_moneda_local        NUMERIC(18, 2)
    GENERATED ALWAYS AS (
      monto_no_recurrente + monto_creacion_contenido + monto_recurrente
    ) STORED,
  total_usd                 NUMERIC(18, 2),
  meses_causados            INTEGER,
  fecha_inicio_causacion    DATE,
  fecha_fin_causacion       DATE,
  vendedor                  TEXT,
  porcentaje_comision       NUMERIC(5, 2),
  comision_aliado           BOOLEAN NOT NULL DEFAULT FALSE,
  porcentaje_comision_aliado NUMERIC(5, 2),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_income_invoices_fecha_vencimiento ON public.income_invoices(fecha_vencimiento);
CREATE INDEX idx_income_invoices_sociedad ON public.income_invoices(sociedad);
CREATE INDEX idx_income_invoices_estado ON public.income_invoices(estado);
CREATE INDEX idx_income_invoices_moneda ON public.income_invoices(moneda);
CREATE INDEX idx_income_invoices_tiene_factoraje ON public.income_invoices(tiene_factoraje);

CREATE TRIGGER income_invoices_updated_at
  BEFORE UPDATE ON public.income_invoices
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.income_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_income_invoices"
  ON public.income_invoices FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
