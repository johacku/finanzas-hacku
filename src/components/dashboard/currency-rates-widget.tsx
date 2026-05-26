import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp } from 'lucide-react'
import type { LatestRates } from '@/lib/currency'
import type { CurrencyPair } from '@/lib/constants'

interface CurrencyRatesWidgetProps {
  rates: LatestRates
}

const PAIR_LABELS: Record<CurrencyPair, string> = {
  USDCOP: 'USD → COP',
  USDMXN: 'USD → MXN',
  USDBRL: 'USD → BRL',
  USDPEN: 'USD → PEN',
  USDEUR: 'USD → EUR',
}

const PAIR_FLAGS: Record<CurrencyPair, string> = {
  USDCOP: '🇨🇴',
  USDMXN: '🇲🇽',
  USDBRL: '🇧🇷',
  USDPEN: '🇵🇪',
  USDEUR: '🇪🇺',
}

export function CurrencyRatesWidget({ rates }: CurrencyRatesWidgetProps) {
  const pairs: CurrencyPair[] = ['USDCOP', 'USDMXN', 'USDBRL', 'USDPEN', 'USDEUR']

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-slate-600">TRM / Tasas de Cambio</CardTitle>
        <TrendingUp className="h-4 w-4 text-slate-400" />
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {pairs.map((pair) => {
            const rate = rates[pair]
            return (
              <div key={pair} className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <span>{PAIR_FLAGS[pair]}</span>
                  <span className="text-slate-600">{PAIR_LABELS[pair]}</span>
                </div>
                <span className="text-sm font-semibold text-slate-900">
                  {rate ? rate.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'}
                </span>
              </div>
            )
          })}
        </div>
        <p className="text-xs text-slate-400 mt-3">Última tasa registrada</p>
      </CardContent>
    </Card>
  )
}
