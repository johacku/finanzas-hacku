/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getDailyBalances(from?: string, to?: string) {
  try {
    const supabase = await createClient()
    let query = (supabase as any)
      .from('daily_bank_balances')
      .select('*')
      .order('fecha', { ascending: false })

    if (from) query = query.gte('fecha', from)
    if (to) query = query.lte('fecha', to)

    const { data, error } = await query.limit(90)
    if (error) { console.warn('[DailyBalances]', error.message); return [] }
    return data || []
  } catch { return [] }
}

export async function getLatestBalance() {
  try {
    const supabase = await createClient()
    const { data, error } = await (supabase as any)
      .from('daily_bank_balances')
      .select('*')
      .order('fecha', { ascending: false })
      .limit(1)
      .single()
    if (error) return null
    return data
  } catch { return null }
}

export async function upsertDailyBalance(data: {
  fecha: string
  saldo_inicial_usd: number
  saldo_cierre_usd?: number | null
  notas?: string
  registrado_por?: string
}) {
  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('daily_bank_balances')
    .upsert(data, { onConflict: 'fecha' })
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard')
  revalidatePath('/cashflow')
}

export async function deleteDailyBalance(fecha: string) {
  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('daily_bank_balances')
    .delete()
    .eq('fecha', fecha)
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard')
}
