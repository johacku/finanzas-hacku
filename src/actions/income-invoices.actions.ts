'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Database } from '@/types/database.types'

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
    .order('fecha_vencimiento', { ascending: false })

  if (filters?.sociedad) query = query.eq('sociedad', filters.sociedad)
  if (filters?.estado) query = query.eq('estado', filters.estado)
  if (filters?.moneda) query = query.eq('moneda', filters.moneda)
  if (filters?.dateFrom) query = query.gte('fecha_vencimiento', filters.dateFrom)
  if (filters?.dateTo) query = query.lte('fecha_vencimiento', filters.dateTo)
  if (filters?.tieneFactoraje !== undefined) query = query.eq('tiene_factoraje', filters.tieneFactoraje)
  if (filters?.search) {
    query = query.or(
      `razon_social_cliente.ilike.%${filters.search}%,numero_documento.ilike.%${filters.search}%,vendedor.ilike.%${filters.search}%`
    )
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data
}

export async function createIncomeInvoice(data: IncomeInvoiceInsert) {
  const supabase = await createClient()
  const { error } = await supabase.from('income_invoices').insert(data)
  if (error) throw new Error(error.message)
  revalidatePath('/income-invoices')
  revalidatePath('/dashboard')
}

export async function updateIncomeInvoice(id: string, data: IncomeInvoiceUpdate) {
  const supabase = await createClient()
  const { error } = await supabase.from('income_invoices').update(data).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/income-invoices')
  revalidatePath('/dashboard')
}

export async function deleteIncomeInvoice(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('income_invoices').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/income-invoices')
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

export async function getDashboardIncomeStats() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('income_invoices')
    .select('sociedad, estado, total_usd, moneda, total_moneda_local')

  if (error) throw new Error(error.message)
  return data
}
