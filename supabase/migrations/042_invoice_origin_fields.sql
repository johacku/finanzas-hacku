-- Migration 042: Origen del negocio en facturas de ingreso (comisiones por canal)
--
-- Añade las flags que permiten calcular la comisión de un "cliente nuevo" por
-- canal de origen (hackÜ 20% / Hunter 25%, con bump a 30/35 si la factura abarca
-- 6+ meses) en vez del rango por precio/ARPU. Ver specs/001-comisiones-por-origen.
--
-- Columnas aditivas con defaults seguros: las facturas existentes quedan como
-- "cliente existente" (es_cliente_nuevo=false) y conservan la lógica de rangos.
--
-- Idempotente (IF NOT EXISTS). Aplicar en el SQL Editor o vía `supabase db query`.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='income_invoices' AND column_name='es_cliente_nuevo') THEN
    ALTER TABLE public.income_invoices ADD COLUMN es_cliente_nuevo boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='income_invoices' AND column_name='canal_origen') THEN
    ALTER TABLE public.income_invoices ADD COLUMN canal_origen text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='income_invoices' AND column_name='meses_facturados') THEN
    ALTER TABLE public.income_invoices ADD COLUMN meses_facturados integer;
  END IF;
END $$;

-- canal_origen sólo admite 'hacku' | 'hunter' (o NULL cuando no es cliente nuevo)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'income_invoices_canal_origen_check'
  ) THEN
    ALTER TABLE public.income_invoices
      ADD CONSTRAINT income_invoices_canal_origen_check
      CHECK (canal_origen IS NULL OR canal_origen IN ('hacku','hunter'));
  END IF;
END $$;
