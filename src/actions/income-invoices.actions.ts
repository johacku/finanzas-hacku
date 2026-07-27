/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Database } from '@/types/database.types'
import { sanitizePostgrestValue } from '@/lib/commission-math'

type IncomeInvoiceInsert = Database['public']['Tables']['income_invoices']['Insert']
type IncomeInvoiceUpdate = Database['public']['Tables']['income_invoices']['Update']
type SociedadEnum = Database['public']['Enums']['sociedad_enum']
type EstadoEnum = string
type MonedaEnum = Database['public']['Enums']['moneda_enum']

export async function getIncomeInvoices(filters?: {
  sociedad?: SociedadEnum
  estado?: EstadoEnum
  moneda?: MonedaEnum
  dateFrom?: string
  dateTo?: string
  search?: string
  tieneFactoraje?: boolean
}) {
  const supabase = await createClient()

  let query = supabase
    .from('income_invoices')
    .select('*')
    .order('created_at', { ascending: false })

  if (filters?.sociedad) query = query.eq('sociedad', filters.sociedad)
  if (filters?.estado) query = query.eq('estado', filters.estado)
  if (filters?.moneda) query = query.eq('moneda', filters.moneda)
  if (filters?.dateFrom) query = query.gte('fecha_vencimiento', filters.dateFrom)
  if (filters?.dateTo) query = query.lte('fecha_vencimiento', filters.dateTo)
  if (filters?.tieneFactoraje !== undefined) query = query.eq('tiene_factoraje', filters.tieneFactoraje)
  if (filters?.search) {
    // Sanitize to prevent PostgREST filter-grammar injection (see commission-math).
    const safeSearch = sanitizePostgrestValue(filters.search)
    query = query.or(
      `razon_social_cliente.ilike.%${safeSearch}%,numero_documento.ilike.%${safeSearch}%,vendedor.ilike.%${safeSearch}%`
    )
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  // Auto-mark overdue invoices as "Vencida"
  const today = new Date().toISOString().split('T')[0]
  const overdue = (data || []).filter(
    (inv) => inv.estado === 'Pendiente' && inv.fecha_vencimiento && inv.fecha_vencimiento < today
  )
  if (overdue.length > 0) {
    const overdueIds = overdue.map((inv) => inv.id)
    await supabase
      .from('income_invoices')
      .update({ estado: 'Vencida' })
      .in('id', overdueIds)
    // Update the returned data in-place
    for (const inv of data || []) {
      if (overdueIds.includes(inv.id)) {
        inv.estado = 'Vencida'
      }
    }
  }

  return data
}

export async function createIncomeInvoice(data: IncomeInvoiceInsert) {
  const supabase = await createClient()
  const { data: created, error } = await (supabase as any).from('income_invoices').insert(data).select().single()
  if (error) throw new Error(error.message)

  // FIX #2 / #6: Atribuir Hunter originador en el server (altitud correcta).
  // Cuando la factura es de un cliente nuevo por canal Hunter, registramos el
  // originador en hacku_clientes para que el 1% perpetuo quede asignado.
  // Esta lógica centralizada reemplaza el bloque que vivía en income-invoices-table.tsx.
  if (
    (data as any).es_cliente_nuevo &&
    (data as any).canal_origen === 'hunter' &&
    (data as any).hacku_cliente
  ) {
    try {
      const { getOrCreateHackuCliente, setHunterOriginador } = await import('@/actions/hacku-clientes.actions')
      const hackuCliente = await getOrCreateHackuCliente((data as any).hacku_cliente)
      if (hackuCliente?.id) {
        // Resolve vendedor_id: prefer the explicit FK, fall back to name lookup.
        let vendedorId: string | null = (data as any).vendedor_id || null
        if (!vendedorId && (data as any).vendedor) {
          // Import here to avoid circular deps — master-lists is a separate module.
          const { getVendedores } = await import('@/actions/master-lists.actions')
          const allVendedores = await getVendedores()
          const match = (allVendedores as any[])?.find(
            (v: any) => v.nombre?.trim().toLowerCase() === ((data as any).vendedor as string)?.trim().toLowerCase()
          ) as any
          if (match?.rol === 'Hunter') vendedorId = match.id
          else if (match) {
            console.warn(
              `[HunterOriginador] canal=hunter pero vendedor "${(data as any).vendedor}" tiene rol "${match?.rol ?? 'desconocido'}". No se atribuyó originador.`
            )
          }
        } else if (vendedorId) {
          // Verify the provided vendedor_id actually has rol='Hunter'
          const { getVendedores } = await import('@/actions/master-lists.actions')
          const allVendedores = await getVendedores()
          const match = (allVendedores as any[])?.find((v: any) => v.id === vendedorId) as any
          if (match && match.rol !== 'Hunter') {
            console.warn(
              `[HunterOriginador] canal=hunter pero vendedor "${match?.nombre}" (id=${vendedorId}) tiene rol "${match?.rol}". No se atribuyó originador.`
            )
            vendedorId = null
          }
        }

        if (vendedorId) {
          await setHunterOriginador(hackuCliente.id, vendedorId)
        }
      }
    } catch (e) {
      console.error('[HunterOriginador] Auto-attribution in createIncomeInvoice failed:', e)
    }
  }

  revalidatePath('/income-invoices')
  revalidatePath('/dashboard')
  return created
}

export async function updateIncomeInvoice(id: string, data: IncomeInvoiceUpdate) {
  // Prevent marking as "Pagada" without fecha_pago_o_cobro
  if ((data as any).estado === 'Pagada' && !(data as any).fecha_pago_o_cobro) {
    const supabase2 = await createClient()
    const { data: existing } = await supabase2.from('income_invoices').select('fecha_pago_o_cobro').eq('id', id).single()
    if (!existing?.fecha_pago_o_cobro) {
      throw new Error('No se puede marcar como Pagada sin Fecha de Cobro')
    }
  }
  const supabase = await createClient()
  const { error } = await supabase.from('income_invoices').update(data).eq('id', id)
  if (error) throw new Error(error.message)

  // Sync commission statuses based on new invoice estado
  const newEstado = (data as any).estado
  if (newEstado) {
    let commStatus: string | null = null
    if (newEstado === 'Pagada') commStatus = 'por_pagar'
    else if (newEstado === 'Anulada') commStatus = 'anulada'
    else if (newEstado === 'Pendiente' || newEstado === 'Vencida') commStatus = 'pendiente'

    if (commStatus) {
      // Update vendor_commissions
      await (supabase as any)
        .from('vendor_commissions')
        .update({ status: commStatus })
        .eq('income_invoice_id', id)
        .neq('status', 'pagada') // don't change already-paid commissions

      // Update invoice_item_commissions
      await (supabase as any)
        .from('invoice_item_commissions')
        .update({ status: commStatus })
        .eq('income_invoice_id', id)
        .neq('status', 'pagada') // don't change already-paid commissions
    }
  }

  revalidatePath('/income-invoices')
  revalidatePath('/comisiones')
  revalidatePath('/dashboard')
}

export async function deleteIncomeInvoice(id: string) {
  const supabase = await createClient()
  // Delete related commissions first (vendor_commissions may not have CASCADE)
  await (supabase as any).from('vendor_commissions').delete().eq('income_invoice_id', id)
  await (supabase as any).from('invoice_item_commissions').delete().eq('income_invoice_id', id)
  await (supabase as any).from('invoice_commission_participants').delete().eq('income_invoice_id', id)
  // Now delete the invoice
  const { error } = await supabase.from('income_invoices').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/income-invoices')
  revalidatePath('/comisiones')
  revalidatePath('/dashboard')
}

export async function bulkCreateIncomeInvoices(rows: IncomeInvoiceInsert[]) {
  const supabase = await createClient()
  const BATCH_SIZE = 100
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.from('income_invoices').insert(batch)
    if (error) throw new Error(error.message)
  }
  revalidatePath('/income-invoices')
  revalidatePath('/dashboard')
}

export async function markIncomeInvoicePaid(id: string, fechaPago: string) {
  if (!fechaPago) throw new Error('Fecha de cobro es requerida para marcar como Pagada')
  const supabase = await createClient()
  const { error } = await supabase
    .from('income_invoices')
    .update({ estado: 'Pagada', fecha_pago_o_cobro: fechaPago })
    .eq('id', id)
  if (error) throw new Error(error.message)

  // Commissions become "por_pagar" when invoice is paid
  await (supabase as any).from('vendor_commissions').update({ status: 'por_pagar' }).eq('income_invoice_id', id).neq('status', 'pagada')
  await (supabase as any).from('invoice_item_commissions').update({ status: 'por_pagar' }).eq('income_invoice_id', id).neq('status', 'pagada')

  revalidatePath('/income-invoices')
  revalidatePath('/comisiones')
  revalidatePath('/dashboard')
}

export async function cancelIncomeInvoice(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('income_invoices')
    .update({ estado: 'Anulada' })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/income-invoices')
  revalidatePath('/dashboard')
}

export async function getDashboardIncomeStats() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('income_invoices')
    .select('sociedad, estado, total_usd, moneda, total_moneda_local')

  if (error) throw new Error(error.message)
  return data
}
