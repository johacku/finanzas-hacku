// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server'
import { AnalyticsClient } from '@/components/analytics/analytics-client'

export const dynamic = 'force-dynamic'

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data } = await (supabase as any)
    .from('alegra_invoice_requests')
    .select('items, sociedad, vendedor_nombre, fecha_emision, moneda, total, total_usd, alegra_client_name, status')
    .neq('status', 'anulada')

  return <AnalyticsClient requests={data || []} />
}
