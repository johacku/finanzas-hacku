/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { createClient } from '@/lib/supabase/server'

// Save a mapping between razón social and hackÜ cliente
export async function saveClientMapping(razonSocial: string, hackuClienteNombre: string) {
  if (!razonSocial || !hackuClienteNombre) return
  const supabase = await createClient()
  await (supabase as any)
    .from('client_razon_social_map')
    .upsert({ razon_social: razonSocial, hacku_cliente_nombre: hackuClienteNombre }, { onConflict: 'razon_social' })
}

// Get hackÜ cliente name for a razón social
export async function getHackuClienteForRazonSocial(razonSocial: string): Promise<string | null> {
  if (!razonSocial) return null
  const supabase = await createClient()
  const { data } = await (supabase as any)
    .from('client_razon_social_map')
    .select('hacku_cliente_nombre')
    .eq('razon_social', razonSocial)
    .single()
  return data?.hacku_cliente_nombre || null
}

// Get all mappings
export async function getAllClientMappings(): Promise<Array<{ razon_social: string; hacku_cliente_nombre: string }>> {
  const supabase = await createClient()
  const { data } = await (supabase as any)
    .from('client_razon_social_map')
    .select('razon_social, hacku_cliente_nombre')
    .order('hacku_cliente_nombre', { ascending: true })
  return data || []
}
