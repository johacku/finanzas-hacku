import { getPayroll } from '@/actions/payroll.actions'
import { PayrollPageClient } from '@/components/payroll/payroll-page-client'

export const dynamic = 'force-dynamic'

export default async function PayrollPage() {
  const payroll = await getPayroll()
  return <PayrollPageClient initialData={payroll} />
}
