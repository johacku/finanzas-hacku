/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getLatestRates } from "@/actions/trm-rates.actions"
import { convertToUSD } from "@/lib/currency"
import { SOCIEDAD_CURRENCY_MAP } from "@/lib/constants"

/**
 * GET /api/backfill-commissions
 * Generates commission records for all existing income invoices that don't have them yet.
 */
export async function GET() {
  const supabase = await createClient()
  const rates = await getLatestRates()

  // Get all income invoices with vendedor
  const { data: invoices, error } = await supabase
    .from('income_invoices')
    .select('*')
    .neq('estado', 'Anulada')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Get existing commissions to avoid duplicates
  const { data: existing } = await (supabase as any)
    .from('vendor_commissions')
    .select('income_invoice_id')

  const existingIds = new Set((existing || []).map((c: any) => c.income_invoice_id))

  const rows: any[] = []
  let skipped = 0

  for (const inv of invoices || []) {
    if (existingIds.has(inv.id)) { skipped++; continue }

    const vendedor = inv.vendedor || 'Sin asignar'
    const porcentaje = inv.porcentaje_comision || 5

    // Calculate USD
    let totalUSD = inv.total_usd
    if (!totalUSD || totalUSD <= 0) {
      const local = inv.total_moneda_local || inv.monto_recurrente || inv.monto_no_recurrente || 0
      const moneda = inv.moneda || (SOCIEDAD_CURRENCY_MAP as any)[inv.sociedad] || 'COP'
      totalUSD = moneda === 'USD' ? local : (convertToUSD(local, moneda, rates) || local / 4150)
    }
    if (totalUSD <= 0) totalUSD = 0.01 // Don't skip - create with $0 so it can be edited

    const comision = totalUSD * (porcentaje / 100)

    // Determine status based on invoice status
    let status = 'pendiente'
    if (inv.estado === 'Pagada') status = 'por_pagar'
    else if (inv.estado === 'Factoring' && inv.fecha_cobro_factoring) status = 'por_pagar'

    rows.push({
      income_invoice_id: inv.id,
      tipo: 'vendedor',
      beneficiario_nombre: vendedor,
      porcentaje,
      monto_base: totalUSD,
      monto_comision: comision,
      moneda_comision: 'USD',
      monto_comision_usd: comision,
      monto_pagado: 0,
      status,
      sociedad: inv.sociedad,
      cliente_nombre: inv.razon_social_cliente,
    })

    // Check for aliado commission
    if (inv.comision_aliado && (inv.porcentaje_comision_aliado ?? 0) > 0) {
      const comisionAliado = totalUSD * ((inv.porcentaje_comision_aliado ?? 0) / 100)
      rows.push({
        income_invoice_id: inv.id,
        tipo: 'aliado',
        beneficiario_nombre: inv.comision_aliado,
        porcentaje: inv.porcentaje_comision_aliado,
        monto_base: totalUSD,
        monto_comision: comisionAliado,
        moneda_comision: 'USD',
        monto_comision_usd: comisionAliado,
        monto_pagado: 0,
        status,
        sociedad: inv.sociedad,
        cliente_nombre: inv.razon_social_cliente,
      })
    }
  }

  // Batch insert
  if (rows.length > 0) {
    const BATCH = 100
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH)
      const { error: insertErr } = await (supabase as any)
        .from('vendor_commissions')
        .insert(batch)
      if (insertErr) {
        return NextResponse.json({ error: insertErr.message, inserted: i }, { status: 500 })
      }
    }
  }

  return NextResponse.json({
    totalInvoices: invoices?.length || 0,
    skipped,
    commissionsCreated: rows.length,
  })
}
