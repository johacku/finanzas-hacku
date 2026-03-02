import { z } from 'zod'
import { CURRENCY_PAIRS } from '@/lib/constants'

export const trmRateSchema = z.object({
  par: z.enum(CURRENCY_PAIRS as [string, ...string[]]),
  fecha: z.string().min(1, 'Fecha requerida'),
  tasa_cierre: z.coerce.number().positive('La tasa debe ser positiva'),
})

export type TrmRateFormData = z.infer<typeof trmRateSchema>
