-- 1. Table for acquisition channel commission rates (configurable in Settings)
CREATE TABLE IF NOT EXISTS channel_commission_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canal text NOT NULL UNIQUE,
  porcentaje_comision numeric NOT NULL DEFAULT 5,
  descripcion text,
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE channel_commission_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON channel_commission_config
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed default channels from policy docs
INSERT INTO channel_commission_config (canal, porcentaje_comision, descripcion) VALUES
  ('Directo', 10, 'Negocio traído directamente por el vendedor'),
  ('Referido', 8, 'Cliente referido por un tercero'),
  ('Aliado', 5, 'Cliente traído por aliado/reseller'),
  ('Inbound', 7, 'Cliente llegó por marketing inbound'),
  ('Outbound', 10, 'Prospección outbound del equipo'),
  ('Evento', 6, 'Cliente captado en evento')
ON CONFLICT (canal) DO NOTHING;

-- 2. Add costo_directo to invoice_item_commissions for margin-based commission (casos especiales)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoice_item_commissions' AND column_name = 'costo_directo') THEN
    ALTER TABLE invoice_item_commissions ADD COLUMN costo_directo numeric DEFAULT 0;
  END IF;
END $$;
