/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// Get all balances for a date, joined with bank account info
export async function getDailyBalancesForDate(fecha: string) {
  try {
    const supabase = await createClient()
    const { data, error } = await (supabase as any)
      .from('daily_bank_balances')
      .select('*, bank_accounts(id, nombre, banco, tipo, numero, sociedad, moneda)')
      .eq('fecha', fecha)
    if (error) { console.warn('[DailyBalances]', error.message); return [] }
    return data || []
  } catch { return [] }
}

// Get the latest date that has any balance entries
export async function getLatestBalanceDate() {
  try {
    const supabase = await createClient()
    const { data, error } = await (supabase as any)
      .from('daily_bank_balances')
      .select('fecha')
      .order('fecha', { ascending: false })
      .limit(1)
      .single()
    if (error) return null
    return data?.fecha || null
  } catch { return null }
}

// Get total USD balance for the latest date (sum of all accounts)
export async function getLatestTotalBalanceUSD() {
  try {
    const supabase = await createClient()
    // Get latest date
    const { data: latest } = await (supabase as any)
      .from('daily_bank_balances')
      .select('fecha')
      .order('fecha', { ascending: false })
      .limit(1)
      .single()

    if (!latest) return { total: 0, fecha: null, accounts: [] }

    const { data: balances } = await (supabase as any)
      .from('daily_bank_balances')
      .select('saldo_inicial, saldo_inicial_usd, bank_accounts(nombre, banco, moneda)')
      .eq('fecha', latest.fecha)

    const accounts = (balances || []).map((b: any) => ({
      nombre: b.bank_accounts?.nombre || 'Cuenta',
      banco: b.bank_accounts?.banco || '',
      moneda: b.bank_accounts?.moneda || 'USD',
      saldo_inicial: Number(b.saldo_inicial) || 0,
      saldo_inicial_usd: Number(b.saldo_inicial_usd) || Number(b.saldo_inicial) || 0,
    }))

    const total = accounts.reduce((sum: number, a: any) => sum + a.saldo_inicial_usd, 0)

    return { total, fecha: latest.fecha, accounts }
  } catch { return { total: 0, fecha: null, accounts: [] } }
}

// Get all balances (history), joined with bank account info
export async function getDailyBalances(limit = 90) {
  try {
    const supabase = await createClient()
    const { data, error } = await (supabase as any)
      .from('daily_bank_balances')
      .select('*, bank_accounts(nombre, banco, tipo, moneda)')
      .order('fecha', { ascending: false })
      .limit(limit)
    if (error) { console.warn('[DailyBalances]', error.message); return [] }
    return data || []
  } catch { return [] }
}

// Upsert balance for a specific account and date
export async function upsertAccountBalance(data: {
  fecha: string
  bank_account_id: string
  saldo_inicial: number
  saldo_inicial_usd?: number
  saldo_cierre?: number | null
  saldo_cierre_usd?: number | null
  registrado_por?: string
}) {
  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('daily_bank_balances')
    .upsert(data, { onConflict: 'fecha,bank_account_id' })
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard')
}

// Bulk upsert - save all account balances for a date at once
export async function bulkUpsertDailyBalances(fecha: string, balances: Array<{
  bank_account_id: string
  saldo_inicial: number
  saldo_inicial_usd?: number
  saldo_cierre?: number | null
  saldo_cierre_usd?: number | null
}>, registrado_por?: string) {
  const supabase = await createClient()
  const rows = balances.map(b => ({
    fecha,
    ...b,
    registrado_por,
  }))
  const { error } = await (supabase as any)
    .from('daily_bank_balances')
    .upsert(rows, { onConflict: 'fecha,bank_account_id' })
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard')
}
