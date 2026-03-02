import { getCustomers } from '@/actions/customers.actions'
import { CustomersPageClient } from '@/components/customers/customers-page-client'

export const dynamic = 'force-dynamic'

export default async function CustomersPage() {
  const customers = await getCustomers()
  return <CustomersPageClient initialData={customers} />
}
