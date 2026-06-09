-- Add fecha_cobro_factoring to income_invoices
-- This stores the actual date when the factoring company pays hackU
ALTER TABLE public.income_invoices
ADD COLUMN IF NOT EXISTS fecha_cobro_factoring DATE;

-- Add 'Factoring' to invoice_estado enum
ALTER TYPE public.invoice_estado ADD VALUE IF NOT EXISTS 'Factoring';
