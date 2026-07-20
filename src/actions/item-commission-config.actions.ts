/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Get all item configs with their ranges
export async function getItemConfigs() {
  try {
    const supabase = await createClient()
    const { data, error } = await (supabase as any)
      .from('item_commission_config')
      .select('*, item_commission_ranges(*)')
      .order('nombre', { ascending: true })
    if (error) { console.warn('[ItemConfig]', error.message); return [] }
    return data || []
  } catch { return [] }
}

// Get only active items (for the invoice form)
export async function getActiveItems() {
  try {
    const supabase = await createClient()
    const { data, error } = await (supabase as any)
      .from('item_commission_config')
      .select('*, item_commission_ranges(*)')
      .eq('activo', true)
      .order('nombre', { ascending: true })
    if (error) return []
    return data || []
  } catch { return [] }
}

// Sync ALL items from Alegra (paginate and upsert)
export async function syncAlegraItems() {
  const email = process.env.ALEGRA_API_EMAIL
  const token = process.env.ALEGRA_API_TOKEN
  if (!email || !token) return { synced: 0, error: 'Alegra credentials not configured' }

  const auth = Buffer.from(`${email}:${token}`).toString('base64')
  const allItems: Array<{ id: string; name: string; moneda: string; precioDefault: number | null }> = []

  // Paginate through all items
  let start = 0
  const limit = 30
  while (true) {
    const res = await fetch(`https://api.alegra.com/api/v1/items?start=${start}&limit=${limit}&metadata=true`, {
      headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' },
    })
    if (!res.ok) break
    const result = await res.json()
    const data = result.data ?? result
    if (!Array.isArray(data) || data.length === 0) break
    for (const item of data) {
      if (item.id && item.name) {
        const priceInfo = Array.isArray(item.price) ? item.price[0] : null
        const moneda = priceInfo?.currency?.code || 'COP'
        const precioDefault = priceInfo?.price || null
        allItems.push({
          id: String(item.id),
          name: item.name,
          moneda,
          precioDefault,
        })
      }
    }
    if (data.length < limit) break
    start += limit
  }

  const supabase = await createClient()
  let created = 0

  for (const item of allItems) {
    const { error } = await (supabase as any)
      .from('item_commission_config')
      .upsert({
        alegra_item_id: item.id,
        nombre: item.name,
        moneda: item.moneda,
        precio_default: item.precioDefault,
        activo: false, // Default inactive - user activates what they need
      }, { onConflict: 'alegra_item_id' })
    if (!error) created++
  }

  revalidatePath('/settings/master-lists')
  return { synced: created, total: allItems.length }
}

// Toggle item active/inactive
export async function toggleItemActive(id: string, activo: boolean) {
  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('item_commission_config')
    .update({ activo })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/settings/master-lists')
}

// Add a commission range to an item
export async function addCommissionRange(data: {
  item_config_id: string
  precio_desde: number
  precio_hasta: number | null
  porcentaje_comision: number
}) {
  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('item_commission_ranges')
    .insert(data)
  if (error) throw new Error(error.message)
  revalidatePath('/settings/master-lists')
}

// Remove a commission range
export async function removeCommissionRange(id: string) {
  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('item_commission_ranges')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/settings/master-lists')
}

// Calculate commission % for an item at a given price
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function calculateCommissionPercent(ranges: any[], price: number): Promise<number> {
  if (!ranges || ranges.length === 0) return 5 // default 5%

  // Sort by precio_desde ascending
  const sorted = [...ranges].sort((a, b) => (a.precio_desde || 0) - (b.precio_desde || 0))

  for (const range of sorted) {
    const desde = range.precio_desde || 0
    const hasta = range.precio_hasta

    if (price >= desde && (hasta === null || hasta === undefined || price <= hasta)) {
      return range.porcentaje_comision
    }
  }

  // If no range matches, use last range's percentage
  return sorted[sorted.length - 1]?.porcentaje_comision || 5
}
