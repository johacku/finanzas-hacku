import { z } from 'zod'
import { SOCIEDADES, MONEDAS, INVOICE_ESTADOS } from '@/lib/constants'

export const incomeInvoiceItemSchema = z.object({
  alegra_item_id: z.string().optional().default(''),
  name: z.string().optional().default(''),
  description: z.string().optional(),
  quantity: z.coerce.number().positive('Cantidad debe ser positiva'),
  price: z.coerce.number().min(0, 'Precio inválido'),
  discount: z.coerce.number().min(0).max(100).optional(),
  costo_directo: z.coerce.number().min(0).optional(),
})

export const incomeInvoiceSchema = z.object({
  customer_id: z.preprocess(
    (val) => (!val || val === '__none__' ? null : val),
    z.string().uuid().nullable().optional()
  ),
  sociedad: z.enum(SOCIEDADES as [string, ...string[]]),
  razon_social_cliente: z.string().min(1, 'Cliente requerido'),
  hacku_cliente: z.string().optional().nullable(),
  tipo_documento: z.string().optional().nullable(),
  numero_documento: z.string().optional().nullable(),
  estado: z.enum(INVOICE_ESTADOS as [string, ...string[]]),
  moneda: z.enum(MONEDAS as [string, ...string[]]),
  fecha_creacion: z.string().min(1, 'Fecha de creación requerida'),
  fecha_vencimiento: z.string().min(1, 'Fecha de vencimiento requerida'),
  dia_pago_cliente: z.coerce.number().int().min(0),
  dia_adelanto_factoraje: z.coerce.number().int().min(0).optional().nullable(),
  fecha_factoraje: z.string().optional().nullable(),
  fecha_cobro_factoring: z.string().optional().nullable(),
  fecha_pago_o_cobro: z.string().optional().nullable(),
  tiene_factoraje: z.boolean(),
  // Items-based (new)
  items: z.array(incomeInvoiceItemSchema).optional().default([]),
  // Legacy montos (kept for backward compatibility, defaults to 0)
  monto_no_recurrente: z.coerce.number().min(0).default(0),
  monto_creacion_contenido: z.coerce.number().min(0).default(0),
  monto_recurrente: z.coerce.number().min(0).default(0),
  total_usd: z.coerce.number().optional().nullable(),
  meses_causados: z.coerce.number().int().optional().nullable(),
  fecha_inicio_causacion: z.string().optional().nullable(),
  fecha_fin_causacion: z.string().optional().nullable(),
  vendedor: z.string().optional().nullable(),
  porcentaje_comision: z.coerce.number().min(0).max(100).default(5),
  comision_aliado: z.boolean().default(false),
  porcentaje_comision_aliado: z.coerce.number().min(0).max(100).optional().nullable(),
  plan_id: z.preprocess(
    (val) => (!val || val === '__none__' ? null : val),
    z.string().uuid().nullable().optional()
  ),
  aliado_id: z.preprocess(
    (val) => (!val || val === '__none__' ? null : val),
    z.string().uuid().nullable().optional()
  ),
  vendedor_id: z.preprocess(
    (val) => (!val || val === '__none__' ? null : val),
    z.string().uuid().nullable().optional()
  ),
})

export type IncomeInvoiceFormData = z.infer<typeof incomeInvoiceSchema>
export type IncomeInvoiceItem = z.infer<typeof incomeInvoiceItemSchema>
