-- Migration 048: DB audit fixes — indexes, enum PEN, FK participant_id, cleanup
--
-- Addresses findings from July 2026 database audit:
--   A-1: Missing indexes on income_invoices (estado+fecha_creacion, numero_documento)
--   A-2: Missing composite index on vendor_commissions for cron 1% dedup
--   A-4: moneda_enum missing PEN (hackÜ PER invoices in Peruvian soles)
--   M-4: idx_hacku_clientes_nombre redundant (UNIQUE constraint already covers it)
--   C-1: vendor_commissions.participant_id missing FK constraint
--
-- NOTE: The ALTER TYPE ... ADD VALUE statement CANNOT run inside a transaction block.
-- If applying manually in the Supabase SQL Editor, run the ALTER TYPE line separately
-- from the rest (or run it first in its own execution, then the remainder).
-- Both parts are idempotent.

-- A-1: Index on (estado, fecha_creacion DESC) for filtered invoice queries
CREATE INDEX IF NOT EXISTS idx_income_invoices_estado_fecha
    ON income_invoices (estado, fecha_creacion DESC);

-- A-1: Sparse index on numero_documento for lookup by document number
CREATE INDEX IF NOT EXISTS idx_income_invoices_numero_documento
    ON income_invoices (numero_documento)
    WHERE numero_documento IS NOT NULL;

-- A-2: Composite index used by the cron recurring-commissions deduplication logic
CREATE INDEX IF NOT EXISTS idx_vendor_commissions_dedup
    ON vendor_commissions (income_invoice_id, rol, cuota_mes);

-- M-4: Drop redundant index — hacku_clientes_nombre_key UNIQUE already covers it
DROP INDEX IF EXISTS idx_hacku_clientes_nombre;

-- C-1: FK from vendor_commissions.participant_id → invoice_commission_participants.id
-- Guarded against duplicate constraint via information_schema check
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'vendor_commissions_participant_id_fkey'
          AND table_name = 'vendor_commissions'
    ) THEN
        ALTER TABLE vendor_commissions
            ADD CONSTRAINT vendor_commissions_participant_id_fkey
            FOREIGN KEY (participant_id)
            REFERENCES invoice_commission_participants(id)
            ON DELETE SET NULL;
    END IF;
END;
$$;

-- A-4: Add PEN (Peruvian sol) to moneda_enum
-- IMPORTANT: This statement MUST be executed OUTSIDE a transaction block.
-- Run it separately if your SQL client wraps statements in a transaction.
ALTER TYPE moneda_enum ADD VALUE IF NOT EXISTS 'PEN';
