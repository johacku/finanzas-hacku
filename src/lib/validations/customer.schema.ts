import { z } from 'zod'

export const customerSchema = z.object({
  nombre_cliente: z.string().min(1, 'Nombre requerido'),
  sociedad_cliente: z.string().optional().nullable(),
  pais: z.string().optional().nullable(),
  ciudad: z.string().optional().nullable(),
  industria: z.string().optional().nullable(),
  kam_responsable: z.string().optional().nullable(),
  plan_actual: z.string().optional().nullable(),
  tiene_factoraje: z.boolean(),
  comentarios_factoraje: z.string().optional().nullable(),
})

export type CustomerFormData = z.infer<typeof customerSchema>
