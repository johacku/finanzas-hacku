/* eslint-disable @typescript-eslint/no-explicit-any */
import { getBankAccounts } from '@/actions/bank-accounts.actions'
import { getDailyBalancesForDate } from '@/actions/daily-balances.actions'
import { createClient } from '@/lib/supabase/server'
import { SaldosBancariosClient } from '@/components/saldos-bancarios/saldos-bancarios-client'

export const dynamic = 'force-dynamic'

export default async function SaldosBancariosPage() {
  const bankAccounts = await getBankAccounts()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const today = new Date().toISOString().split('T')[0]
  const todayBalances = await getDailyBalancesForDate(today)

  return (
    <SaldosBancariosClient
      bankAccounts={bankAccounts || []}
      initialBalances={todayBalances || []}
      userEmail={user?.email || ''}
    />
  )
}
