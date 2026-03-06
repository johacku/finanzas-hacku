-- Migration 020: Payment tracking columns
-- income_invoices: add actual payment date (currently missing)
ALTER TABLE public.income_invoices
  ADD COLUMN IF NOT EXISTS fecha_pago_o_cobro DATE;

-- expense_invoices: add payment status enum (currently missing)
ALTER TABLE public.expense_invoices
  ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'Pendiente'
    CHECK (estado IN ('Pendiente', 'Pagada', 'Anulada'));

-- Backfill: expense invoices that already have fecha_pago_o_cobro set → mark as Pagada
UPDATE public.expense_invoices
  SET estado = 'Pagada'
  WHERE fecha_pago_o_cobro IS NOT NULL AND estado IS NULL;
