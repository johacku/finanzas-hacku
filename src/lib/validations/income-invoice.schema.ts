import { z } from 'zod'
import { SOCIEDADES, MONEDAS, INVOICE_ESTADOS } from '@/lib/constants'

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
  tiene_factoraje: z.boolean(),
  monto_no_recurrente: z.coerce.number().min(0),
  monto_creacion_contenido: z.coerce.number().min(0),
  monto_recurrente: z.coerce.number().min(0),
  total_usd: z.coerce.number().optional().nullable(),
  meses_causados: z.coerce.number().int().optional().nullable(),
  fecha_inicio_causacion: z.string().optional().nullable(),
  fecha_fin_causacion: z.string().optional().nullable(),
  vendedor: z.string().optional().nullable(),
  porcentaje_comision: z.coerce.number().min(0).max(100).optional().nullable(),
  comision_aliado: z.boolean(),
  porcentaje_comision_aliado: z.coerce.number().min(0).max(100).optional().nullable(),
  // Master Lists (preprocess handles '__none__' sentinel value from selects)
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
