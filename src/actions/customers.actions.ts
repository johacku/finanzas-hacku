'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Database } from '@/types/database.types'
import { getAllAlegraContacts } from './alegra.actions'

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

// ---------------------------------------------------------------------------
// Sync customers from Alegra
// ---------------------------------------------------------------------------

export async function syncAlegraCustomers(): Promise<{
  synced: number
  created: number
  updated: number
}> {
  const supabase = await createClient()

  // 1. Fetch all contacts from Alegra
  const contacts = await getAllAlegraContacts()

  // 2. Fetch existing customers keyed by nombre_cliente
  const { data: existing, error: fetchError } = await supabase
    .from('customers')
    .select('id, nombre_cliente')
  if (fetchError) throw new Error(fetchError.message)

  const existingMap = new Map(
    (existing ?? []).map((c) => [c.nombre_cliente.toLowerCase(), c.id])
  )

  let created = 0
  let updated = 0

  // 3. Upsert each Alegra contact
  for (const contact of contacts) {
    const name: string = contact.name?.trim()
    if (!name) continue

    const customerData: CustomerInsert = {
      nombre_cliente: name,
      sociedad_cliente: 'hackÜ SAS',
    }

    const existingId = existingMap.get(name.toLowerCase())

    if (existingId) {
      // Update only sociedad if not already set — avoid overwriting other fields
      const { error } = await supabase
        .from('customers')
        .update({ sociedad_cliente: 'hackÜ SAS' } as CustomerUpdate)
        .eq('id', existingId)
        .is('sociedad_cliente', null)
      if (!error) updated++
    } else {
      const { error } = await supabase
        .from('customers')
        .insert(customerData)
      if (!error) created++
    }
  }

  revalidatePath('/customers')

  return { synced: contacts.length, created, updated }
}
