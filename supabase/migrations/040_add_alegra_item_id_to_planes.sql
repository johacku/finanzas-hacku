DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'planes' AND column_name = 'alegra_item_id') THEN
    ALTER TABLE planes ADD COLUMN alegra_item_id text;
  END IF;
END $$;
