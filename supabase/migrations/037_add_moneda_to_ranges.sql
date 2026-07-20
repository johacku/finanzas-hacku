-- Add moneda to item_commission_ranges
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'item_commission_ranges' AND column_name = 'moneda') THEN
    ALTER TABLE item_commission_ranges ADD COLUMN moneda text DEFAULT 'COP';
  END IF;
END $$;
