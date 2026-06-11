// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server'
import { getLatestRates } from '@/actions/trm-rates.actions'
import { getLatestTotalBalanceUSD } from '@/actions/daily-balances.actions'
import { formatCurrency, convertToUSD } from '@/lib/currency'
import { SOCIEDADES, SOCIEDAD_CURRENCY_MAP, type Sociedad } from '@/lib/constants'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/shared/page-header'
import { CalendarRange } from 'lucide-react'

export const dynamic = 'force-dynamic'

function getWeekStart(offset = 0): Date {
  const d = new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) + (offset * 7)
  return new Date(d.setDate(diff))
}

function formatDateForDB(d: Date): string {
  return d.toISOString().split('T')[0]
}

function formatWeekRange(start: Date): string {
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${start.toLocaleDateString('es-CO', opts)} – ${end.toLocaleDateString('es-CO', opts)}`
}

export default async function WeeklyCashflowPage() {
  const supabase = await createClient()
  const rates = await getLatestRates()
  const balanceInfo = await getLatestTotalBalanceUSD()

  const { data: incomeData } = await supabase.from('income_invoices').select('*')
  const { data: expenseData } = await supabase.from('expense_invoices').select('*')

  const allIncome = incomeData ?? []
  const allExpense = expenseData ?? []

  function getUSD(invoice: any, type: 'income' | 'expense'): number {
    if (type === 'income') {
      if (invoice.total_usd && invoice.total_usd > 0) return invoice.total_usd
      const local = invoice.total_moneda_local ?? invoice.monto ?? 0
      if (local <= 0) return 0
      const moneda = invoice.moneda ?? (invoice.sociedad ? SOCIEDAD_CURRENCY_MAP[invoice.sociedad as Sociedad] : null) ?? 'COP'
      if (moneda === 'USD') return local
      return convertToUSD(local, moneda, rates) ?? 0
    } else {
      if (invoice.monto_usd && invoice.monto_usd > 0) return invoice.monto_usd
      const local = invoice.monto_pago ?? invoice.monto_sin_impuestos ?? 0
      if (local <= 0) return 0
      const moneda = invoice.moneda ?? (invoice.sociedad ? SOCIEDAD_CURRENCY_MAP[invoice.sociedad as Sociedad] : null) ?? 'COP'
      if (moneda === 'USD') return local
      return convertToUSD(local, moneda, rates) ?? 0
    }
  }

  // Build 4 weeks
  const weeks = [0, 1, 2, 3].map((offset) => {
    const start = getWeekStart(offset)
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    const startStr = formatDateForDB(start)
    const endStr = formatDateForDB(end)

    const label = offset === 0 ? 'Esta semana' : offset === 1 ? 'Próxima' : `+${offset} sem.`

    // Per sociedad
    const bySociedad = SOCIEDADES.map((soc) => {
      // Income: unpaid, due this week (by fecha_vencimiento or fecha_factoraje)
      const incomeItems = allIncome.filter((i: any) => {
        if (i.sociedad !== soc) return false
        if (i.estado === 'Pagada' || i.estado === 'Anulada') return false
        if (i.tiene_factoraje && i.fecha_cobro_factoring) return false
        const fv = (i.tiene_factoraje && i.fecha_factoraje) ? i.fecha_factoraje : i.fecha_vencimiento
        if (!fv) return false
        if (offset === 0) return (fv >= startStr && fv <= endStr) || fv < startStr
        return fv >= startStr && fv <= endStr
      })

      const entradas = incomeItems.reduce((sum: number, i: any) => sum + getUSD(i, 'income'), 0)

      // Expenses: unpaid, due this week
      const expenseItems = allExpense.filter((i: any) => {
        if (i.sociedad !== soc) return false
        if (i.estado === 'Pagada' || i.estado === 'Anulada') return false
        const fp = i.expectativa_pago ?? i.fecha_emision
        if (!fp) return false
        if (offset === 0) return (fp >= startStr && fp <= endStr) || fp < startStr
        return fp >= startStr && fp <= endStr
      })

      const salidas = expenseItems.reduce((sum: number, i: any) => sum + getUSD(i, 'expense'), 0)

      return {
        sociedad: soc,
        entradas,
        salidas,
        neto: entradas - salidas,
        incomeCount: incomeItems.length,
        expenseCount: expenseItems.length,
      }
    })

    const totalEntradas = bySociedad.reduce((s, r) => s + r.entradas, 0)
    const totalSalidas = bySociedad.reduce((s, r) => s + r.salidas, 0)

    return { label, range: formatWeekRange(start), bySociedad, totalEntradas, totalSalidas, totalNeto: totalEntradas - totalSalidas }
  })

  // Render
  return (
    <div className="space-y-6">
      <PageHeader
        title="Flujo de Caja Semanal"
        description="Proyección por sociedad — cobros vs pagos (USD)"
      />

      {/* Bank balance */}
      <Card className="bg-gradient-to-r from-slate-900 to-slate-800 text-white">
        <CardContent className="py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">Saldo bancario consolidado</p>
              <p className="text-xl font-bold">{formatCurrency(balanceInfo.total, 'USD')}</p>
            </div>
            <CalendarRange className="h-5 w-5 text-slate-500" />
          </div>
        </CardContent>
      </Card>

      {/* Weekly grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {weeks.map((week, wi) => (
          <Card key={wi} className={wi === 0 ? 'border-blue-300 border-2' : ''}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">{week.label}</CardTitle>
              <p className="text-[11px] text-muted-foreground">{week.range}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {week.bySociedad.map((s) => {
                if (s.entradas === 0 && s.salidas === 0) return null
                return (
                  <div key={s.sociedad} className="border-b pb-2 last:border-0">
                    <p className="text-xs font-medium text-slate-700 mb-1">{s.sociedad}</p>
                    <div className="grid grid-cols-3 gap-1 text-xs">
                      <div>
                        <p className="text-muted-foreground">Cobros</p>
                        <p className="font-medium text-green-700">{formatCurrency(s.entradas, 'USD')}</p>
                        <p className="text-[10px] text-muted-foreground">{s.incomeCount} fact.</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Pagos</p>
                        <p className="font-medium text-red-700">{formatCurrency(s.salidas, 'USD')}</p>
                        <p className="text-[10px] text-muted-foreground">{s.expenseCount} fact.</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Neto</p>
                        <p className={`font-medium ${s.neto >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                          {formatCurrency(s.neto, 'USD')}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Total */}
              <div className="pt-2 border-t">
                <div className="grid grid-cols-3 gap-1 text-xs">
                  <div>
                    <p className="text-muted-foreground font-semibold">Total</p>
                    <p className="font-bold text-green-800">{formatCurrency(week.totalEntradas, 'USD')}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground font-semibold">&nbsp;</p>
                    <p className="font-bold text-red-800">{formatCurrency(week.totalSalidas, 'USD')}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground font-semibold">&nbsp;</p>
                    <p className={`font-bold ${week.totalNeto >= 0 ? 'text-blue-800' : 'text-orange-800'}`}>
                      {formatCurrency(week.totalNeto, 'USD')}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
