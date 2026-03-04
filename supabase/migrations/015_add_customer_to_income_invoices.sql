-- Migration 015: Add customer_id to income_invoices
-- Allows linking invoices to customers (who can have multiple sociedad_cliente entries)

ALTER TABLE public.income_invoices
ADD COLUMN customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;

CREATE INDEX idx_income_invoices_customer_id ON public.income_invoices(customer_id);
