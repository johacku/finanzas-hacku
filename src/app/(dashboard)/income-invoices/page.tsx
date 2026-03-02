import { getIncomeInvoices } from '@/actions/income-invoices.actions'
import { IncomeInvoicesTable } from '@/components/income-invoices/income-invoices-table'

export const dynamic = 'force-dynamic'

export default async function IncomeInvoicesPage() {
  const invoices = await getIncomeInvoices()
  return <IncomeInvoicesTable initialData={invoices} />
}
