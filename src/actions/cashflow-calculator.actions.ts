"use server"

import { createClient } from "@/lib/supabase/server"
import { getUpcomingLiabilityPayments } from "@/actions/financial-liabilities.actions"

interface CashFlowSummary {
  estimated_cash_in: number
  estimated_cash_out: number
  net_flow: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  invoices_in: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  invoices_out: any[]
  payroll_total: number
  liability_payments_total: number
}

/**
 * Calculate estimated cash flow for a week for a specific sociedad
 * Sums from:
 * - Income invoices with payment projected for this week
 * - Expense invoices with payment projected for this week
 * - Payroll entries (if week contains salary date)
 * - Liability payments scheduled for the week
 */
export async function calculateEstimatedCashFlow(
  sociedad: string,
  weekStartDate: string, // YYYY-MM-DD
  weekEndDate: string // YYYY-MM-DD
): Promise<CashFlowSummary> {
  const supabase = await createClient()

  let estimatedCashIn = 0
  let estimatedCashOut = 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invoicesIn: any[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invoicesOut: any[] = []
  let payrollTotal = 0
  let liabilityPaymentsTotal = 0

  try {
    // 1a. Get non-factoraje income invoices with payment projected for this week
    const { data: incomeInvoices, error: incomeError } = await supabase
      .from("income_invoices")
      .select("*")
      .eq("sociedad", sociedad)
      .eq("tiene_factoraje", false)
      .gte("fecha_pago_proyectada", weekStartDate)
      .lte("fecha_pago_proyectada", weekEndDate)

    if (incomeError) {
      console.error("Error fetching income invoices:", incomeError)
    } else if (incomeInvoices) {
      for (const invoice of incomeInvoices) {
        const amount = invoice.monto_usd ?? invoice.monto ?? 0
        estimatedCashIn += amount
        invoicesIn.push(invoice)
      }
    }

    // 1b. Get factoraje income invoices where fecha_factoraje falls in this week
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: factorajeInvoices, error: factorajeError } = await (supabase as any)
      .from("income_invoices")
      .select("*")
      .eq("sociedad", sociedad)
      .eq("tiene_factoraje", true)
      .not("fecha_factoraje", "is", null)
      .gte("fecha_factoraje", weekStartDate)
      .lte("fecha_factoraje", weekEndDate)

    if (factorajeError) {
      console.error("Error fetching factoraje invoices:", factorajeError)
    } else if (factorajeInvoices) {
      for (const invoice of factorajeInvoices) {
        const amount = invoice.monto_usd ?? invoice.monto ?? 0
        estimatedCashIn += amount
        invoicesIn.push({ ...invoice, _source: 'factoraje' })
      }
    }

    // 1c. Also include factoraje invoices WITHOUT fecha_factoraje (use fecha_pago_proyectada)
    const { data: factorajeFallback, error: factorajeFBError } = await supabase
      .from("income_invoices")
      .select("*")
      .eq("sociedad", sociedad)
      .eq("tiene_factoraje", true)
      .is("fecha_factoraje" as never, null)
      .gte("fecha_pago_proyectada", weekStartDate)
      .lte("fecha_pago_proyectada", weekEndDate)

    if (factorajeFBError) {
      console.error("Error fetching factoraje fallback invoices:", factorajeFBError)
    } else if (factorajeFallback) {
      for (const invoice of factorajeFallback) {
        const amount = invoice.monto_usd ?? invoice.monto ?? 0
        estimatedCashIn += amount
        invoicesIn.push(invoice)
      }
    }

    // 2. Get expense invoices with payment projected for this week
    const { data: expenseInvoices, error: expenseError } = await supabase
      .from("expense_invoices")
      .select("*")
      .eq("sociedad", sociedad)
      .gte("fecha_pago_o_cobro", weekStartDate)
      .lte("fecha_pago_o_cobro", weekEndDate)

    if (expenseError) {
      console.error("Error fetching expense invoices:", expenseError)
    } else if (expenseInvoices) {
      for (const invoice of expenseInvoices) {
        // Use monto_usd if available, otherwise use monto_presupuestado
        const amount = invoice.monto_usd ?? invoice.monto_presupuestado ?? 0
        estimatedCashOut += amount
        invoicesOut.push(invoice)
      }
    }

    // 3. Get payroll entries for months that overlap with the week
    //    Bi-weekly (quincenas): pays on 15th and last day of each month
    const { data: payrollEntries, error: payrollError } = await supabase
      .from("payroll")
      .select("*")
      .eq("sociedad", sociedad)
      .gte("mes", weekStartDate.substring(0, 7))
      .lte("mes", weekEndDate.substring(0, 7))

    if (payrollError) {
      console.error("Error fetching payroll:", payrollError)
    } else if (payrollEntries) {
      const weekStart = new Date(weekStartDate + "T12:00:00")
      const weekEnd = new Date(weekEndDate + "T12:00:00")

      for (const entry of payrollEntries) {
        const [year, month] = entry.mes.split("-").map(Number)
        const quincenaAmount = (entry.salario_total ?? 0) / 2

        // Quincena 1: 15th of the month
        const q1Date = new Date(year, month - 1, 15)
        if (q1Date >= weekStart && q1Date <= weekEnd) {
          payrollTotal += quincenaAmount
          estimatedCashOut += quincenaAmount
        }

        // Quincena 2: last day of the month
        const lastDay = new Date(year, month, 0).getDate() // last day
        const q2Date = new Date(year, month - 1, lastDay)
        if (q2Date >= weekStart && q2Date <= weekEnd) {
          payrollTotal += quincenaAmount
          estimatedCashOut += quincenaAmount
        }
      }
    }

    // 4. Get liability payments scheduled for the week
    const liabilityPayments = await getUpcomingLiabilityPayments(
      sociedad,
      weekStartDate,
      weekEndDate
    )

    for (const payment of liabilityPayments) {
      const amount = payment.monto_pago ?? 0
      liabilityPaymentsTotal += amount
      estimatedCashOut += amount
    }
  } catch (error) {
    console.error("Error calculating cash flow:", error)
    throw error
  }

  return {
    estimated_cash_in: estimatedCashIn,
    estimated_cash_out: estimatedCashOut,
    net_flow: estimatedCashIn - estimatedCashOut,
    invoices_in: invoicesIn,
    invoices_out: invoicesOut,
    payroll_total: payrollTotal,
    liability_payments_total: liabilityPaymentsTotal,
  }
}

/**
 * Calculate closing balance for a week entry
 * closing_balance = opening_balance + manual_in - manual_out + cash_in - cash_out
 */
export async function calculateClosingBalance(
  openingBalance: number,
  cashIn: number = 0,
  cashOut: number = 0,
  manualInAdjustment: number = 0,
  manualOutAdjustment: number = 0
): Promise<number> {
  return (
    openingBalance +
    manualInAdjustment -
    manualOutAdjustment +
    cashIn -
    cashOut
  )
}

/**
 * Detect if closing balance indicates a deficit
 */
export async function detectDeficit(closingBalance: number): Promise<{
  isDeficit: boolean
  amount: number
  suggestedActions: string[]
}> {
  const isDeficit = closingBalance < 0

  const suggestedActions: string[] = []
  if (isDeficit) {
    suggestedActions.push("Considerar factoring de facturas")
    suggestedActions.push("Revisar cronograma de pagos")
    suggestedActions.push("Contactar clientes para adelantos")
    if (Math.abs(closingBalance) > 50000) {
      suggestedActions.push("Solicitar crédito de emergencia")
    }
  }

  return {
    isDeficit,
    amount: isDeficit ? Math.abs(closingBalance) : 0,
    suggestedActions,
  }
}

/**
 * Detect surplus
 */
export async function detectSurplus(closingBalance: number): Promise<{
  isSurplus: boolean
  amount: number
}> {
  return {
    isSurplus: closingBalance > 0,
    amount: closingBalance > 0 ? closingBalance : 0,
  }
}

/**
 * Get formatted week info for display
 * Returns week number, start date, and end date
 */
export async function getWeekInfo(
  date: string
): Promise<{
  weekNumber: number
  startDate: string
  endDate: string
  isFriday: boolean
  dayOfWeek: number
}> {
  const d = new Date(date)
  const dayOfWeek = d.getDay() // 0 = Sunday, 5 = Friday

  // Calculate week start (Monday)
  const diff = d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1)
  const weekStart = new Date(d.setDate(diff))
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 4) // Friday

  // Get week number (ISO 8601)
  const jan4 = new Date(d.getFullYear(), 0, 4)
  const msPerDay = 86400000
  const weekNum = Math.ceil(
    ((d.getTime() - jan4.getTime()) / msPerDay + jan4.getDay() + 1) / 7
  )

  return {
    weekNumber: weekNum,
    startDate: weekStart.toISOString().split("T")[0],
    endDate: weekEnd.toISOString().split("T")[0],
    isFriday: dayOfWeek === 5,
    dayOfWeek,
  }
}

/**
 * Check if we should auto-calculate (only on Fridays or if data changed)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function shouldAutoCalculate(_dayOfWeek: number): Promise<boolean> {
  // Auto-calculate on any day, but only finalize closing balance on Friday
  return true
}

/**
 * Get all weekly cashflow entries for a sociedad
 */
export async function getWeeklyCashFlowEntries(sociedad: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("weekly_cashflow_entries")
    .select("*")
    .eq("sociedad", sociedad)
    .order("semana_inicio", { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch cashflow entries: ${error.message}`)
  }

  return data
}

/**
 * Get or create weekly cashflow entry for this week
 */
export async function getOrCreateWeeklyCashFlowEntry(
  sociedad: string,
  weekStartDate: string
) {
  const supabase = await createClient()

  // Validate input
  if (!weekStartDate || typeof weekStartDate !== "string") {
    throw new Error("Invalid weekStartDate provided")
  }

  // Try to get existing entry
  const { data: existing, error: fetchError } = await supabase
    .from("weekly_cashflow_entries")
    .select("*")
    .eq("sociedad", sociedad)
    .eq("semana_inicio", weekStartDate)
    .single()

  if (!fetchError && existing) {
    return existing
  }

  // Create new entry
  // Get previous week's closing balance for this week's opening
  const prevWeekStart = new Date(weekStartDate)
  prevWeekStart.setDate(prevWeekStart.getDate() - 7)
  const prevWeekStartStr = prevWeekStart.toISOString().split("T")[0]

  const { data: prevWeek } = await supabase
    .from("weekly_cashflow_entries")
    .select("saldo_final")
    .eq("sociedad", sociedad)
    .eq("semana_inicio", prevWeekStartStr)
    .single()

  const openingBalance = prevWeek?.saldo_final ?? 0

  const { data: created, error: createError } = await supabase
    .from("weekly_cashflow_entries")
    .insert([
      {
        sociedad,
        semana_inicio: weekStartDate,
        saldo_inicial: openingBalance,
      },
    ])
    .select()
    .single()

  if (createError) {
    throw new Error(`Failed to create cashflow entry: ${createError.message}`)
  }

  return created
}
