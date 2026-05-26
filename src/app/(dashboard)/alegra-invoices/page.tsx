import { getAlegraInvoiceRequests } from '@/actions/alegra.actions'
import { AlegraInvoicesTable } from '@/components/alegra-invoices/alegra-invoices-table'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function AlegraInvoicesPage() {
  const requests = await getAlegraInvoiceRequests()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <AlegraInvoicesTable
      initialData={requests}
      userEmail={user?.email || ''}
      userName={user?.user_metadata?.full_name || user?.email || ''}
    />
  )
}
