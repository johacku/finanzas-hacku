import { z } from "zod"

export const createProveedorSchema = z.object({
  nombre_proveedor: z.string().min(1, "Nombre del proveedor es requerido"),
  sociedad_proveedor: z.string().optional().nullable(),
  pais: z.string().optional().nullable(),
  ciudad: z.string().optional().nullable(),
  tipo_proveedor: z.string().optional().nullable(),
  contacto_principal: z.string().optional().nullable(),
  email: z.string().email("Email inválido").optional().nullable(),
  telefono: z.string().optional().nullable(),
  banco_pago: z.string().optional().nullable(),
  cuenta_pago: z.string().optional().nullable(),
})

export const updateProveedorSchema = createProveedorSchema.partial()

export type CreateProveedorInput = z.infer<typeof createProveedorSchema>
export type UpdateProveedorInput = z.infer<typeof updateProveedorSchema>
