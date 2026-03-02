-- Migration 002: trm_rates table
CREATE TYPE public.currency_pair AS ENUM ('USDCOP', 'USDMXN', 'USDBRL', 'USDPEN');

CREATE TABLE public.trm_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  par public.currency_pair NOT NULL,
  fecha DATE NOT NULL,
  tasa_cierre NUMERIC(18, 6) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT trm_rates_par_fecha_unique UNIQUE (par, fecha)
);

CREATE INDEX idx_trm_rates_fecha ON public.trm_rates(fecha DESC);
CREATE INDEX idx_trm_rates_par ON public.trm_rates(par);

ALTER TABLE public.trm_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_trm_rates"
  ON public.trm_rates FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
