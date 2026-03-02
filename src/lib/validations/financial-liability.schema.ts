import { z } from "zod"

export const liabilityTypeEnum = z.enum([
  "line_of_credit",
  "rotating_card",
  "loan",
  "other",
])

export const liabilityStatusEnum = z.enum([
  "active",
  "paid_off",
  "suspended",
  "defaulted",
])

export const monedaEnum = z.enum(["USD", "COP", "MXN", "VEF"])

export const sociedadEnum = z.enum([
  "Sociedad 1",
  "Sociedad 2",
  "Sociedad 3",
])

export const createFinancialLiabilitySchema = z.object({
  sociedad: sociedadEnum,
  nombre: z.string().min(1, "Nombre es requerido"),
  tipo: liabilityTypeEnum,
  banco: z.string().optional().nullable(),
  moneda: monedaEnum,
  monto_total: z
    .number()
    .positive("Monto total debe ser positivo")
    .optional()
    .nullable(),
  monto_disponible: z
    .number()
    .positive("Monto disponible debe ser positivo")
    .optional()
    .nullable(),
  tasa_interes: z
    .number()
    .min(0, "Tasa de interés no puede ser negativa")
    .max(100, "Tasa de interés no puede exceder 100%")
    .optional()
    .nullable(),
  fecha_inicio: z.string().date().optional().nullable(),
  fecha_vencimiento: z.string().date().optional().nullable(),
  status: liabilityStatusEnum.default("active"),
  notas: z.string().optional().nullable(),
})

export const updateFinancialLiabilitySchema =
  createFinancialLiabilitySchema.partial()

export const liabilityMovementSchema = z.object({
  liability_id: z.string().uuid("ID de pasivo inválido"),
  fecha_movimiento: z.string().date("Fecha inválida"),
  tipo_movimiento: z.enum(["draw", "payment", "interest_charge"]),
  monto: z.number().positive("Monto debe ser positivo"),
  descripcion: z.string().optional().nullable(),
  balance_despues: z.number().optional().nullable(),
})

export const liabilityPaymentSchema = z.object({
  liability_id: z.string().uuid("ID de pasivo inválido"),
  fecha_pago: z.string().date("Fecha de pago inválida"),
  monto_pago: z.number().positive("Monto de pago debe ser positivo"),
  monto_capital: z.number().optional().nullable(),
  monto_interes: z.number().optional().nullable(),
  estado: z.string().default("scheduled"),
  notas: z.string().optional().nullable(),
})

export type CreateFinancialLiabilityInput = z.infer<
  typeof createFinancialLiabilitySchema
>
export type UpdateFinancialLiabilityInput = z.infer<
  typeof updateFinancialLiabilitySchema
>
export type LiabilityMovementInput = z.infer<typeof liabilityMovementSchema>
export type LiabilityPaymentInput = z.infer<typeof liabilityPaymentSchema>
