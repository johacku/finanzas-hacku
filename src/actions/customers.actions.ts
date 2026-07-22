/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getAllAlegraContacts } from './alegra.actions'
import { sanitizePostgrestValue } from '@/lib/commission-math'

export async function getCustomers(filters?: {
  sociedadCliente?: string
  kam?: string
  tieneFactoraje?: boolean
  search?: string
}) {
  const supabase = await createClient()

  let query = (supabase as any)
    .from('customers')
    .select('*')
    .order('nombre_cliente', { ascending: true })

  if (filters?.sociedadCliente) query = query.eq('sociedad_cliente', filters.sociedadCliente)
  if (filters?.kam) query = query.eq('kam_responsable', filters.kam)
  if (filters?.tieneFactoraje !== undefined) query = query.eq('tiene_factoraje', filters.tieneFactoraje)
  if (filters?.search) {
    // Sanitize to prevent PostgREST filter-grammar injection (see commission-math).
    const safeSearch = sanitizePostgrestValue(filters.search)
    query = query.or(
      `nombre_cliente.ilike.%${safeSearch}%,kam_responsable.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%`
    )
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data || []
}

export async function createCustomer(data: Record<string, any>) {
  const supabase = await createClient()
  const { error } = await (supabase as any).from('customers').insert(data)
  if (error) throw new Error(error.message)
  revalidatePath('/customers')
  revalidatePath('/settings/master-lists')
}

export async function updateCustomer(id: string, data: Record<string, any>) {
  const supabase = await createClient()
  const { error } = await (supabase as any).from('customers').update(data).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/customers')
  revalidatePath('/settings/master-lists')
}

export async function deleteCustomer(id: string) {
  const supabase = await createClient()
  const { error } = await (supabase as any).from('customers').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/customers')
  revalidatePath('/settings/master-lists')
}

// Get customer by razón social (for auto-filling in forms)
export async function getCustomerByRazonSocial(razonSocial: string) {
  const supabase = await createClient()
  // Sanitize razonSocial before PostgREST interpolation.
  // includeBraces: quotes/braces are especially dangerous inside the .cs.{...}
  // JSON-contains clause below (filter-grammar injection).
  const safe = sanitizePostgrestValue(razonSocial, true)
  // Search in nombre_cliente or razones_sociales array
  const { data } = await (supabase as any)
    .from('customers')
    .select('*')
    .or(`nombre_cliente.ilike.${safe},razones_sociales.cs.{"${safe}"}`)
    .limit(1)
    .single()
  return data || null
}

// Sync customers from Alegra
export async function syncAlegraCustomers(): Promise<{
  synced: number
  created: number
  updated: number
}> {
  const supabase = await createClient()
  const contacts = await getAllAlegraContacts()

  const { data: existing, error: fetchError } = await (supabase as any)
    .from('customers')
    .select('id, nombre_cliente')
  if (fetchError) throw new Error(fetchError.message)

  const existingMap = new Map(
    (existing ?? []).map((c: any) => [c.nombre_cliente.toLowerCase(), c.id])
  )

  let created = 0
  let updated = 0

  for (const contact of contacts) {
    const name: string = contact.name?.trim()
    if (!name) continue

    const existingId = existingMap.get(name.toLowerCase())

    if (existingId) {
      await (supabase as any)
        .from('customers')
        .update({ sociedad_cliente: 'hackÜ SAS' })
        .eq('id', existingId)
        .is('sociedad_cliente', null)
      updated++
    } else {
      const { error } = await (supabase as any)
        .from('customers')
        .insert({ nombre_cliente: name, sociedad_cliente: 'hackÜ SAS' })
      if (!error) created++
    }
  }

  revalidatePath('/customers')
  revalidatePath('/settings/master-lists')
  return { synced: contacts.length, created, updated }
}
