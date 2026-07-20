-- Plan commission ranges (same logic as item_commission_ranges)
CREATE TABLE IF NOT EXISTS plan_commission_ranges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES planes(id) ON DELETE CASCADE,
  moneda text DEFAULT 'COP',
  precio_desde numeric NOT NULL DEFAULT 0,
  precio_hasta numeric,
  porcentaje_comision numeric NOT NULL DEFAULT 5,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE plan_commission_ranges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON plan_commission_ranges
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_pcr_plan ON plan_commission_ranges(plan_id);
