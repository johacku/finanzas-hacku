CREATE TYPE public.bank_account_type AS ENUM ('ahorros', 'corriente', 'tdc');

CREATE TABLE public.bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  banco TEXT NOT NULL,
  tipo public.bank_account_type NOT NULL,
  numero TEXT NOT NULL,
  sociedad TEXT NOT NULL,
  moneda TEXT NOT NULL DEFAULT 'COP',
  titular TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER bank_accounts_updated_at
  BEFORE UPDATE ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_bank_accounts"
  ON public.bank_accounts FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
