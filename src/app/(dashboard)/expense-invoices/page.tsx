import { getExpenseInvoices } from '@/actions/expense-invoices.actions'
import { ExpenseInvoicesTable } from '@/components/expense-invoices/expense-invoices-table'

export const dynamic = 'force-dynamic'

export default async function ExpenseInvoicesPage() {
  const invoices = await getExpenseInvoices()
  return <ExpenseInvoicesTable initialData={invoices} />
}
