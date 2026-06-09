'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Database } from '@/types/database.types'
import type { LatestRates } from '@/lib/currency'
import type { CurrencyPair } from '@/lib/constants'

type TrmRateInsert = Database['public']['Tables']['trm_rates']['Insert']

export async function getTrmRates() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('trm_rates')
    .select('*')
    .order('fecha', { ascending: false })
    .limit(200)

  if (error) throw new Error(error.message)
  return data
}

export async function getLatestRates(): Promise<LatestRates> {
  const supabase = await createClient()
  const pairs: CurrencyPair[] = ['USDCOP', 'USDMXN', 'USDBRL', 'USDPEN', 'USDEUR']
  const rates: LatestRates = {}

  await Promise.all(
    pairs.map(async (par) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('trm_rates')
        .select('tasa_cierre')
        .eq('par', par)
        .order('fecha', { ascending: false })
        .limit(1)
        .single()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (data) rates[par] = (data as any).tasa_cierre
    })
  )

  // If no cached rates, fetch live from API
  const hasRates = Object.values(rates).some(v => v != null)
  if (!hasRates) {
    try {
      const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD', {
        headers: { Accept: 'application/json' },
        next: { revalidate: 3600 },
      })
      if (res.ok) {
        const data = await res.json()
        const pairMap: Record<string, string> = { USDCOP: 'COP', USDMXN: 'MXN', USDBRL: 'BRL', USDPEN: 'PEN', USDEUR: 'EUR' }
        for (const par of pairs) {
          const currency = pairMap[par]
          if (currency && data.rates?.[currency]) {
            rates[par] = data.rates[currency]
          }
        }
      }
    } catch (e) {
      console.warn('[TRM] Failed to fetch live rates:', e)
      // Hardcoded fallbacks
      rates.USDCOP = rates.USDCOP || 4150
      rates.USDMXN = rates.USDMXN || 17
      rates.USDBRL = rates.USDBRL || 5
      rates.USDPEN = rates.USDPEN || 3.7
      rates.USDEUR = rates.USDEUR || 0.92
    }
  }

  return rates
}

export async function upsertTrmRate(data: TrmRateInsert) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('trm_rates')
    .upsert(data, { onConflict: 'par,fecha' })

  if (error) throw new Error(error.message)
  revalidatePath('/trm-rates')
  revalidatePath('/dashboard')
}

export async function deleteTrmRate(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('trm_rates').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/trm-rates')
  revalidatePath('/dashboard')
}
