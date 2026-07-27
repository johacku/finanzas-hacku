-- Migration 046: Origen del negocio en alegra_invoice_requests
--
-- El flujo Alegra (solicitud de factura) no propagaba es_cliente_nuevo /
-- canal_origen / meses_facturados al crear el registro en nuestra DB,
-- lo que hacía que createIncomeInvoiceFromRequest no pudiera resolver la
-- comisión por canal de origen. Ver issue #1 del code-review.
--
-- Columnas aditivas con defaults seguros: las solicitudes existentes quedan
-- como "cliente existente" (es_cliente_nuevo=false) y sin canal.
--
-- Idempotente (DO $$ IF NOT EXISTS $$).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='alegra_invoice_requests' AND column_name='es_cliente_nuevo'
  ) THEN
    ALTER TABLE public.alegra_invoice_requests
      ADD COLUMN es_cliente_nuevo boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='alegra_invoice_requests' AND column_name='canal_origen'
  ) THEN
    ALTER TABLE public.alegra_invoice_requests
      ADD COLUMN canal_origen text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='alegra_invoice_requests' AND column_name='meses_facturados'
  ) THEN
    ALTER TABLE public.alegra_invoice_requests
      ADD COLUMN meses_facturados integer;
  END IF;
END $$;

-- canal_origen sólo admite 'hacku' | 'hunter' (o NULL cuando no es cliente nuevo)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'alegra_invoice_requests_canal_origen_check'
  ) THEN
    ALTER TABLE public.alegra_invoice_requests
      ADD CONSTRAINT alegra_invoice_requests_canal_origen_check
      CHECK (canal_origen IS NULL OR canal_origen IN ('hacku','hunter'));
  END IF;
END $$;
