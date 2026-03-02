'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Database } from '@/types/database.types'

type CustomerInsert = Database['public']['Tables']['customers']['Insert']
type CustomerUpdate = Database['public']['Tables']['customers']['Update']

export async function getCustomers(filters?: {
  sociedadCliente?: string
  kam?: string
  tieneFactoraje?: boolean
  search?: string
}) {
  const supabase = await createClient()

  let query = supabase
    .from('customers')
    .select('*')
    .order('nombre_cliente', { ascending: true })

  if (filters?.sociedadCliente) query = query.eq('sociedad_cliente', filters.sociedadCliente)
  if (filters?.kam) query = query.eq('kam_responsable', filters.kam)
  if (filters?.tieneFactoraje !== undefined) query = query.eq('tiene_factoraje', filters.tieneFactoraje)
  if (filters?.search) {
    query = query.or(
      `nombre_cliente.ilike.%${filters.search}%,kam_responsable.ilike.%${filters.search}%`
    )
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data
}

export async function createCustomer(data: CustomerInsert) {
  const supabase = await createClient()
  const { error } = await supabase.from('customers').insert(data)
  if (error) throw new Error(error.message)
  revalidatePath('/customers')
}

export async function updateCustomer(id: string, data: CustomerUpdate) {
  const supabase = await createClient()
  const { error } = await supabase.from('customers').update(data).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/customers')
}

export async function deleteCustomer(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('customers').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/customers')
}
