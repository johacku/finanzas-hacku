/* eslint-disable @typescript-eslint/no-explicit-any */
import { getExpenseInvoices } from '@/actions/expense-invoices.actions'
import { ExpenseInvoicesTable } from '@/components/expense-invoices/expense-invoices-table'

export const dynamic = 'force-dynamic'

export default async function ExpenseInvoicesPage() {
  let invoices: any[] = []
  try {
    invoices = await getExpenseInvoices() || []
  } catch (e) {
    console.error('Failed to load expense invoices:', e)
  }
  return <ExpenseInvoicesTable initialData={invoices} />
}
