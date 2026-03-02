'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Database } from '@/types/database.types'

type ExpenseInvoiceInsert = Database['public']['Tables']['expense_invoices']['Insert']
type ExpenseInvoiceUpdate = Database['public']['Tables']['expense_invoices']['Update']
type SociedadEnum = Database['public']['Enums']['sociedad_enum']
type TipoEnum = Database['public']['Enums']['expense_tipo']
type AreaEnum = string
type CategoriaEnum = string

export async function getExpenseInvoices(filters?: {
  sociedad?: SociedadEnum
  tipo?: TipoEnum
  area?: AreaEnum
  categoria?: CategoriaEnum
  prioridad?: number
  dateFrom?: string
  dateTo?: string
  search?: string
}) {
  const supabase = await createClient()

  let query = supabase
    .from('expense_invoices')
    .select('*')
    .order('fecha_emision', { ascending: false })

  if (filters?.sociedad) query = query.eq('sociedad', filters.sociedad)
  if (filters?.tipo) query = query.eq('tipo', filters.tipo)
  if (filters?.area) query = query.eq('area', filters.area)
  if (filters?.categoria) query = query.eq('categoria', filters.categoria)
  if (filters?.prioridad) query = query.eq('prioridad_pago', filters.prioridad)
  if (filters?.dateFrom) query = query.gte('fecha_emision', filters.dateFrom)
  if (filters?.dateTo) query = query.lte('fecha_emision', filters.dateTo)
  if (filters?.search) {
    query = query.ilike('nombre_proveedor_concepto', `%${filters.search}%`)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data
}

export async function createExpenseInvoice(data: ExpenseInvoiceInsert) {
  const supabase = await createClient()
  const { error } = await supabase.from('expense_invoices').insert(data)
  if (error) throw new Error(error.message)
  revalidatePath('/expense-invoices')
  revalidatePath('/dashboard')
}

export async function updateExpenseInvoice(id: string, data: ExpenseInvoiceUpdate) {
  const supabase = await createClient()
  const { error } = await supabase.from('expense_invoices').update(data).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/expense-invoices')
  revalidatePath('/dashboard')
}

export async function deleteExpenseInvoice(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('expense_invoices').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/expense-invoices')
  revalidatePath('/dashboard')
}

export async function bulkCreateExpenseInvoices(rows: ExpenseInvoiceInsert[]) {
  const supabase = await createClient()
  const BATCH_SIZE = 100
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.from('expense_invoices').insert(batch)
    if (error) throw new Error(error.message)
  }
  revalidatePath('/expense-invoices')
  revalidatePath('/dashboard')
}
