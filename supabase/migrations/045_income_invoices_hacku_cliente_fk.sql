-- Migration 045: FK income_invoices.hacku_cliente_id → hacku_clientes.id
--
-- El join entre facturas de ingreso y hackÜ clientes se hacía por nombre de texto
-- libre (income_invoices.hacku_cliente = hacku_clientes.nombre), lo que es frágil
-- ante diferencias de mayúsculas, espacios o tildes.
--
-- Esta migración añade una columna UUID `hacku_cliente_id` con FK a hacku_clientes
-- y la retroalimenta a partir del nombre existente usando ILIKE para tolerancia de
-- mayúsculas. Facturas sin match quedan con NULL y siguen funcionando igual.
--
-- El cron de comisiones recurrentes (recurring-commissions.actions.ts) usará
-- `hacku_cliente_id` para el join, con fallback al nombre cuando sea NULL.
--
-- Idempotente (IF NOT EXISTS). Aplicar vía `supabase db query`.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'income_invoices' AND column_name = 'hacku_cliente_id'
  ) THEN
    ALTER TABLE public.income_invoices
      ADD COLUMN hacku_cliente_id uuid REFERENCES public.hacku_clientes(id);
  END IF;
END $$;

-- Backfill: resolves income_invoices.hacku_cliente → hacku_clientes.id via ILIKE
-- (case-insensitive exact-name match). Rows already with a hacku_cliente_id are
-- skipped. Runs in a single UPDATE to avoid row-by-row overhead.
UPDATE public.income_invoices AS inv
SET hacku_cliente_id = hc.id
FROM public.hacku_clientes AS hc
WHERE inv.hacku_cliente_id IS NULL
  AND inv.hacku_cliente IS NOT NULL
  AND hc.nombre ILIKE inv.hacku_cliente;

-- Index for the cron join
CREATE INDEX IF NOT EXISTS idx_income_invoices_hacku_cliente_id
  ON public.income_invoices(hacku_cliente_id);
