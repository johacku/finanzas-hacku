-- Migration 004: expense_invoices table
CREATE TYPE public.expense_tipo AS ENUM ('Cost', 'SGA');

CREATE TYPE public.expense_area AS ENUM (
  'Global',
  'Growth',
  'Tech & Product',
  'Operation & Finance',
  'Student Success',
  'Learning'
);

CREATE TYPE public.expense_categoria AS ENUM (
  'Software',
  'Payroll',
  'Office',
  'Marketing',
  'Legal',
  'Accounting',
  'Travel',
  'Other'
);

CREATE TYPE public.frecuencia_recurrencia AS ENUM (
  'monthly',
  'quarterly',
  'annual',
  'one-time'
);

CREATE TYPE public.logica_prioridad AS ENUM ('Urgente', 'Media', 'Baja');

CREATE TABLE public.expense_invoices (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sociedad                  public.sociedad_enum NOT NULL,
  tipo                      public.expense_tipo NOT NULL,
  area                      public.expense_area NOT NULL,
  fecha_emision             DATE NOT NULL,
  nombre_proveedor_concepto TEXT NOT NULL,
  moneda                    public.moneda_enum NOT NULL,
  monto_sin_impuestos       NUMERIC(18, 2) NOT NULL,
  categoria                 public.expense_categoria NOT NULL,
  recurrente                BOOLEAN NOT NULL DEFAULT FALSE,
  frecuencia_recurrencia    public.frecuencia_recurrencia,
  como_se_pagara            TEXT,
  fecha_pago_o_cobro        DATE,
  moneda_pago               public.moneda_enum,
  monto_pago                NUMERIC(18, 2),
  prioridad_pago            INTEGER CHECK (prioridad_pago IN (1, 2, 3)),
  logica_prioridad          public.logica_prioridad,
  expectativa_pago          DATE,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_expense_invoices_fecha_emision ON public.expense_invoices(fecha_emision);
CREATE INDEX idx_expense_invoices_sociedad ON public.expense_invoices(sociedad);
CREATE INDEX idx_expense_invoices_tipo ON public.expense_invoices(tipo);
CREATE INDEX idx_expense_invoices_area ON public.expense_invoices(area);
CREATE INDEX idx_expense_invoices_categoria ON public.expense_invoices(categoria);
CREATE INDEX idx_expense_invoices_prioridad_pago ON public.expense_invoices(prioridad_pago);

CREATE TRIGGER expense_invoices_updated_at
  BEFORE UPDATE ON public.expense_invoices
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.expense_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_expense_invoices"
  ON public.expense_invoices FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
