-- Migration 044: Tipo de negocio y trazabilidad en comisiones por ítem
--
-- Para elegir la rama de tasa (recurrente 20/25/30/35 vs one-time 10/15 +3)
-- necesitamos saber el tipo de negocio del ítem, y registrar qué regla se aplicó
-- para poder auditar la liquidación. Ver specs/001-comisiones-por-origen
-- (US5/US6, ADR-2).
--
--   tipo_negocio          : 'recurrente' | 'one_time' (derivado del plan/ítem)
--   proyecto_corto_hunter : one-time gestionado por el hunter => +3%
--   regla_aplicada        : texto legible de la regla/tasa aplicada (auditoría)
--
-- Idempotente. Aplicar vía `supabase db query`.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoice_item_commissions' AND column_name='tipo_negocio') THEN
    ALTER TABLE public.invoice_item_commissions ADD COLUMN tipo_negocio text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoice_item_commissions' AND column_name='proyecto_corto_hunter') THEN
    ALTER TABLE public.invoice_item_commissions ADD COLUMN proyecto_corto_hunter boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoice_item_commissions' AND column_name='regla_aplicada') THEN
    ALTER TABLE public.invoice_item_commissions ADD COLUMN regla_aplicada text;
  END IF;
END $$;
