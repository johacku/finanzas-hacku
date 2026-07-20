-- Migration: Map razón social to hackÜ cliente
-- Run in Supabase SQL Editor

-- Table to map razon_social (business name) to hacku_cliente
CREATE TABLE IF NOT EXISTS client_razon_social_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  razon_social text NOT NULL,
  hacku_cliente_nombre text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(razon_social)
);

-- RLS
ALTER TABLE client_razon_social_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON client_razon_social_map
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Index
CREATE INDEX IF NOT EXISTS idx_crsm_razon ON client_razon_social_map(razon_social);
CREATE INDEX IF NOT EXISTS idx_crsm_hacku ON client_razon_social_map(hacku_cliente_nombre);
