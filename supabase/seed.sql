-- seed.sql — Datos de prueba sintéticos para desarrollo local
-- Coherente con el schema real de producción (generado 2026-07-27).
-- Aplicar DESPUÉS del baseline: psql $LOCAL_DB_URL -f supabase/seed.sql

-- ──────────────────────────────────────────────
-- Vendedores (uno Hunter, uno KAM para testing)
-- ──────────────────────────────────────────────
INSERT INTO vendedores (id, nombre, rol, activo)
VALUES
  ('11111111-0000-0000-0000-000000000001', 'María Hunter', 'Hunter', true),
  ('11111111-0000-0000-0000-000000000002', 'Pedro KAM',    'KAM',    true)
ON CONFLICT (id) DO NOTHING;

-- ──────────────────────────────────────────────
-- hacku_clientes (clientes internos del CRM)
-- ──────────────────────────────────────────────
INSERT INTO hacku_clientes (id, nombre)
VALUES
  ('22222222-0000-0000-0000-000000000001', 'Empresa Demo S.A.S.'),
  ('22222222-0000-0000-0000-000000000002', 'Startup Ejemplo LLC')
ON CONFLICT (id) DO NOTHING;

-- ──────────────────────────────────────────────
-- Planes (uno recurrente mensual, uno one-time)
-- ──────────────────────────────────────────────
INSERT INTO planes (id, nombre, descripcion, activo)
VALUES
  ('33333333-0000-0000-0000-000000000001', 'Plan Starter Mensual', 'Acceso básico mensual a la plataforma hackÜ', true),
  ('33333333-0000-0000-0000-000000000002', 'Implementación One-Time', 'Setup inicial y onboarding one-time', true)
ON CONFLICT (id) DO NOTHING;

-- ──────────────────────────────────────────────
-- TRM rates (tasas de hoy para todas las monedas)
-- ──────────────────────────────────────────────
INSERT INTO trm_rates (par, fecha, tasa_cierre)
VALUES
  ('USDCOP', CURRENT_DATE, 4200.00),
  ('USDMXN', CURRENT_DATE, 17.50),
  ('USDBRL', CURRENT_DATE, 5.10),
  ('USDPEN', CURRENT_DATE, 3.75),
  ('USDEUR', CURRENT_DATE, 0.92)
ON CONFLICT DO NOTHING;

-- ──────────────────────────────────────────────
-- Income invoice de demo (COP, pendiente)
-- ──────────────────────────────────────────────
INSERT INTO income_invoices (
  id,
  sociedad,
  razon_social_cliente,
  hacku_cliente,
  estado,
  moneda,
  fecha_creacion,
  fecha_vencimiento,
  monto_recurrente,
  total_moneda_local,
  total_usd,
  vendedor,
  vendedor_id,
  hacku_cliente_id,
  es_cliente_nuevo
)
VALUES (
  '44444444-0000-0000-0000-000000000001',
  'hackÜ SAS',
  'Empresa Demo S.A.S.',
  'Empresa Demo S.A.S.',
  'Pendiente',
  'COP',
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '30 days',
  5000000,
  5000000,
  1190.48,
  'Pedro KAM',
  '11111111-0000-0000-0000-000000000002',
  '22222222-0000-0000-0000-000000000001',
  false
)
ON CONFLICT (id) DO NOTHING;
