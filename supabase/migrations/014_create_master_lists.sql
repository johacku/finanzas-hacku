-- Migration 014: Create master lists for income/expense invoices

-- ============================================
-- PLANES (Income Invoice Plans)
-- ============================================
CREATE TABLE public.planes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default plans
INSERT INTO public.planes (nombre, descripcion) VALUES
  ('hackÜ PRO', 'Plan profesional premium'),
  ('hackÜ Starter', 'Plan inicial'),
  ('hackÜ Comms', 'Plan de comunicaciones'),
  ('Others', 'Otros servicios'),
  ('Content production', 'Producción de contenido'),
  ('Concurrencia', 'Acceso concurrente')
ON CONFLICT DO NOTHING;

-- ============================================
-- ALIADOS (Partners/Resellers)
-- ============================================
CREATE TABLE public.aliados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  email TEXT,
  telefono TEXT,
  porcentaje_comision NUMERIC(5, 2),
  activo BOOLEAN DEFAULT true,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- KAMs / VENDEDORES (Sales Team)
-- ============================================
CREATE TYPE public.rol_vendedor AS ENUM ('KAM', 'Hunter');

CREATE TABLE public.vendedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  email TEXT,
  rol public.rol_vendedor NOT NULL,
  activo BOOLEAN DEFAULT true,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- PROVEEDORES (Suppliers - Enhanced)
-- ============================================
-- Already exists, but we'll add a "master list" flag
ALTER TABLE public.proveedores
ADD COLUMN IF NOT EXISTS es_comun BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS frecuencia_uso INT DEFAULT 0;

-- ============================================
-- TIPOS DE PAGO (Payment Methods)
-- ============================================
CREATE TABLE public.tipos_pago (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default payment methods
INSERT INTO public.tipos_pago (nombre, descripcion) VALUES
  ('Efectivo', 'Pago en efectivo'),
  ('Transferencia Bancaria', 'Transferencia a cuenta bancaria'),
  ('Tarjeta de Crédito', 'Pago con tarjeta de crédito'),
  ('Cheque', 'Pago con cheque'),
  ('Plataforma Digital', 'PayPal, Stripe, etc.'),
  ('Depósito', 'Depósito en cuenta')
ON CONFLICT DO NOTHING;

-- ============================================
-- CONCEPTOS/GASTOS (Expense Concepts)
-- ============================================
CREATE TABLE public.conceptos_gasto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  categoria TEXT,
  es_comun BOOLEAN DEFAULT false,
  frecuencia_uso INT DEFAULT 0,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert common expense concepts
INSERT INTO public.conceptos_gasto (nombre, categoria, es_comun) VALUES
  ('Salarios', 'Personal', true),
  ('Seguro Médico', 'Personal', true),
  ('Oficina', 'Operacional', true),
  ('Software', 'Tecnología', true),
  ('Hosting', 'Tecnología', true),
  ('Marketing', 'Marketing', true),
  ('Viáticos', 'Viajes', true),
  ('Servicios', 'General', true),
  ('Utilidades', 'Operacional', true),
  ('Impuestos', 'Legal', true)
ON CONFLICT DO NOTHING;

-- ============================================
-- PRIORIDADES DE PAGO
-- ============================================
CREATE TABLE public.prioridades_pago (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  nivel INT NOT NULL,
  descripcion TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert payment priorities
INSERT INTO public.prioridades_pago (nombre, nivel, descripcion) VALUES
  ('Crítico', 1, 'Pago inmediato - antes de cualquier otro'),
  ('Alto', 2, 'Pago prioritario'),
  ('Normal', 3, 'Pago en tiempo normal'),
  ('Bajo', 4, 'Pago puede esperar'),
  ('Diferido', 5, 'Pago puede ser diferido')
ON CONFLICT DO NOTHING;

-- ============================================
-- Update income_invoices table to reference new tables
-- ============================================
ALTER TABLE public.income_invoices
ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.planes(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS aliado_id UUID REFERENCES public.aliados(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS vendedor_id UUID REFERENCES public.vendedores(id) ON DELETE SET NULL;

-- ============================================
-- Update expense_invoices table to reference new tables
-- ============================================
ALTER TABLE public.expense_invoices
ADD COLUMN IF NOT EXISTS concepto_id UUID REFERENCES public.conceptos_gasto(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS tipo_pago_id UUID REFERENCES public.tipos_pago(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS prioridad_id UUID REFERENCES public.prioridades_pago(id) ON DELETE SET NULL;

-- ============================================
-- Remove redundant columns from expense_invoices
-- ============================================
-- Note: We keep 'prioridad_pago' as reference and can deprecate 'logica_prioridad'
-- If logica_prioridad is being phased out, we handle it in the app

-- ============================================
-- Enable RLS on new tables
-- ============================================
ALTER TABLE public.planes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aliados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipos_pago ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conceptos_gasto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prioridades_pago ENABLE ROW LEVEL SECURITY;

-- RLS Policies for all master lists (allow authenticated users to read and manage)
CREATE POLICY "Anyone can read planes"
ON public.planes
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Anyone can manage aliados"
ON public.aliados
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Anyone can manage vendedores"
ON public.vendedores
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Anyone can read tipos_pago"
ON public.tipos_pago
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Anyone can manage conceptos_gasto"
ON public.conceptos_gasto
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Anyone can read prioridades_pago"
ON public.prioridades_pago
FOR SELECT
TO authenticated
USING (true);
