import { z } from 'zod'
import { SOCIEDADES, MONEDAS } from '@/lib/constants'

export const alegraInvoiceItemSchema = z.object({
  alegra_item_id: z.string().optional().default(''),
  name: z.string().optional().default(''),
  description: z.string().optional(),
  quantity: z.coerce.number().positive('Cantidad debe ser positiva'),
  price: z.coerce.number().min(0, 'Precio inválido'),
  discount: z.coerce.number().min(0).max(100).optional(),
  tax: z.array(z.object({ id: z.string() })).optional(),
  subtotal: z.number().optional(),
})

export const alegraInvoiceRequestSchema = z.object({
  alegra_client_id: z.string().optional().default(''),
  alegra_client_name: z.string().optional().default(''),
  sociedad: z.enum(SOCIEDADES as [string, ...string[]]),
  moneda: z.enum(MONEDAS as [string, ...string[]]),
  fecha_emision: z.string().min(1, 'Fecha de emisión requerida'),
  fecha_vencimiento: z.string().min(1, 'Fecha de vencimiento requerida'),
  observaciones: z.string().optional(),
  anotaciones: z.string().optional(),
  items: z.array(alegraInvoiceItemSchema).min(1, 'Debe agregar al menos un item'),
  solicitante_email: z.string().email(),
  solicitante_nombre: z.string().min(1),
  oc_numero: z.string().optional(),
  oc_file: z.any().optional(), // File upload
})

export type AlegraInvoiceRequestFormData = z.infer<typeof alegraInvoiceRequestSchema>
export type AlegraInvoiceItem = z.infer<typeof alegraInvoiceItemSchema>
