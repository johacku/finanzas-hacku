DROP TABLE IF EXISTS public.daily_bank_balances;

CREATE TABLE public.daily_bank_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha DATE NOT NULL,
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  saldo_inicial NUMERIC(18,2) NOT NULL DEFAULT 0,
  saldo_inicial_usd NUMERIC(18,2),
  saldo_cierre NUMERIC(18,2),
  saldo_cierre_usd NUMERIC(18,2),
  registrado_por TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT daily_balances_fecha_account_unique UNIQUE (fecha, bank_account_id)
);

CREATE TRIGGER daily_bank_balances_updated_at
  BEFORE UPDATE ON public.daily_bank_balances
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX idx_daily_balances_fecha ON public.daily_bank_balances(fecha DESC);
CREATE INDEX idx_daily_balances_account ON public.daily_bank_balances(bank_account_id);

ALTER TABLE public.daily_bank_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_daily_balances"
  ON public.daily_bank_balances FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
