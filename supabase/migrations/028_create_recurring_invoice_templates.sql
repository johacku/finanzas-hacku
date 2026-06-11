CREATE TABLE public.recurring_invoice_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Same fields as alegra_invoice_requests
  alegra_client_id TEXT,
  alegra_client_name TEXT NOT NULL,
  sociedad TEXT NOT NULL,
  moneda TEXT NOT NULL DEFAULT 'COP',
  dia_recurrencia INTEGER NOT NULL CHECK (dia_recurrencia >= 1 AND dia_recurrencia <= 28),
  dias_vencimiento INTEGER NOT NULL DEFAULT 30,
  observaciones TEXT,
  anotaciones TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_usd NUMERIC(18,2),
  solicitante_email TEXT NOT NULL,
  solicitante_nombre TEXT NOT NULL,
  vendedor_nombre TEXT,
  oc_numero TEXT,
  porcentaje_comision NUMERIC(5,2) DEFAULT 5,
  tipo_documento TEXT DEFAULT 'factura',
  activo BOOLEAN NOT NULL DEFAULT true,
  ultima_ejecucion DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER recurring_templates_updated_at
  BEFORE UPDATE ON public.recurring_invoice_templates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.recurring_invoice_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_recurring_templates"
  ON public.recurring_invoice_templates FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
