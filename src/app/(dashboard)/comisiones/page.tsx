/* eslint-disable @typescript-eslint/no-explicit-any */
import { getCommissions, getCommissionsSummary, syncCommissionStatuses } from '@/actions/commissions.actions'
import { createClient } from '@/lib/supabase/server'
import { ComisionesClient } from '@/components/comisiones/comisiones-client'

export const dynamic = 'force-dynamic'

export default async function ComisionesPage({ searchParams }: { searchParams: Promise<{ factura?: string }> }) {
  const params = await searchParams

  // Auto-sync statuses
  await syncCommissionStatuses().catch(console.error)

  const commissions = await getCommissions()
  const summary = await getCommissionsSummary()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <ComisionesClient
      commissions={commissions}
      summary={summary}
      userEmail={user?.email || ''}
      initialSearch={params.factura || ''}
    />
  )
}
