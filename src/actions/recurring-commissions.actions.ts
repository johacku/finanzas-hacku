/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Generate recurring account commissions for Hunters (1% from 2nd month)
 * Should be called monthly (e.g., from a cron job)
 *
 * Logic: For each income invoice with vendedor_id where:
 * - The vendedor has rol = 'Hunter'
 * - The invoice is recurrent (has meses_causados or recurring template)
 * - The invoice was created more than 30 days ago (2nd month+)
 * - No recurring commission exists for this month yet
 * Create a 1% commission on the invoice's monto_recurrente
 */
export async function generateRecurringCommissions() {
  const supabase = await createClient()
  let created = 0

  // Get all Hunter vendedores
  const { data: hunters } = await (supabase as any)
    .from('vendedores')
    .select('id, nombre')
    .eq('rol', 'Hunter')
    .eq('activo', true)

  if (!hunters || hunters.length === 0) return { created: 0 }

  const hunterNames = new Set(hunters.map((h: any) => h.nombre))
  const hunterIdMap: Record<string, string> = {}
  for (const h of hunters) hunterIdMap[h.id] = h.nombre

  // Get invoices older than 30 days with hunter vendedor
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const cutoff = thirtyDaysAgo.toISOString().split('T')[0]

  const { data: invoices } = await (supabase as any)
    .from('income_invoices')
    .select('id, vendedor, vendedor_id, monto_recurrente, total_usd, sociedad, razon_social_cliente, moneda')
    .lte('fecha_creacion', cutoff)
    .neq('estado', 'Anulada')
    .gt('monto_recurrente', 0)

  if (!invoices || invoices.length === 0) return { created: 0 }

  // Current month key for dedup
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  for (const inv of invoices) {
    const vendedor = inv.vendedor || (inv.vendedor_id ? hunterIdMap[inv.vendedor_id] : null)
    if (!vendedor || !hunterNames.has(vendedor)) continue

    // Check if recurring commission already exists for this invoice + month
    const { data: existing } = await (supabase as any)
      .from('vendor_commissions')
      .select('id')
      .eq('income_invoice_id', inv.id)
      .eq('rol', 'recurrencia')
      .eq('cuota_mes', currentMonth)
      .limit(1)

    if (existing && existing.length > 0) continue

    // Create 1% recurring commission
    const baseUsd = inv.total_usd || inv.monto_recurrente || 0
    if (baseUsd <= 0) continue
    const comision = baseUsd * 0.01

    const { error } = await (supabase as any)
      .from('vendor_commissions')
      .insert({
        income_invoice_id: inv.id,
        tipo: 'vendedor',
        beneficiario_nombre: vendedor,
        porcentaje: 1,
        monto_base: baseUsd,
        monto_comision: comision,
        moneda_comision: 'USD',
        monto_comision_usd: comision,
        monto_pagado: 0,
        status: 'pendiente',
        sociedad: inv.sociedad,
        cliente_nombre: inv.razon_social_cliente,
        rol: 'recurrencia',
        cuota_mes: currentMonth,
        cuota_numero: null,
      })

    if (!error) created++
  }

  revalidatePath('/comisiones')
  return { created }
}

/**
 * Generate link de pago commission (2% of first invoice that switches to payment link)
 * Called when a Stripe payment link is created for a client
 */
export async function createLinkPagoCommission(data: {
  income_invoice_id?: string
  vendedor_nombre: string
  monto_base_usd: number
  sociedad: string
  cliente_nombre: string
}) {
  const supabase = await createClient()
  const comision = data.monto_base_usd * 0.02 // 2% of first invoice

  const { error } = await (supabase as any)
    .from('vendor_commissions')
    .insert({
      income_invoice_id: data.income_invoice_id || null,
      tipo: 'vendedor',
      beneficiario_nombre: data.vendedor_nombre,
      porcentaje: 2,
      monto_base: data.monto_base_usd,
      monto_comision: comision,
      moneda_comision: 'USD',
      monto_comision_usd: comision,
      monto_pagado: 0,
      status: 'pendiente',
      sociedad: data.sociedad,
      cliente_nombre: data.cliente_nombre,
      rol: 'link_pago',
    })

  if (error) throw new Error(error.message)
  revalidatePath('/comisiones')
}
