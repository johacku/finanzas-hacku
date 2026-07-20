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

// Sync items from Alegra (fetch all and upsert)
export async function syncAlegraItems() {
  // Import the hardcoded items from alegra.actions
  const ITEMS = [
    { id: '1', name: 'Panel administrativo: Dashboard' },
    { id: '3', name: 'Linea personalizada de WhatsApp' },
    { id: '8', name: 'Hora de desarrollo de software' },
    { id: '20', name: 'Licencias Starter' },
    { id: '33', name: 'Creación de contenido' },
    { id: '47', name: 'Mensajes masivos' },
    { id: '49', name: 'Licencias PRO' },
    { id: '80', name: 'Sesiones de Whatsapp' },
    { id: '95', name: 'Hora de entrenamiento' },
    { id: '101', name: 'Implementación' },
    { id: '107', name: 'Minutos de edicion' },
    { id: '154', name: 'Licencias hackÜ Comms' },
  ]

  const supabase = await createClient()
  let created = 0

  for (const item of ITEMS) {
    const { error } = await (supabase as any)
      .from('item_commission_config')
      .upsert({
        alegra_item_id: item.id,
        nombre: item.name,
        activo: true,
      }, { onConflict: 'alegra_item_id' })
    if (!error) created++
  }

  revalidatePath('/settings/master-lists')
  return { synced: created }
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
export function calculateCommissionPercent(ranges: any[], price: number): number {
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
