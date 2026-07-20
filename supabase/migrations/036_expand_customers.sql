-- Migration: Expand customers table with emails, pronto_pago, razones_sociales, sociedades
-- Run in Supabase SQL Editor

-- Add new columns to customers
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'email') THEN
    ALTER TABLE customers ADD COLUMN email text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'emails_adicionales') THEN
    ALTER TABLE customers ADD COLUMN emails_adicionales text[];
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'pronto_pago') THEN
    ALTER TABLE customers ADD COLUMN pronto_pago boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'dias_pago') THEN
    ALTER TABLE customers ADD COLUMN dias_pago integer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'razones_sociales') THEN
    ALTER TABLE customers ADD COLUMN razones_sociales text[] DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'sociedades_hacku') THEN
    ALTER TABLE customers ADD COLUMN sociedades_hacku text[] DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'moneda_default') THEN
    ALTER TABLE customers ADD COLUMN moneda_default text DEFAULT 'COP';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'notas') THEN
    ALTER TABLE customers ADD COLUMN notas text;
  END IF;
END $$;
