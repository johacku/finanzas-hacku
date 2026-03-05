import { z } from 'zod'
import {
  SOCIEDADES,
  MONEDAS,
  EXPENSE_TIPOS,
  EXPENSE_AREAS,
  EXPENSE_CATEGORIAS,
  FRECUENCIAS,
  LOGICAS_PRIORIDAD,
} from '@/lib/constants'

export const expenseInvoiceSchema = z.object({
  sociedad: z.enum(SOCIEDADES as [string, ...string[]]),
  tipo: z.enum(EXPENSE_TIPOS as [string, ...string[]]),
  area: z.enum(EXPENSE_AREAS as [string, ...string[]]),
  fecha_emision: z.string().min(1, 'Fecha requerida'),
  nombre_proveedor_concepto: z.string().optional().nullable(),
  moneda: z.enum(MONEDAS as [string, ...string[]]),
  monto_sin_impuestos: z.coerce.number().min(0),
  categoria: z.enum(EXPENSE_CATEGORIAS as [string, ...string[]]),
  recurrente: z.boolean(),
  frecuencia_recurrencia: z.enum(FRECUENCIAS as [string, ...string[]]).optional().nullable(),
  como_se_pagara: z.string().optional().nullable(),
  fecha_pago_o_cobro: z.string().optional().nullable(),
  moneda_pago: z.enum(MONEDAS as [string, ...string[]]).optional().nullable(),
  monto_pago: z.coerce.number().optional().nullable(),
  prioridad_pago: z.coerce.number().int().min(1).max(3).optional().nullable(),
  logica_prioridad: z.enum(LOGICAS_PRIORIDAD as [string, ...string[]]).optional().nullable(),
  expectativa_pago: z.string().optional().nullable(),
  monto_usd: z.coerce.number().optional().nullable(),
  currency_exchange_rate: z.coerce.number().optional().nullable(),
  // Master Lists (preprocess handles '__none__' sentinel value from selects)
  concepto_id: z.preprocess(
    (val) => (!val || val === '__none__' ? null : val),
    z.string().uuid().nullable().optional()
  ),
  tipo_pago_id: z.preprocess(
    (val) => (!val || val === '__none__' ? null : val),
    z.string().uuid().nullable().optional()
  ),
  prioridad_id: z.preprocess(
    (val) => (!val || val === '__none__' ? null : val),
    z.string().uuid().nullable().optional()
  ),
  proveedor_id: z.preprocess(
    (val) => (!val || val === '__none__' ? null : val),
    z.string().uuid().nullable().optional()
  ),
})

export type ExpenseInvoiceFormData = z.infer<typeof expenseInvoiceSchema>
