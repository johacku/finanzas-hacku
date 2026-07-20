/* eslint-disable @typescript-eslint/no-explicit-any */
import { getCommissions, getCommissionsSummary, syncCommissionStatuses } from '@/actions/commissions.actions'
import { getItemCommissions, getItemCommissionSummary } from '@/actions/item-commissions.actions'
import { createClient } from '@/lib/supabase/server'
import { ComisionesClient } from '@/components/comisiones/comisiones-client'

export const dynamic = 'force-dynamic'

export default async function ComisionesPage({ searchParams }: { searchParams: Promise<{ factura?: string }> }) {
  const params = await searchParams

  // Auto-sync statuses
  await syncCommissionStatuses().catch(console.error)

  const [commissions, summary, itemComms, itemSummary] = await Promise.all([
    getCommissions(),
    getCommissionsSummary(),
    getItemCommissions().catch(() => []),
    getItemCommissionSummary().catch(() => ({ byItem: {}, byVendedor: {} })),
  ])

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <ComisionesClient
      commissions={commissions}
      summary={summary}
      itemCommissions={itemComms}
      itemSummary={itemSummary}
      userEmail={user?.email || ''}
      initialSearch={params.factura || ''}
    />
  )
}
