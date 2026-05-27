-- Migration 024: Enable realtime for alegra_invoice_requests
ALTER PUBLICATION supabase_realtime ADD TABLE public.alegra_invoice_requests;
