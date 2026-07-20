-- Migration: Add item-level commission tracking
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)

-- 1. Add items JSONB column to income_invoices (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'income_invoices' AND column_name = 'items'
  ) THEN
    ALTER TABLE income_invoices ADD COLUMN items jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- 2. Create invoice_item_commissions table
CREATE TABLE IF NOT EXISTS invoice_item_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to income invoice (nullable for request-stage commissions)
  income_invoice_id uuid REFERENCES income_invoices(id) ON DELETE CASCADE,
  alegra_request_id uuid REFERENCES alegra_invoice_requests(id) ON DELETE CASCADE,

  -- Item info
  alegra_item_id text NOT NULL,
  item_nombre text NOT NULL,
  item_precio numeric NOT NULL DEFAULT 0,
  item_cantidad numeric NOT NULL DEFAULT 1,
  item_subtotal numeric NOT NULL DEFAULT 0,
  item_moneda text DEFAULT 'COP',
  item_subtotal_usd numeric NOT NULL DEFAULT 0,

  -- Commission person
  beneficiario_nombre text NOT NULL,
  rol text DEFAULT 'closer',
  porcentaje numeric NOT NULL DEFAULT 5,

  -- Calculated commission
  monto_comision numeric NOT NULL DEFAULT 0,
  monto_comision_usd numeric NOT NULL DEFAULT 0,

  -- Payment tracking
  monto_pagado numeric DEFAULT 0,
  status text DEFAULT 'pendiente',
  fecha_pago timestamptz,
  pagado_por text,

  -- Context
  sociedad text,
  cliente_nombre text,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_iic_income_invoice ON invoice_item_commissions(income_invoice_id);
CREATE INDEX IF NOT EXISTS idx_iic_alegra_request ON invoice_item_commissions(alegra_request_id);
CREATE INDEX IF NOT EXISTS idx_iic_beneficiario ON invoice_item_commissions(beneficiario_nombre);
CREATE INDEX IF NOT EXISTS idx_iic_status ON invoice_item_commissions(status);
CREATE INDEX IF NOT EXISTS idx_iic_alegra_item ON invoice_item_commissions(alegra_item_id);

-- 4. RLS policies (same as vendor_commissions - allow all for authenticated)
ALTER TABLE invoice_item_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON invoice_item_commissions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_iic_updated_at ON invoice_item_commissions;
CREATE TRIGGER update_iic_updated_at
  BEFORE UPDATE ON invoice_item_commissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
