import { getTrmRates } from '@/actions/trm-rates.actions'
import { TrmRatesPageClient } from '@/components/trm-rates/trm-rates-page-client'

export const dynamic = 'force-dynamic'

export default async function TrmRatesPage() {
  const rates = await getTrmRates()
  return <TrmRatesPageClient initialData={rates} />
}
