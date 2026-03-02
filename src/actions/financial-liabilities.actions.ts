"use server"

import { createClient } from "@/lib/supabase/server"
import {
  CreateFinancialLiabilityInput,
  UpdateFinancialLiabilityInput,
  LiabilityMovementInput,
  LiabilityPaymentInput,
} from "@/lib/validations/financial-liability.schema"
import { revalidatePath } from "next/cache"

/**
 * Get all financial liabilities for a sociedad
 */
export async function getLiabilities(sociedad: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("financial_liabilities")
    .select("*")
    .eq("sociedad", sociedad)
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch liabilities: ${error.message}`)
  }

  return data
}

/**
 * Get single liability with its related data (payments, movements)
 */
export async function getLiabilityDetail(liabilityId: string) {
  const supabase = await createClient()

  // Get the liability
  const { data: liability, error: liabilityError } = await supabase
    .from("financial_liabilities")
    .select("*")
    .eq("id", liabilityId)
    .single()

  if (liabilityError) {
    throw new Error(`Failed to fetch liability: ${liabilityError.message}`)
  }

  // Get scheduled payments
  const { data: payments, error: paymentsError } = await supabase
    .from("liability_payments")
    .select("*")
    .eq("liability_id", liabilityId)
    .order("fecha_pago", { ascending: true })

  if (paymentsError) {
    console.error("Failed to fetch payments:", paymentsError)
  }

  // Get recent movements
  const { data: movements, error: movementsError } = await supabase
    .from("liability_movements")
    .select("*")
    .eq("liability_id", liabilityId)
    .order("fecha_movimiento", { ascending: false })
    .limit(20)

  if (movementsError) {
    console.error("Failed to fetch movements:", movementsError)
  }

  return {
    liability,
    payments: payments || [],
    movements: movements || [],
  }
}

/**
 * Create new financial liability
 */
export async function createLiability(
  input: CreateFinancialLiabilityInput
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("financial_liabilities")
    .insert([input])
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create liability: ${error.message}`)
  }

  revalidatePath("/financial-liabilities")
  return data
}

/**
 * Update financial liability
 */
export async function updateLiability(
  id: string,
  input: UpdateFinancialLiabilityInput
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("financial_liabilities")
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update liability: ${error.message}`)
  }

  revalidatePath("/financial-liabilities")
  return data
}

/**
 * Delete financial liability
 */
export async function deleteLiability(id: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from("financial_liabilities")
    .delete()
    .eq("id", id)

  if (error) {
    throw new Error(`Failed to delete liability: ${error.message}`)
  }

  revalidatePath("/financial-liabilities")
}

/**
 * Record a liability movement (draw, payment, or interest charge)
 * Automatically updates monto_disponible for rotating cards
 */
export async function recordLiabilityMovement(
  input: LiabilityMovementInput
) {
  const supabase = await createClient()

  // Get current liability to access available balance
  const { data: liability, error: liabilityError } = await supabase
    .from("financial_liabilities")
    .select("*")
    .eq("id", input.liability_id)
    .single()

  if (liabilityError) {
    throw new Error(`Failed to fetch liability: ${liabilityError.message}`)
  }

  let newBalance = liability.monto_disponible || 0

  // Calculate new balance based on movement type
  switch (input.tipo_movimiento) {
    case "draw":
      newBalance -= input.monto
      if (newBalance < 0) {
        throw new Error(
          "Insufficient available balance for this draw"
        )
      }
      break
    case "payment":
      newBalance += input.monto
      break
    case "interest_charge":
      // Interest reduces available balance
      newBalance -= input.monto
      break
  }

  // Create the movement record
  const { data: movement, error: movementError } = await supabase
    .from("liability_movements")
    .insert([
      {
        ...input,
        balance_despues: newBalance,
      },
    ])
    .select()
    .single()

  if (movementError) {
    throw new Error(`Failed to record movement: ${movementError.message}`)
  }

  // Update liability's available balance
  const { error: updateError } = await supabase
    .from("financial_liabilities")
    .update({
      monto_disponible: newBalance,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.liability_id)

  if (updateError) {
    throw new Error(
      `Failed to update liability balance: ${updateError.message}`
    )
  }

  revalidatePath("/financial-liabilities")
  return movement
}

/**
 * Schedule a liability payment
 */
export async function scheduleLiabilityPayment(
  input: LiabilityPaymentInput
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("liability_payments")
    .insert([input])
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to schedule payment: ${error.message}`)
  }

  revalidatePath("/financial-liabilities")
  return data
}

/**
 * Update payment status (e.g., mark as paid)
 */
export async function updateLiabilityPayment(
  id: string,
  estado: string
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("liability_payments")
    .update({
      estado,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update payment: ${error.message}`)
  }

  revalidatePath("/financial-liabilities")
  return data
}

/**
 * Calculate interest accrued for a liability
 * Formula: (monto_total * tasa_interes / 100) / 12 (monthly)
 */
export async function calculateMonthlyInterest(
  montoTotal: number | null,
  tasaInteres: number | null
): Promise<number> {
  if (!montoTotal || !tasaInteres) return 0
  // Monthly interest rate
  return (montoTotal * tasaInteres) / 100 / 12
}

/**
 * Get upcoming liability payments for weekly cashflow projection
 */
export async function getUpcomingLiabilityPayments(
  sociedad: string,
  startDate: string,
  endDate: string
) {
  const supabase = await createClient()

  // Get all liabilities for this sociedad
  const { data: liabilities, error: liabError } = await supabase
    .from("financial_liabilities")
    .select("id")
    .eq("sociedad", sociedad)

  if (liabError) {
    throw new Error(
      `Failed to fetch liabilities: ${liabError.message}`
    )
  }

  if (!liabilities || liabilities.length === 0) {
    return []
  }

  const liabilityIds = liabilities.map((l) => l.id)

  // Get payments scheduled within the date range
  const { data: payments, error: paymentError } = await supabase
    .from("liability_payments")
    .select("*")
    .in("liability_id", liabilityIds)
    .gte("fecha_pago", startDate)
    .lte("fecha_pago", endDate)
    .eq("estado", "scheduled")

  if (paymentError) {
    throw new Error(
      `Failed to fetch payments: ${paymentError.message}`
    )
  }

  return payments || []
}

/**
 * Auto-record monthly interest charges (typically run monthly via cron)
 */
export async function accrueMonthlyInterest(
  liabilityId: string,
  mesFecha: string // YYYY-MM-01
) {
  const supabase = await createClient()

  // Get the liability
  const { data: liability, error: liabError } = await supabase
    .from("financial_liabilities")
    .select("*")
    .eq("id", liabilityId)
    .single()

  if (liabError) {
    throw new Error(`Failed to fetch liability: ${liabError.message}`)
  }

  // Calculate interest
  const monthlyInterest = await calculateMonthlyInterest(
    liability.monto_total,
    liability.tasa_interes
  )

  if (monthlyInterest <= 0) {
    return null
  }

  // Record as a movement
  return await recordLiabilityMovement({
    liability_id: liabilityId,
    fecha_movimiento: mesFecha,
    tipo_movimiento: "interest_charge",
    monto: monthlyInterest,
    descripcion: `Interés acumulado para ${mesFecha.substring(0, 7)}`,
  })
}
