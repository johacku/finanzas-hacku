-- Migration 022: alegra_invoice_requests table for invoice request workflow

CREATE TYPE public.alegra_invoice_status AS ENUM (
  'borrador',
  'pendiente_aprobacion',
  'aprobada',
  'facturada',
  'rechazada',
  'anulada'
);

CREATE TABLE public.alegra_invoice_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Alegra references
  alegra_invoice_id TEXT,
  alegra_client_id TEXT NOT NULL,
  alegra_client_name TEXT NOT NULL,

  -- Invoice details
  sociedad TEXT NOT NULL,
  moneda TEXT NOT NULL DEFAULT 'COP',
  fecha_emision DATE NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  observaciones TEXT,
  anotaciones TEXT,

  -- Items stored as JSONB array: [{alegra_item_id, name, description, quantity, price, discount, tax}]
  items JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Totals
  subtotal NUMERIC(18,2) NOT NULL DEFAULT 0,
  impuestos NUMERIC(18,2) NOT NULL DEFAULT 0,
  total NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_usd NUMERIC(18,2),
  currency_exchange_rate NUMERIC(18,6),

  -- Status tracking
  status public.alegra_invoice_status NOT NULL DEFAULT 'borrador',

  -- People
  solicitante_email TEXT NOT NULL,
  solicitante_nombre TEXT NOT NULL,
  aprobado_por TEXT,
  fecha_aprobacion TIMESTAMPTZ,

  -- Purchase Order (OC)
  oc_numero TEXT,
  oc_url TEXT,

  -- Alegra PDF (when invoiced)
  alegra_pdf_url TEXT,
  alegra_numero_factura TEXT,
  fecha_facturacion TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger for updated_at (reuses shared function from migration 003)
CREATE TRIGGER alegra_invoice_requests_updated_at
  BEFORE UPDATE ON public.alegra_invoice_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Indexes
CREATE INDEX idx_alegra_requests_status ON public.alegra_invoice_requests(status);
CREATE INDEX idx_alegra_requests_solicitante ON public.alegra_invoice_requests(solicitante_email);
CREATE INDEX idx_alegra_requests_alegra_id ON public.alegra_invoice_requests(alegra_invoice_id);
CREATE INDEX idx_alegra_requests_created ON public.alegra_invoice_requests(created_at DESC);

-- RLS
ALTER TABLE public.alegra_invoice_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_alegra_requests"
  ON public.alegra_invoice_requests FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
