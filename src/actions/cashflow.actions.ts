'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Database } from '@/types/database.types'

type WeeklyCashflowInsert = Database['public']['Tables']['weekly_cashflow_entries']['Insert']
type WeeklyCashflowUpdate = Database['public']['Tables']['weekly_cashflow_entries']['Update']

export async function getWeeklyCashflow(filters?: {
  sociedad?: string
  weekStart?: string
  weekEnd?: string
}) {
  const supabase = await createClient()

  let query = supabase
    .from('weekly_cashflow_entries')
    .select('*')
    .order('week_start_date', { ascending: false })

  if (filters?.sociedad) query = query.eq('sociedad', filters.sociedad as Database['public']['Enums']['sociedad_enum'])
  if (filters?.weekStart) query = query.gte('week_start_date', filters.weekStart)
  if (filters?.weekEnd) query = query.lte('week_start_date', filters.weekEnd)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data
}

export async function upsertCashflowEntry(data: WeeklyCashflowInsert) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('weekly_cashflow_entries')
    .upsert(data, { onConflict: 'sociedad,week_start_date' })

  if (error) throw new Error(error.message)
  revalidatePath('/weekly-cashflow')
  revalidatePath('/dashboard')
}

export async function updateCashflowEntry(id: string, data: WeeklyCashflowUpdate) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('weekly_cashflow_entries')
    .update(data)
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/weekly-cashflow')
  revalidatePath('/dashboard')
}

export async function deleteCashflowEntry(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('weekly_cashflow_entries').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/weekly-cashflow')
}
