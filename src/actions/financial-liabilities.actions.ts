/* eslint-disable @typescript-eslint/no-explicit-any */
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
 * Record a liability movement (draw, payment, or interest charge).
 * Automatically updates monto_disponible for rotating cards.
 *
 * Delegates to the Postgres RPC `record_liability_movement` (migration 040)
 * which performs a SELECT … FOR UPDATE, balance recalculation, and movement
 * INSERT in a single transaction. This eliminates two bugs present in the old
 * JS read-modify-write approach:
 *   1. NULL-balance liabilities: SQL `NULL = 0` is false, so the old optimistic-
 *      lock condition matched 0 rows for any liability whose monto_disponible is
 *      NULL, causing every attempt to fail with a concurrency error.
 *   2. Non-atomicity: the old code updated the balance and inserted the movement
 *      in separate statements; a failure between them left the balance changed
 *      with no corresponding movement row.
 */
export async function recordLiabilityMovement(
  input: LiabilityMovementInput
) {
  const supabase = await createClient()

  // The RPC is SECURITY DEFINER and GRANT-ed to `authenticated`.
  // The cookie-based client carries the user's auth context, so this call
  // is authorized for the same users that could reach the old direct table writes.
  const { data, error } = await (supabase as any).rpc(
    "record_liability_movement",
    {
      p_liability_id:     input.liability_id,
      p_fecha_movimiento: input.fecha_movimiento,
      p_tipo_movimiento:  input.tipo_movimiento,
      p_monto:            input.monto,
      p_descripcion:      input.descripcion ?? null,
    }
  )

  if (error) {
    // The RPC raises Postgres exceptions whose text is surfaced in error.message.
    // Re-throw as an Error so callers receive a sensible message (e.g. the UI
    // catches this and shows "Insufficient available balance…").
    throw new Error(error.message)
  }

  // The RPC is declared RETURNS SETOF liability_movements, so Supabase-JS
  // returns data as an array. data[0] is the newly-inserted movement row —
  // the same shape previously returned by `.insert().select().single()`.
  const movement = (data as unknown[])[0]

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
