/* eslint-disable @typescript-eslint/no-explicit-any */
import { getAlegraInvoiceRequests } from '@/actions/alegra.actions'
import { AlegraInvoicesTable } from '@/components/alegra-invoices/alegra-invoices-table'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function AlegraInvoicesPage() {
  let requests: any[] = []
  let userEmail = ''
  let userName = ''

  try {
    requests = await getAlegraInvoiceRequests() || []
  } catch (e) {
    console.error('Failed to load alegra invoice requests:', e)
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    userEmail = user?.email || ''
    userName = user?.user_metadata?.full_name || user?.email || ''
  } catch (e) {
    console.error('Failed to get user:', e)
  }

  return (
    <AlegraInvoicesTable
      initialData={requests}
      userEmail={userEmail}
      userName={userName}
    />
  )
}
