/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Calculate commission % for an item at a given price using its configured ranges
// Filters by moneda if provided, falls back to all ranges if no match for that currency
export async function calculateItemCommissionPercent(
  ranges: Array<{ precio_desde: number; precio_hasta: number | null; porcentaje_comision: number; moneda?: string }>,
  price: number,
  moneda?: string
): Promise<number> {
  if (!ranges || ranges.length === 0) return 5 // default 5%

  // First try ranges matching the invoice currency
  let filtered = moneda ? ranges.filter(r => (r.moneda || 'COP') === moneda) : ranges
  // Fallback to all ranges if no currency-specific ones exist
  if (filtered.length === 0) filtered = ranges

  const sorted = [...filtered].sort((a, b) => (a.precio_desde || 0) - (b.precio_desde || 0))

  for (const range of sorted) {
    const desde = range.precio_desde || 0
    const hasta = range.precio_hasta

    if (price >= desde && (hasta === null || hasta === undefined || price <= hasta)) {
      return range.porcentaje_comision
    }
  }

  return sorted[sorted.length - 1]?.porcentaje_comision || 5
}

// Calculate commissions for all items with all participants
// The participant's porcentaje IS the commission rate (e.g. 5% = they earn 5% of item subtotal)
// The item's configured ranges provide the DEFAULT % when auto-adding a participant
// Calculate commissions for all items with all participants
// Each item uses its OWN commission % from configured ranges (filtered by moneda)
// The participant's % is only a fallback if the item has no ranges
export async function calculateItemCommissions(data: {
  items: Array<{
    alegra_item_id: string
    name: string
    price: number
    quantity: number
    discount?: number
    moneda?: string
    costo_directo?: number
    commission_ranges?: Array<{ precio_desde: number; precio_hasta: number | null; porcentaje_comision: number; moneda?: string }>
  }>
  participants: Array<{ beneficiario_nombre: string; rol: string; porcentaje: number }>
  totalUSD: number | null
  grandTotal: number
  moneda: string
  meses_causados?: number
}): Promise<Array<{
  alegra_item_id: string
  item_nombre: string
  item_precio: number
  item_cantidad: number
  item_subtotal: number
  item_moneda: string
  item_subtotal_usd: number
  beneficiario_nombre: string
  rol: string
  porcentaje: number
  monto_comision_local: number
  monto_comision: number
  monto_comision_usd: number
}>> {
  const results: Array<any> = []

  for (const item of data.items) {
    if (!item.alegra_item_id || !item.name) continue

    const subtotal = (item.quantity || 1) * (item.price || 0) * (1 - (item.discount || 0) / 100)
    if (subtotal <= 0) continue

    const itemSubtotalUSD = data.moneda === 'USD'
      ? subtotal
      : (data.totalUSD && data.grandTotal > 0)
        ? (subtotal / data.grandTotal) * data.totalUSD
        : subtotal

    // Get the commission % from the item/plan's ranges based on price and moneda
    let itemPct = await calculateItemCommissionPercent(
      item.commission_ranges || [],
      item.price,
      data.moneda
    )

    // Rule: 6+ months causados → bump Hunter commission (30%/35% for recurrent)
    if (data.meses_causados && data.meses_causados >= 6 && itemPct >= 20) {
      // 20% → 30%, 25% → 35% (add 10% for 6+ months)
      itemPct = itemPct + 10
    }

    // For "caso especial" items with costo_directo: commission on margin (price - cost)
    const costoDirecto = item.costo_directo || 0
    const baseForCommission = costoDirecto > 0 ? Math.max(subtotal - (costoDirecto * (item.quantity || 1)), 0) : subtotal
    const baseForCommissionUSD = costoDirecto > 0
      ? (data.moneda === 'USD' ? baseForCommission : (data.totalUSD && data.grandTotal > 0 ? (baseForCommission / data.grandTotal) * data.totalUSD : baseForCommission))
      : itemSubtotalUSD

    for (const p of data.participants) {
      if (!p.beneficiario_nombre) continue

      const pct = itemPct
      const comisionLocal = baseForCommission * (pct / 100)
      const comisionUSD = baseForCommissionUSD * (pct / 100)

      results.push({
        alegra_item_id: item.alegra_item_id,
        item_nombre: item.name,
        item_precio: item.price,
        item_cantidad: item.quantity || 1,
        item_subtotal: subtotal,
        item_moneda: data.moneda,
        item_subtotal_usd: Math.round(itemSubtotalUSD * 100) / 100,
        beneficiario_nombre: p.beneficiario_nombre,
        rol: p.rol,
        porcentaje: pct,
        monto_comision_local: Math.round(comisionLocal * 100) / 100,
        monto_comision: Math.round(comisionUSD * 100) / 100,
        monto_comision_usd: Math.round(comisionUSD * 100) / 100,
      })
    }
  }

  return results
}

// Get the default commission % for an item at a given price (used for auto-filling participant %)
export async function getItemDefaultCommission(
  ranges: Array<{ precio_desde: number; precio_hasta: number | null; porcentaje_comision: number }>,
  price: number
): Promise<number> {
  return calculateItemCommissionPercent(ranges, price)
}

// Save item-level commissions to database
// CRITICAL: Recalculates % and amounts from plan ranges in backend — never trusts frontend values
export async function saveItemCommissions(data: {
  income_invoice_id?: string
  alegra_request_id?: string
  items: Array<{
    alegra_item_id: string
    item_nombre: string
    item_precio: number
    item_cantidad: number
    item_subtotal: number
    item_moneda?: string
    item_subtotal_usd: number
    beneficiario_nombre: string
    rol: string
    porcentaje: number
    monto_comision: number
    monto_comision_usd: number
  }>
  sociedad: string
  cliente_nombre: string
}) {
  if (!data.items || data.items.length === 0) return { inserted: 0 }

  const supabase = await createClient()

  // Load plan commission ranges from DB to recalculate (don't trust frontend)
  const planIds = Array.from(new Set(
    data.items.map(i => i.alegra_item_id).filter(id => id.startsWith('plan_')).map(id => id.replace('plan_', ''))
  ))

  const planRangesMap: Record<string, Array<{ precio_desde: number; precio_hasta: number | null; porcentaje_comision: number; moneda?: string }>> = {}

  if (planIds.length > 0) {
    const { data: ranges } = await (supabase as any)
      .from('plan_commission_ranges')
      .select('*')
      .in('plan_id', planIds)

    for (const r of ranges || []) {
      const key = `plan_${r.plan_id}`
      if (!planRangesMap[key]) planRangesMap[key] = []
      planRangesMap[key].push(r)
    }
  }

  const rows = []
  for (const item of data.items) {
    // Recalculate % from plan ranges
    const ranges = planRangesMap[item.alegra_item_id] || []
    const moneda = item.item_moneda || 'COP'
    const verifiedPct = ranges.length > 0
      ? await calculateItemCommissionPercent(ranges, item.item_precio, moneda)
      : item.porcentaje // fallback to frontend value if no ranges found

    // Recalculate amounts using verified %
    const subtotal = item.item_subtotal || (item.item_cantidad * item.item_precio)
    const comisionLocal = Math.round(subtotal * (verifiedPct / 100) * 100) / 100
    const subtotalUsd = item.item_subtotal_usd || 0
    const comisionUsd = Math.round(subtotalUsd * (verifiedPct / 100) * 100) / 100

    // Log if frontend and backend disagree
    if (Math.abs(verifiedPct - item.porcentaje) > 0.01) {
      console.warn(`[SaveItemCommissions] % mismatch for ${item.item_nombre} @ ${item.item_precio} ${moneda}: frontend=${item.porcentaje}%, backend=${verifiedPct}%`)
    }

    rows.push({
      income_invoice_id: data.income_invoice_id || null,
      alegra_request_id: data.alegra_request_id || null,
      alegra_item_id: item.alegra_item_id,
      item_nombre: item.item_nombre,
      item_precio: item.item_precio,
      item_cantidad: item.item_cantidad,
      item_subtotal: subtotal,
      item_moneda: moneda,
      item_subtotal_usd: subtotalUsd,
      beneficiario_nombre: item.beneficiario_nombre,
      rol: item.rol,
      porcentaje: verifiedPct,
      monto_comision: comisionLocal,
      monto_comision_usd: comisionUsd,
      monto_pagado: 0,
      status: 'pendiente',
      sociedad: data.sociedad,
      cliente_nombre: data.cliente_nombre,
    })
  }

  const { error } = await (supabase as any)
    .from('invoice_item_commissions')
    .insert(rows)

  if (error) {
    console.error('[ItemCommissions] Insert error:', error.message)
    throw new Error(error.message)
  }

  revalidatePath('/comisiones')
  return { inserted: rows.length }
}

// Recalculate commissions when an invoice is edited
// Reads items and vendedor directly from the invoice — does NOT trust frontend data
export async function recalculateInvoiceCommissions(invoiceId: string) {
  const supabase = await createClient()

  // Load the invoice with its current items
  const { data: invoice } = await (supabase as any)
    .from('income_invoices')
    .select('items, vendedor, moneda, total_usd, total_moneda_local, sociedad, razon_social_cliente')
    .eq('id', invoiceId)
    .single()

  if (!invoice || !invoice.items || !Array.isArray(invoice.items) || invoice.items.length === 0) {
    console.log(`[Commissions] No items found for invoice ${invoiceId}, skipping recalculation`)
    return
  }

  // Delete existing item commissions
  await (supabase as any)
    .from('invoice_item_commissions')
    .delete()
    .eq('income_invoice_id', invoiceId)

  // Get vendedor (beneficiario)
  const vendedor = invoice.vendedor || 'Sin asignar'
  const moneda = invoice.moneda || 'COP'
  const totalLocal = invoice.total_moneda_local || 0
  const totalUsd = invoice.total_usd || 0

  // Build items for saveItemCommissions
  const itemsForSave = []
  for (const item of invoice.items) {
    if (!item.alegra_item_id || !item.price) continue
    const qty = item.quantity || 1
    const price = item.price || 0
    const discount = item.discount || 0
    const subtotal = qty * price * (1 - discount / 100)
    const subtotalUsd = totalUsd > 0 && totalLocal > 0 ? (subtotal / totalLocal) * totalUsd : subtotal

    itemsForSave.push({
      alegra_item_id: item.alegra_item_id,
      item_nombre: item.name || '',
      item_precio: price,
      item_cantidad: qty,
      item_subtotal: subtotal,
      item_moneda: moneda,
      item_subtotal_usd: Math.round(subtotalUsd * 100) / 100,
      beneficiario_nombre: vendedor,
      rol: 'closer',
      porcentaje: 0, // will be recalculated by saveItemCommissions
      monto_comision: 0, // will be recalculated
      monto_comision_usd: 0, // will be recalculated
    })
  }

  if (itemsForSave.length > 0) {
    await saveItemCommissions({
      income_invoice_id: invoiceId,
      items: itemsForSave,
      sociedad: invoice.sociedad || '',
      cliente_nombre: invoice.razon_social_cliente || '',
    })
  }

  console.log(`[Commissions] Recalculated ${itemsForSave.length} commissions for invoice ${invoiceId} from DB items`)
}

// Get item commissions (for the commissions page)
export async function getItemCommissions(filters?: {
  status?: string
  beneficiario?: string
  sociedad?: string
}) {
  try {
    const supabase = await createClient()
    let query = (supabase as any)
      .from('invoice_item_commissions')
      .select('*, income_invoices(razon_social_cliente, estado, moneda, numero_documento, fecha_pago_o_cobro, total_moneda_local, total_usd)')
      .order('created_at', { ascending: false })

    if (filters?.status) query = query.eq('status', filters.status)
    if (filters?.beneficiario) query = query.eq('beneficiario_nombre', filters.beneficiario)
    if (filters?.sociedad) query = query.eq('sociedad', filters.sociedad)

    const { data, error } = await query.limit(500)
    if (error) { console.warn('[ItemCommissions]', error.message); return [] }
    return data || []
  } catch { return [] }
}

// Get item commission summary grouped by item
export async function getItemCommissionSummary() {
  try {
    const supabase = await createClient()
    const { data, error } = await (supabase as any)
      .from('invoice_item_commissions')
      .select('item_nombre, alegra_item_id, beneficiario_nombre, status, monto_comision_usd, monto_pagado')

    if (error) return { byItem: {}, byVendedor: {} }

    const byItem: Record<string, { pendiente: number; por_pagar: number; pagada: number; total: number; count: number }> = {}
    const byVendedor: Record<string, { pendiente: number; por_pagar: number; pagada: number; total: number }> = {}

    for (const c of data || []) {
      const usd = Number(c.monto_comision_usd) || 0
      const itemName = c.item_nombre || 'Desconocido'
      const vendedor = c.beneficiario_nombre || 'Desconocido'

      // By item
      if (!byItem[itemName]) byItem[itemName] = { pendiente: 0, por_pagar: 0, pagada: 0, total: 0, count: 0 }
      byItem[itemName].count++
      byItem[itemName].total += usd
      if (c.status === 'pendiente') byItem[itemName].pendiente += usd
      else if (c.status === 'por_pagar') byItem[itemName].por_pagar += usd
      else if (c.status === 'pagada') byItem[itemName].pagada += usd

      // By vendedor
      if (!byVendedor[vendedor]) byVendedor[vendedor] = { pendiente: 0, por_pagar: 0, pagada: 0, total: 0 }
      byVendedor[vendedor].total += usd
      if (c.status === 'pendiente') byVendedor[vendedor].pendiente += usd
      else if (c.status === 'por_pagar') byVendedor[vendedor].por_pagar += usd
      else if (c.status === 'pagada') byVendedor[vendedor].pagada += usd
    }

    return { byItem, byVendedor }
  } catch { return { byItem: {}, byVendedor: {} } }
}

// Update an item commission
export async function updateItemCommission(id: string, data: Record<string, any>) {
  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('invoice_item_commissions')
    .update(data)
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/comisiones')
}

// Pay an item commission
export async function payItemCommission(id: string, amount: number, fecha_pago: string, pagado_por: string) {
  const supabase = await createClient()

  // Get current state
  const { data: current } = await (supabase as any)
    .from('invoice_item_commissions')
    .select('monto_comision_usd, monto_pagado')
    .eq('id', id)
    .single()

  if (!current) throw new Error('Commission not found')

  const totalPagado = (current.monto_pagado || 0) + amount
  const fullyPaid = totalPagado >= (current.monto_comision_usd || 0) - 0.01

  const { error } = await (supabase as any)
    .from('invoice_item_commissions')
    .update({
      monto_pagado: totalPagado,
      status: fullyPaid ? 'pagada' : 'por_pagar',
      fecha_pago: fullyPaid ? fecha_pago : null,
      pagado_por: fullyPaid ? pagado_por : null,
    })
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/comisiones')
}

// Copy item commissions from request to invoice
export async function copyItemCommissionsToInvoice(requestId: string, invoiceId: string) {
  try {
    const supabase = await createClient()
    const { data: itemComms } = await (supabase as any)
      .from('invoice_item_commissions')
      .select('*')
      .eq('alegra_request_id', requestId)

    if (!itemComms || itemComms.length === 0) return

    const rows = itemComms.map((ic: any) => ({
      income_invoice_id: invoiceId,
      alegra_item_id: ic.alegra_item_id,
      item_nombre: ic.item_nombre,
      item_precio: ic.item_precio,
      item_cantidad: ic.item_cantidad,
      item_subtotal: ic.item_subtotal,
      item_moneda: ic.item_moneda,
      item_subtotal_usd: ic.item_subtotal_usd,
      beneficiario_nombre: ic.beneficiario_nombre,
      rol: ic.rol,
      porcentaje: ic.porcentaje,
      monto_comision: ic.monto_comision,
      monto_comision_usd: ic.monto_comision_usd,
      monto_pagado: 0,
      status: 'pendiente',
      sociedad: ic.sociedad,
      cliente_nombre: ic.cliente_nombre,
    }))

    const { error } = await (supabase as any)
      .from('invoice_item_commissions')
      .insert(rows)

    if (error) console.error('[ItemCommissions] Copy error:', error.message)
  } catch (e) {
    console.error('[ItemCommissions] copyToInvoice error:', e)
  }
}

// Sync item commission statuses based on income invoice status
export async function syncItemCommissionStatuses() {
  const supabase = await createClient()
  let updated = 0

  const { data: comms, error } = await (supabase as any)
    .from('invoice_item_commissions')
    .select('id, status, income_invoice_id')
    .neq('status', 'pagada')
    .neq('status', 'anulada')
    .not('income_invoice_id', 'is', null)

  if (error) {
    console.error('[syncItemCommissionStatuses] error:', error.message)
    return { updated: 0 }
  }

  // Get unique invoice IDs
  const invoiceIds = Array.from(new Set((comms || []).map((c: any) => c.income_invoice_id).filter(Boolean)))
  if (invoiceIds.length === 0) return { updated: 0 }

  const { data: invoices } = await (supabase as any)
    .from('income_invoices')
    .select('id, estado, tiene_factoraje, fecha_cobro_factoring')
    .in('id', invoiceIds)

  const invoiceMap: Record<string, any> = {}
  for (const inv of invoices || []) {
    invoiceMap[inv.id] = inv
  }

  for (const c of comms || []) {
    const inv = invoiceMap[c.income_invoice_id]
    if (!inv) continue

    let newStatus = c.status
    if (inv.estado === 'Anulada') newStatus = 'anulada'
    else if (inv.estado === 'Pagada') newStatus = 'por_pagar'
    else if (inv.estado === 'Factoring' && inv.fecha_cobro_factoring) newStatus = 'por_pagar'
    else newStatus = 'pendiente'

    if (newStatus !== c.status) {
      await (supabase as any)
        .from('invoice_item_commissions')
        .update({ status: newStatus })
        .eq('id', c.id)
      updated++
    }
  }

  revalidatePath('/comisiones')
  return { updated }
}
