CREATE TYPE public.commission_status AS ENUM ('pendiente', 'por_pagar', 'pagada', 'anulada');
CREATE TYPE public.commission_type AS ENUM ('vendedor', 'aliado');

CREATE TABLE public.vendor_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  income_invoice_id UUID REFERENCES public.income_invoices(id) ON DELETE CASCADE,

  -- Who gets the commission
  tipo public.commission_type NOT NULL DEFAULT 'vendedor',
  beneficiario_nombre TEXT NOT NULL,

  -- Amount
  porcentaje NUMERIC(5,2) NOT NULL,
  monto_base NUMERIC(18,2) NOT NULL,
  monto_comision NUMERIC(18,2) NOT NULL,
  moneda_comision TEXT NOT NULL DEFAULT 'USD',
  monto_comision_usd NUMERIC(18,2),

  -- For deferred: which cuota month this corresponds to
  cuota_mes TEXT,
  cuota_numero INTEGER,

  -- Status
  status public.commission_status NOT NULL DEFAULT 'pendiente',
  fecha_pago TIMESTAMPTZ,
  pagado_por TEXT,
  notas TEXT,

  -- Context
  sociedad TEXT,
  cliente_nombre TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER vendor_commissions_updated_at
  BEFORE UPDATE ON public.vendor_commissions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX idx_commissions_invoice ON public.vendor_commissions(income_invoice_id);
CREATE INDEX idx_commissions_status ON public.vendor_commissions(status);
CREATE INDEX idx_commissions_beneficiario ON public.vendor_commissions(beneficiario_nombre);

ALTER TABLE public.vendor_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_commissions"
  ON public.vendor_commissions FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
