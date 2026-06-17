/* eslint-disable @typescript-eslint/no-explicit-any */
import { AlegraInvoicesTable } from '@/components/alegra-invoices/alegra-invoices-table'

export const dynamic = 'force-dynamic'

async function getData() {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()

    const { data: requests } = await (supabase as any)
      .from('alegra_invoice_requests')
      .select('*')
      .order('created_at', { ascending: false })

    let userEmail = ''
    let userName = ''
    try {
      const { data: { user } } = await supabase.auth.getUser()
      userEmail = user?.email || ''
      userName = user?.user_metadata?.full_name || user?.email || ''
    } catch {}

    return { requests: requests || [], userEmail, userName }
  } catch (e: any) {
    console.error('[alegra-invoices page]', e?.message || e)
    return { requests: [], userEmail: '', userName: '' }
  }
}

export default async function AlegraInvoicesPage() {
  const { requests, userEmail, userName } = await getData()

  return (
    <AlegraInvoicesTable
      initialData={requests}
      userEmail={userEmail}
      userName={userName}
    />
  )
}
