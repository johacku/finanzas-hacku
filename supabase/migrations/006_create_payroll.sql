-- Migration 006: payroll table
CREATE TYPE public.cost_sga AS ENUM ('Cost', 'SGA');

CREATE TABLE public.payroll (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          TEXT NOT NULL,
  rol             TEXT NOT NULL,
  pais            TEXT NOT NULL,
  area            public.expense_area NOT NULL,
  moneda_pago     public.moneda_enum NOT NULL,
  sociedad        public.sociedad_enum NOT NULL,
  cost_sga        public.cost_sga NOT NULL,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  monthly_amounts JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payroll_sociedad ON public.payroll(sociedad);
CREATE INDEX idx_payroll_area ON public.payroll(area);
CREATE INDEX idx_payroll_active ON public.payroll(active);
CREATE INDEX idx_payroll_monthly_amounts ON public.payroll USING GIN (monthly_amounts);

CREATE TRIGGER payroll_updated_at
  BEFORE UPDATE ON public.payroll
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.payroll ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_payroll"
  ON public.payroll FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
