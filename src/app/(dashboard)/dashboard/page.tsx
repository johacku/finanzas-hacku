// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server'
import { getLatestRates } from '@/actions/trm-rates.actions'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { CurrencyRatesWidget } from '@/components/dashboard/currency-rates-widget'
import { CashflowChart } from '@/components/dashboard/cashflow-chart'
import { PageHeader } from '@/components/shared/page-header'
import { DollarSign, TrendingUp, TrendingDown, AlertTriangle, Clock } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { getWeekStart, formatDateForDB, getWeekRangePastFuture, formatWeekLabel } from '@/lib/date'
import { SOCIEDADES, type Sociedad } from '@/lib/constants'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SociedadBadge } from '@/components/shared/sociedad-badge'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

/** Safely get a USD amount from an income invoice, handling both column naming schemes */
function getInvoiceUSD(invoice: any): number {
  return invoice.total_usd ?? invoice.monto_usd ?? invoice.monto ?? 0
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const rates = await getLatestRates()

  // Fetch ALL income invoice data (select * to handle both schema versions)
  const { data: incomeData, error: incomeError } = await supabase
    .from('income_invoices')
    .select('*')

  if (incomeError) {
    console.error('Error fetching income invoices for dashboard:', incomeError)
  }

  // Fetch weekly cashflow for chart (8 past + 12 future weeks)
  const weekRange = getWeekRangePastFuture(8, 12)
  const startDate = formatDateForDB(weekRange[0])
  const endDate = formatDateForDB(weekRange[weekRange.length - 1])
  const { data: cashflowData } = await supabase
    .from('weekly_cashflow_entries')
    .select('*')
    .gte('week_start_date', startDate)
    .lte('week_start_date', endDate)
    .order('week_start_date', { ascending: true })

  const allInvoices = incomeData ?? []

  // Pending invoices (by sociedad)
  const pendingInvoices = allInvoices.filter((i: any) => i.estado === 'Pendiente')
  const totalPendingUSD = pendingInvoices.reduce((sum: number, i: any) => sum + getInvoiceUSD(i), 0)

  // Overdue invoices with days overdue
  const today = new Date()
  const overdueInvoices = allInvoices
    .filter((i: any) => i.estado === 'Vencida')
    .map((i: any) => {
      const dueDate = new Date(i.fecha_vencimiento || i.fecha_pago_proyectada || i.created_at)
      const daysOverdue = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)))
      return { ...i, daysOverdue, dueDateStr: i.fecha_vencimiento || i.fecha_pago_proyectada }
    })
    .sort((a: any, b: any) => b.daysOverdue - a.daysOverdue)

  const totalOverdueUSD = overdueInvoices.reduce((sum: number, i: any) => sum + getInvoiceUSD(i), 0)

  // Cashflow KPIs (current week)
  const currentWeekStart = formatDateForDB(getWeekStart())
  const currentWeekEntries = cashflowData?.filter((e: any) => e.week_start_date === currentWeekStart) ?? []
  const totalEstimatedIn = currentWeekEntries.reduce((s: number, e: any) => s + (e.realtime_cash_in ?? e.estimated_cash_in ?? 0), 0)
  const totalEstimatedOut = currentWeekEntries.reduce((s: number, e: any) => s + (e.realtime_cash_out ?? e.estimated_cash_out ?? 0), 0)
  const netCashFlow = totalEstimatedIn - totalEstimatedOut

  // Build chart data (past + future)
  const chartData = weekRange.map((weekStart: Date) => {
    const weekStr = formatDateForDB(weekStart)
    const entries = cashflowData?.filter((e: any) => e.week_start_date === weekStr) ?? []
    const isCurrent = weekStr === currentWeekStart
    const isFuture = weekStart > getWeekStart()
    return {
      week: formatWeekLabel(weekStart).split('–')[0].trim(),
      cashIn: entries.reduce((s: number, e: any) => s + (e.realtime_cash_in ?? e.estimated_cash_in ?? 0), 0),
      cashOut: entries.reduce((s: number, e: any) => s + (e.realtime_cash_out ?? e.estimated_cash_out ?? 0), 0),
      net: entries.reduce((s: number, e: any) => s + (e.net_cash_flow ?? 0), 0),
      isCurrent,
      isFuture,
    }
  })

  // Pending invoices per sociedad with USD amounts
  const pendingBySociedad = SOCIEDADES.map((soc: Sociedad) => {
    const socInvoices = pendingInvoices.filter((i: any) => i.sociedad === soc)
    const totalUSD = socInvoices.reduce((sum: number, i: any) => sum + getInvoiceUSD(i), 0)
    return {
      sociedad: soc,
      count: socInvoices.length,
      totalUSD,
    }
  }).filter((s) => s.count > 0)

  // Sociedades requiring cash
  const requireCash = cashflowData
    ?.filter((e: any) => e.week_start_date === currentWeekStart && e.requires_additional_cash)
    .map((e: any) => e.sociedad) ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`Semana actual: ${formatWeekLabel(getWeekStart())}`}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Entradas Estimadas (semana)"
          value={formatCurrency(totalEstimatedIn, 'USD')}
          icon={<TrendingUp className="h-4 w-4" />}
          trend="neutral"
          trendLabel="semana actual"
        />
        <KpiCard
          title="Salidas Estimadas (semana)"
          value={formatCurrency(totalEstimatedOut, 'USD')}
          icon={<TrendingDown className="h-4 w-4" />}
          trend="neutral"
          trendLabel="semana actual"
        />
        <KpiCard
          title="Flujo Neto"
          value={formatCurrency(netCashFlow, 'USD')}
          icon={<DollarSign className="h-4 w-4" />}
          trend={netCashFlow >= 0 ? 'up' : 'down'}
          trendLabel={netCashFlow >= 0 ? 'positivo' : 'negativo'}
        />
        <KpiCard
          title="Facturas Vencidas"
          value={formatCurrency(totalOverdueUSD, 'USD')}
          icon={<AlertTriangle className="h-4 w-4" />}
          trend={totalOverdueUSD > 0 ? 'down' : 'neutral'}
          trendLabel={`${overdueInvoices.length} facturas`}
        />
      </div>

      {/* Alerts */}
      {requireCash.length > 0 && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              Sociedades que requieren capital adicional esta semana:
            </p>
            <div className="flex gap-2 mt-1 flex-wrap">
              {requireCash.map((s: string) => (
                <SociedadBadge key={s} sociedad={s as Sociedad} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main content: Chart + Rates */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <CashflowChart data={chartData} />
        </div>
        <div>
          <CurrencyRatesWidget rates={rates} />
        </div>
      </div>

      {/* Cards: Pending per sociedad + Overdue invoices */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Facturas Pendientes por Sociedad */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-600">
              Facturas Pendientes por Cobrar — por Sociedad
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 mb-3">
              {formatCurrency(totalPendingUSD, 'USD')}
            </div>
            <p className="text-xs text-slate-500 mb-3">{pendingInvoices.length} facturas pendientes total</p>
            <div className="space-y-2">
              {pendingBySociedad.length > 0 ? (
                pendingBySociedad.map((item) => (
                  <div key={item.sociedad} className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2">
                      <SociedadBadge sociedad={item.sociedad} />
                      <span className="text-xs text-slate-500">{item.count} facturas</span>
                    </div>
                    <span className="text-sm font-semibold text-slate-900">
                      {formatCurrency(item.totalUSD, 'USD')}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400">No hay facturas pendientes</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Facturas Vencidas con Detalle */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Facturas Vencidas — Detalle
            </CardTitle>
          </CardHeader>
          <CardContent>
            {overdueInvoices.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {overdueInvoices.map((inv: any) => (
                  <div key={inv.id} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {inv.razon_social_cliente}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <SociedadBadge sociedad={inv.sociedad as Sociedad} />
                        <Badge variant="destructive" className="text-xs px-1.5 py-0">
                          {inv.daysOverdue} dias
                        </Badge>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-red-700 ml-2 shrink-0">
                      {formatCurrency(getInvoiceUSD(inv), 'USD')}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No hay facturas vencidas</p>
            )}
            {overdueInvoices.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-200 flex justify-between">
                <span className="text-sm font-medium text-slate-600">Total vencidas</span>
                <span className="text-sm font-bold text-red-700">{formatCurrency(totalOverdueUSD, 'USD')}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
