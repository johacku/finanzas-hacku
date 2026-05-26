-- Migration 023: Add vendedor_nombre to alegra_invoice_requests
ALTER TABLE public.alegra_invoice_requests ADD COLUMN vendedor_nombre TEXT;
