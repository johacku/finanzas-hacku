-- Add fecha_factoraje to income_invoices for factoring date picker
ALTER TABLE public.income_invoices ADD COLUMN IF NOT EXISTS fecha_factoraje DATE;
