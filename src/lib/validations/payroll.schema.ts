import { z } from 'zod'
import {
  SOCIEDADES,
  MONEDAS,
  EXPENSE_AREAS,
  COST_SGA,
} from '@/lib/constants'

export const payrollSchema = z.object({
  nombre: z.string().min(1, 'Nombre requerido'),
  rol: z.string().min(1, 'Rol requerido'),
  pais: z.string().min(1, 'País requerido'),
  area: z.enum(EXPENSE_AREAS as [string, ...string[]]),
  moneda_pago: z.enum(MONEDAS as [string, ...string[]]),
  sociedad: z.enum(SOCIEDADES as [string, ...string[]]),
  cost_sga: z.enum(COST_SGA as [string, ...string[]]),
  active: z.boolean(),
  ultimo_pago: z.number().min(0, 'Debe ser mayor o igual a 0'),
  monthly_amounts: z.record(z.string(), z.number()),
})

export type PayrollFormData = z.infer<typeof payrollSchema>
