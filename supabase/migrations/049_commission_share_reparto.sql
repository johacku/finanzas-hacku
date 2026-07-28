-- Migration 049: split share (reparto) for item-level commissions
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
--
-- Contexto (spec 003-division-comisiones-reparto):
--   Hasta ahora, cuando una comisión de item tenía varios beneficiarios, a CADA
--   uno se le aplicaba la TASA COMPLETA del item (bug), inflando el gasto de
--   comisión ×N. El % del participante debe interpretarse como el SHARE de
--   reparto de la ÚNICA comisión del item (la suma de shares por item = 100%).
--
--   `porcentaje`     : sigue siendo la TASA de comisión del item (sin cambios).
--   `share_reparto`  : NUEVO. Proporción (0–100) que le toca al participante del
--                      reparto de la comisión del item. Default 100 → las filas
--                      históricas de un solo participante quedan correctas.
--   `monto_comision(_usd)` : pasa a ser el monto YA REPARTEADO del participante.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoice_item_commissions' AND column_name = 'share_reparto'
  ) THEN
    ALTER TABLE invoice_item_commissions
      ADD COLUMN share_reparto numeric NOT NULL DEFAULT 100;
  END IF;
END $$;

COMMENT ON COLUMN invoice_item_commissions.share_reparto IS
  'Share (0-100) del reparto de la comisión del item para este beneficiario. La suma por item = 100. La tasa del item vive en porcentaje.';
