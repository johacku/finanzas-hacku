import { getWeeklyCashflow } from '@/actions/cashflow.actions'
import { CashflowPageClient } from '@/components/weekly-cashflow/cashflow-page-client'
import { getWeekRange, formatDateForDB } from '@/lib/date'

export const dynamic = 'force-dynamic'

export default async function WeeklyCashflowPage() {
  // Fetch last 24 weeks of data for navigation
  const weeks = getWeekRange(24)
  const startDate = formatDateForDB(weeks[0])

  const data = await getWeeklyCashflow({ weekStart: startDate })

  return <CashflowPageClient initialData={data} />
}
