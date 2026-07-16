/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getCommissions(filters?: {
  status?: string
  beneficiario?: string
  sociedad?: string
  tipo?: string
}) {
  try {
    const supabase = await createClient()
    let query = (supabase as any)
      .from('vendor_commissions')
      .select('*, income_invoices(razon_social_cliente, estado, moneda, numero_documento, fecha_pago_o_cobro)')
      .order('created_at', { ascending: false })

    if (filters?.status) query = query.eq('status', filters.status)
    if (filters?.beneficiario) query = query.eq('beneficiario_nombre', filters.beneficiario)
    if (filters?.sociedad) query = query.eq('sociedad', filters.sociedad)
    if (filters?.tipo) query = query.eq('tipo', filters.tipo)

    const { data, error } = await query.limit(500)
    if (error) { console.warn('[Commissions]', error.message); return [] }
    return data || []
  } catch { return [] }
}

export async function getCommissionsSummary() {
  try {
    const supabase = await createClient()
    const { data, error } = await (supabase as any)
      .from('vendor_commissions')
      .select('beneficiario_nombre, tipo, status, monto_comision_usd')

    if (error) return { byVendedor: {}, totals: { pendiente: 0, por_pagar: 0, pagada: 0 } }

    const byVendedor: Record<string, { pendiente: number; por_pagar: number; pagada: number; total: number }> = {}
    const totals = { pendiente: 0, por_pagar: 0, pagada: 0 }

    for (const c of data || []) {
      const usd = Number(c.monto_comision_usd) || 0
      const name = c.beneficiario_nombre || 'Desconocido'

      if (!byVendedor[name]) byVendedor[name] = { pendiente: 0, por_pagar: 0, pagada: 0, total: 0 }

      if (c.status === 'pendiente') { byVendedor[name].pendiente += usd; totals.pendiente += usd }
      else if (c.status === 'por_pagar') { byVendedor[name].por_pagar += usd; totals.por_pagar += usd }
      else if (c.status === 'pagada') { byVendedor[name].pagada += usd; totals.pagada += usd }
      byVendedor[name].total += usd
    }

    return { byVendedor, totals }
  } catch { return { byVendedor: {}, totals: { pendiente: 0, por_pagar: 0, pagada: 0 } } }
}

// Mark commission as paid
export async function payCommission(id: string, fecha_pago: string, pagado_por?: string) {
  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('vendor_commissions')
    .update({ status: 'pagada', fecha_pago, pagado_por })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/comisiones')
}

// Bulk pay commissions
export async function bulkPayCommissions(ids: string[], fecha_pago: string, pagado_por?: string) {
  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('vendor_commissions')
    .update({ status: 'pagada', fecha_pago, pagado_por })
    .in('id', ids)
  if (error) throw new Error(error.message)
  revalidatePath('/comisiones')
}

// Update commission percentage/amount
export async function updateCommission(id: string, data: Record<string, any>) {
  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('vendor_commissions')
    .update(data)
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/comisiones')
}

// Create commissions for an invoice (called when invoice is created)
export async function createCommissionsForInvoice(data: {
  income_invoice_id: string
  vendedor_nombre?: string
  porcentaje_vendedor?: number
  aliado_nombre?: string
  porcentaje_aliado?: number
  total_usd: number
  moneda: string
  sociedad: string
  cliente_nombre: string
  diferido_cuotas?: Array<{ mes: string; monto: number; monto_usd?: number }>
}) {
  const supabase = await createClient()
  const rows: any[] = []

  const commissionees = [
    { tipo: 'vendedor', nombre: data.vendedor_nombre, porcentaje: data.porcentaje_vendedor },
    { tipo: 'aliado', nombre: data.aliado_nombre, porcentaje: data.porcentaje_aliado },
  ].filter(c => c.nombre && c.porcentaje && c.porcentaje > 0)

  for (const person of commissionees) {
    if (data.diferido_cuotas && data.diferido_cuotas.length > 0) {
      // Create one commission per cuota
      data.diferido_cuotas.forEach((cuota, i) => {
        const cuotaUSD = cuota.monto_usd || cuota.monto
        const comision = cuotaUSD * (person.porcentaje! / 100)
        rows.push({
          income_invoice_id: data.income_invoice_id,
          tipo: person.tipo,
          beneficiario_nombre: person.nombre,
          porcentaje: person.porcentaje,
          monto_base: cuotaUSD,
          monto_comision: comision,
          moneda_comision: 'USD',
          monto_comision_usd: comision,
          cuota_mes: cuota.mes,
          cuota_numero: i + 1,
          status: 'pendiente',
          sociedad: data.sociedad,
          cliente_nombre: data.cliente_nombre,
        })
      })
    } else {
      // Single commission
      const comision = data.total_usd * (person.porcentaje! / 100)
      rows.push({
        income_invoice_id: data.income_invoice_id,
        tipo: person.tipo,
        beneficiario_nombre: person.nombre,
        porcentaje: person.porcentaje,
        monto_base: data.total_usd,
        monto_comision: comision,
        moneda_comision: 'USD',
        monto_comision_usd: comision,
        status: 'pendiente',
        sociedad: data.sociedad,
        cliente_nombre: data.cliente_nombre,
      })
    }
  }

  if (rows.length > 0) {
    const { error } = await (supabase as any)
      .from('vendor_commissions')
      .insert(rows)
    if (error) console.error('[Commissions] Insert error:', error.message)
  }
}

// Add a single commission participant (linked to an alegra_invoice_request)
export async function addParticipant(data: {
  alegra_request_id?: string
  income_invoice_id?: string
  beneficiario_nombre: string
  rol: string
  porcentaje: number
}) {
  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('invoice_commission_participants')
    .insert({
      alegra_request_id: data.alegra_request_id || null,
      income_invoice_id: data.income_invoice_id || null,
      beneficiario_nombre: data.beneficiario_nombre,
      rol: data.rol,
      porcentaje: data.porcentaje,
    })
  if (error) throw new Error(error.message)
}

// Copy participants from request to income invoice
export async function copyParticipantsToInvoice(requestId: string, invoiceId: string) {
  try {
    const supabase = await createClient()
    const { data: participants } = await (supabase as any)
      .from('invoice_commission_participants')
      .select('*')
      .eq('alegra_request_id', requestId)

    for (const p of participants || []) {
      await (supabase as any)
        .from('invoice_commission_participants')
        .insert({
          income_invoice_id: invoiceId,
          beneficiario_nombre: p.beneficiario_nombre,
          rol: p.rol,
          porcentaje: p.porcentaje,
        })
    }
  } catch (e) {
    console.error('[Commissions] copyParticipantsToInvoice error:', e)
  }
}

// Create commissions from participants for an income invoice
export async function createCommissionsFromParticipants(data: {
  income_invoice_id: string
  total_usd: number
  sociedad: string
  cliente_nombre: string
  fecha_emision: string
  userEmail?: string
}) {
  const supabase = await createClient()

  // Get participants for this invoice
  const { data: participants } = await (supabase as any)
    .from('invoice_commission_participants')
    .select('*')
    .eq('income_invoice_id', data.income_invoice_id)

  if (!participants || participants.length === 0) return

  const rows: any[] = []

  for (const p of participants) {
    const comision = data.total_usd * (p.porcentaje / 100)
    rows.push({
      income_invoice_id: data.income_invoice_id,
      tipo: p.rol === 'aliado' ? 'aliado' : 'vendedor',
      beneficiario_nombre: p.beneficiario_nombre,
      porcentaje: p.porcentaje,
      monto_base: data.total_usd,
      monto_comision: comision,
      moneda_comision: 'USD',
      monto_comision_usd: comision,
      status: 'pendiente',
      sociedad: data.sociedad,
      cliente_nombre: data.cliente_nombre,
      participant_id: p.id,
      rol: p.rol,
    })
  }

  if (rows.length > 0) {
    const { error } = await (supabase as any).from('vendor_commissions').insert(rows)
    if (error) console.error('[Commissions] Insert error:', error.message)
  }
}

// Create deferred commission cuotas (one per participant per cuota)
export async function createDeferredCommissions(data: {
  alegra_request_id?: string
  participants: Array<{ beneficiario_nombre: string; rol: string; porcentaje: number }>
  cuotas: Array<{ mes: string; monto_usd: number }>
  sociedad: string
  cliente_nombre: string
}) {
  const supabase = await createClient()
  const rows: any[] = []

  for (const p of data.participants) {
    for (let i = 0; i < data.cuotas.length; i++) {
      const cuota = data.cuotas[i]
      const comision = cuota.monto_usd * (p.porcentaje / 100)
      rows.push({
        beneficiario_nombre: p.beneficiario_nombre,
        tipo: p.rol === 'aliado' ? 'aliado' : 'vendedor',
        porcentaje: p.porcentaje,
        monto_base: cuota.monto_usd,
        monto_comision: comision,
        moneda_comision: 'USD',
        monto_comision_usd: comision,
        cuota_mes: cuota.mes,
        cuota_numero: i + 1,
        status: 'pendiente',
        sociedad: data.sociedad,
        cliente_nombre: data.cliente_nombre,
        rol: p.rol,
      })
    }
  }

  if (rows.length > 0) {
    const { error } = await (supabase as any).from('vendor_commissions').insert(rows)
    if (error) console.error('[Commissions] Deferred insert error:', error.message)
  }

  return rows.length
}

// Auto-update commission statuses based on invoice status changes
export async function syncCommissionStatuses() {
  const supabase = await createClient()

  // Get all non-anulada commissions with their invoice status
  const { data: commissions } = await (supabase as any)
    .from('vendor_commissions')
    .select('id, status, income_invoice_id, income_invoices(estado, tiene_factoraje, fecha_cobro_factoring, fecha_pago_o_cobro)')
    .neq('status', 'pagada')
    .neq('status', 'anulada')

  if (!commissions) return

  for (const c of commissions) {
    const inv = c.income_invoices
    if (!inv) continue

    let newStatus = c.status

    if (inv.estado === 'Anulada') {
      newStatus = 'anulada'
    } else if (inv.estado === 'Pagada') {
      newStatus = 'por_pagar'
    } else if (inv.estado === 'Factoring' && inv.fecha_cobro_factoring) {
      newStatus = 'por_pagar'
    } else {
      newStatus = 'pendiente'
    }

    if (newStatus !== c.status) {
      await (supabase as any)
        .from('vendor_commissions')
        .update({ status: newStatus })
        .eq('id', c.id)
    }
  }

  revalidatePath('/comisiones')
}
