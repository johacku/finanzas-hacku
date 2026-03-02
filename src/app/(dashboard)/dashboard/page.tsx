// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { getLatestRates } from '@/actions/trm-rates.actions'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { CurrencyRatesWidget } from '@/components/dashboard/currency-rates-widget'
import { CashflowChart } from '@/components/dashboard/cashflow-chart'
import { PageHeader } from '@/components/shared/page-header'
import { DollarSign, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { getWeekStart, formatDateForDB, getWeekRange, formatWeekLabel } from '@/lib/date'
import { type Sociedad } from '@/lib/constants'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SociedadBadge } from '@/components/shared/sociedad-badge'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const rates = await getLatestRates()

  // Fetch income summary
  const { data: incomeData } = await supabase
    .from('income_invoices')
    .select('estado, total_usd, sociedad')

  // Fetch weekly cashflow for chart
  const weekRange = getWeekRange(12)
  const startDate = formatDateForDB(weekRange[0])
  const { data: cashflowData } = await supabase
    .from('weekly_cashflow_entries')
    .select('*')
    .gte('week_start_date', startDate)
    .order('week_start_date', { ascending: true })

  // Pending invoices
  const pendingInvoices = incomeData?.filter((i) => i.estado === 'Pendiente') ?? []
  const overdueInvoices = incomeData?.filter((i) => i.estado === 'Vencida') ?? []
  const totalPendingUSD = pendingInvoices.reduce((sum, i) => sum + (i.total_usd ?? 0), 0)
  const totalOverdueUSD = overdueInvoices.reduce((sum, i) => sum + (i.total_usd ?? 0), 0)

  // Cashflow KPIs (current week)
  const currentWeekStart = formatDateForDB(getWeekStart())
  const currentWeekEntries = cashflowData?.filter((e) => e.week_start_date === currentWeekStart) ?? []
  const totalEstimatedIn = currentWeekEntries.reduce((s, e) => s + e.estimated_cash_in, 0)
  const totalEstimatedOut = currentWeekEntries.reduce((s, e) => s + e.estimated_cash_out, 0)
  const netCashFlow = totalEstimatedIn - totalEstimatedOut

  // Build chart data
  const chartData = weekRange.map((weekStart) => {
    const weekStr = formatDateForDB(weekStart)
    const entries = cashflowData?.filter((e) => e.week_start_date === weekStr) ?? []
    return {
      week: formatWeekLabel(weekStart).split('–')[0].trim(),
      cashIn: entries.reduce((s, e) => s + (e.realtime_cash_in ?? e.estimated_cash_in), 0),
      cashOut: entries.reduce((s, e) => s + (e.realtime_cash_out ?? e.estimated_cash_out), 0),
      net: entries.reduce((s, e) => s + e.net_cash_flow, 0),
    }
  })

  // Sociedades requiring cash
  const requireCash = cashflowData
    ?.filter((e) => e.week_start_date === currentWeekStart && e.requires_additional_cash)
    .map((e) => e.sociedad) ?? []

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
              {requireCash.map((s) => (
                <SociedadBadge key={s} sociedad={s as Sociedad} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <CashflowChart data={chartData} />
        </div>
        <div>
          <CurrencyRatesWidget rates={rates} />
        </div>
      </div>

      {/* Pending invoices summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-600">
              Facturas Pendientes por Cobrar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {formatCurrency(totalPendingUSD, 'USD')}
            </div>
            <p className="text-xs text-slate-500 mt-1">{pendingInvoices.length} facturas pendientes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-600">
              Total Facturas por Sociedad
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {(['hackÜ SAS', 'hackÜ LLC', 'hackÜ MEX', 'hackÜ PER', 'hackÜ BRA'] as Sociedad[]).map(
                (soc) => {
                  const count = incomeData?.filter((i) => i.sociedad === soc).length ?? 0
                  return (
                    <div key={soc} className="flex items-center justify-between">
                      <SociedadBadge sociedad={soc} />
                      <span className="text-sm font-medium">{count}</span>
                    </div>
                  )
                }
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
