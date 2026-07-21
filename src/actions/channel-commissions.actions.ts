/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getChannelCommissions() {
  const supabase = await createClient()
  const { data, error } = await (supabase as any)
    .from('channel_commission_config')
    .select('*')
    .eq('activo', true)
    .order('canal')
  if (error) { console.warn('[ChannelCommissions]', error.message); return [] }
  return data || []
}

export async function createChannelCommission(canal: string, porcentaje_comision: number, descripcion?: string) {
  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('channel_commission_config')
    .insert({ canal, porcentaje_comision, descripcion })
  if (error) throw new Error(error.message)
  revalidatePath('/settings/master-lists')
}

export async function updateChannelCommission(id: string, data: Record<string, any>) {
  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('channel_commission_config')
    .update(data)
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/settings/master-lists')
}

export async function deleteChannelCommission(id: string) {
  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('channel_commission_config')
    .update({ activo: false })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/settings/master-lists')
}
