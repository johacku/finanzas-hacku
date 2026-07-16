-- Commission participants: multiple KAMs per invoice
CREATE TABLE public.invoice_commission_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alegra_request_id UUID REFERENCES public.alegra_invoice_requests(id) ON DELETE CASCADE,
  income_invoice_id UUID REFERENCES public.income_invoices(id) ON DELETE CASCADE,
  beneficiario_nombre TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'closer',
  porcentaje NUMERIC(5,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_participants_request ON public.invoice_commission_participants(alegra_request_id);
CREATE INDEX idx_participants_invoice ON public.invoice_commission_participants(income_invoice_id);

-- Add quincena + participant tracking to vendor_commissions
ALTER TABLE public.vendor_commissions
  ADD COLUMN IF NOT EXISTS quincena_corte TEXT,
  ADD COLUMN IF NOT EXISTS participant_id UUID,
  ADD COLUMN IF NOT EXISTS rol TEXT;

CREATE INDEX IF NOT EXISTS idx_commissions_quincena ON public.vendor_commissions(quincena_corte);

-- Audit log
CREATE TABLE public.commission_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_id UUID,
  action TEXT NOT NULL,
  details TEXT,
  performed_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_commission ON public.commission_audit_log(commission_id);

-- RLS
ALTER TABLE public.invoice_commission_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_participants" ON public.invoice_commission_participants FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_audit" ON public.commission_audit_log FOR ALL TO authenticated USING (true) WITH CHECK (true);
