-- Migration 041: Add USDEUR to the currency_pair enum
--
-- The trm_rates cache (written by /api/exchange-rates) upserts all supported
-- currencies including EUR, but the currency_pair enum only had USDCOP, USDMXN,
-- USDBRL and USDPEN. The batch upsert therefore failed with
--   invalid input value for enum currency_pair: "USDEUR"
-- and — because the route only console.error's the failure — the whole TRM cache
-- silently never persisted for ANY currency. Adding USDEUR fixes the batch.
--
-- NOTE: ALTER TYPE ... ADD VALUE cannot run inside a transaction block, so run
-- this statement on its own (it is already idempotent via IF NOT EXISTS).
-- Already applied to production via the Supabase Management API.

ALTER TYPE currency_pair ADD VALUE IF NOT EXISTS 'USDEUR';
