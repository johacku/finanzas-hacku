-- Migration 005: weekly_cashflow_entries table
CREATE TABLE public.weekly_cashflow_entries (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start_date          DATE NOT NULL,
  sociedad                 public.sociedad_enum NOT NULL,
  estimated_cash_in        NUMERIC(18, 2) NOT NULL DEFAULT 0,
  realtime_cash_in         NUMERIC(18, 2),
  estimated_cash_out       NUMERIC(18, 2) NOT NULL DEFAULT 0,
  realtime_cash_out        NUMERIC(18, 2),
  net_cash_flow            NUMERIC(18, 2)
    GENERATED ALWAYS AS (
      COALESCE(realtime_cash_in, estimated_cash_in)
      - COALESCE(realtime_cash_out, estimated_cash_out)
    ) STORED,
  opening_balance          NUMERIC(18, 2),
  closing_balance          NUMERIC(18, 2),
  requires_additional_cash BOOLEAN NOT NULL DEFAULT FALSE,
  cash_gap_usd             NUMERIC(18, 2),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT weekly_cashflow_unique UNIQUE (sociedad, week_start_date)
);

CREATE INDEX idx_weekly_cashflow_week_start_date ON public.weekly_cashflow_entries(week_start_date DESC);
CREATE INDEX idx_weekly_cashflow_sociedad ON public.weekly_cashflow_entries(sociedad);

CREATE TRIGGER weekly_cashflow_updated_at
  BEFORE UPDATE ON public.weekly_cashflow_entries
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.weekly_cashflow_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_weekly_cashflow"
  ON public.weekly_cashflow_entries FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
