-- Migration 019: Add ultimo_pago field to payroll
-- ultimo_pago stores the most recent monthly salary payment amount (in moneda_pago)
-- This value is projected forward: each quincena = ultimo_pago / 2
-- Quincenas are paid on the 15th and last day of each month

ALTER TABLE public.payroll
  ADD COLUMN IF NOT EXISTS ultimo_pago NUMERIC(18, 2) DEFAULT 0;

-- Backfill: set ultimo_pago from the most recent monthly_amounts entry
-- This updates existing records so they have a value to project from
UPDATE public.payroll
SET ultimo_pago = COALESCE(
  (
    SELECT (value)::numeric
    FROM jsonb_each_text(monthly_amounts)
    ORDER BY key DESC
    LIMIT 1
  ),
  0
);
