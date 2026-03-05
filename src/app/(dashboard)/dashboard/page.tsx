// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server'
import { getLatestRates } from '@/actions/trm-rates.actions'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { CurrencyRatesWidget } from '@/components/dashboard/currency-rates-widget'
import { CashflowChart } from '@/components/dashboard/cashflow-chart'
import { PageHeader } from '@/components/shared/page-header'
import { DollarSign, TrendingUp, TrendingDown, AlertTriangle, Clock } from 'lucide-react'
import { formatCurrency, convertToUSD } from '@/lib/currency'
import { getWeekStart, formatDateForDB, getWeekRangePastFuture, formatWeekLabel } from '@/lib/date'
import { SOCIEDADES, type Sociedad } from '@/lib/constants'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SociedadBadge } from '@/components/shared/sociedad-badge'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

/** Safely get USD amount from income invoice (handles multiple column naming schemes) */
function getInvoiceUSD(invoice: any): number {
  return invoice.total_usd ?? invoice.monto_usd ?? invoice.total_moneda_local ?? invoice.monto ?? 0
}

/** Safely get USD amount from expense invoice */
function getExpenseUSD(invoice: any): number {
  return invoice.monto_usd ?? invoice.monto_pago ?? invoice.monto_sin_impuestos ?? invoice.monto_presupuestado ?? 0
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const rates = await getLatestRates()

  // Fetch ALL income invoices
  const { data: incomeData, error: incomeError } = await supabase
    .from('income_invoices')
    .select('*')

  if (incomeError) {
    console.error('Error fetching income invoices:', incomeError)
  }

  // Fetch ALL expense invoices
  const { data: expenseData, error: expenseError } = await supabase
    .from('expense_invoices')
    .select('*')

  if (expenseError) {
    console.error('Error fetching expense invoices:', expenseError)
  }

  const allIncomeInvoices = incomeData ?? []
  const allExpenseInvoices = expenseData ?? []

  // Fetch ALL active payroll entries for payroll projection
  const { data: payrollData, error: payrollError } = await supabase
    .from('payroll')
    .select('*')
    .eq('active', true)

  if (payrollError) {
    console.error('Error fetching payroll:', payrollError)
  }

  const allPayroll = payrollData ?? []

  // ── Date references ──
  const today = new Date()
  const todayStr = formatDateForDB(today)
  const currentWeekStartDate = getWeekStart()
  const currentWeekStart = formatDateForDB(currentWeekStartDate)

  /**
   * Calculate payroll cost in USD for a given week.
   * Quincenas: 15th and last day of each month.
   * Each quincena = ultimo_pago / 2 (or monthly_amounts[month] / 2 if available).
   */
  function getPayrollForWeek(weekStartDate: Date, weekEndDate: Date): number {
    let payrollUSD = 0
    // Determine which months overlap with this week
    const wsYear = weekStartDate.getFullYear()
    const wsMonth = weekStartDate.getMonth()
    const weYear = weekEndDate.getFullYear()
    const weMonth = weekEndDate.getMonth()

    // Check months that could have quincenas falling in this week range
    const monthsToCheck: [number, number][] = [[wsYear, wsMonth]]
    if (weYear !== wsYear || weMonth !== wsMonth) {
      monthsToCheck.push([weYear, weMonth])
    }

    for (const employee of allPayroll) {
      const amounts = (employee.monthly_amounts ?? {}) as Record<string, number>
      const ultimoPago = (employee as any).ultimo_pago ?? 0
      const moneda = employee.moneda_pago

      for (const [year, month] of monthsToCheck) {
        const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`
        const monthlyAmount = amounts[monthKey] ?? ultimoPago
        if (monthlyAmount <= 0) continue

        const quincena = monthlyAmount / 2

        // Quincena 1: 15th of the month
        const q1 = new Date(year, month, 15)
        if (q1 >= weekStartDate && q1 <= weekEndDate) {
          const usd = moneda === 'USD' ? quincena : (convertToUSD(quincena, moneda, rates) ?? quincena)
          payrollUSD += usd
        }

        // Quincena 2: last day of the month
        const lastDay = new Date(year, month + 1, 0).getDate()
        const q2 = new Date(year, month, lastDay)
        if (q2 >= weekStartDate && q2 <= weekEndDate) {
          const usd = moneda === 'USD' ? quincena : (convertToUSD(quincena, moneda, rates) ?? quincena)
          payrollUSD += usd
        }
      }
    }
    return payrollUSD
  }

  // ── Build chart data DIRECTLY from invoices + payroll ──
  const weekRange = getWeekRangePastFuture(8, 12)

  const chartData = weekRange.map((weekStart: Date) => {
    const weekStr = formatDateForDB(weekStart)
    // Each week goes Monday to Sunday (6 days after start)
    const weekEndDate = new Date(weekStart)
    weekEndDate.setDate(weekEndDate.getDate() + 6)
    const weekEndStr = formatDateForDB(weekEndDate)

    const isCurrent = weekStr === currentWeekStart
    const isFuture = weekStart > currentWeekStartDate

    // Cash In: income invoices where fecha_vencimiento falls in this week
    const weekCashIn = allIncomeInvoices
      .filter((i: any) => {
        const fv = i.fecha_vencimiento
        return fv && fv >= weekStr && fv <= weekEndStr
      })
      .reduce((sum: number, i: any) => sum + getInvoiceUSD(i), 0)

    // Cash Out: expense invoices where fecha_pago_o_cobro falls in this week
    const weekExpenses = allExpenseInvoices
      .filter((i: any) => {
        const fp = i.fecha_pago_o_cobro
        return fp && fp >= weekStr && fp <= weekEndStr
      })
      .reduce((sum: number, i: any) => sum + getExpenseUSD(i), 0)

    // Payroll: quincenas (15th and last day) that fall in this week, converted to USD
    const weekPayroll = getPayrollForWeek(weekStart, weekEndDate)

    const weekCashOut = weekExpenses + weekPayroll

    return {
      week: formatWeekLabel(weekStart).split('–')[0].trim(),
      cashIn: weekCashIn,
      cashOut: weekCashOut,
      net: weekCashIn - weekCashOut,
      isCurrent,
      isFuture,
    }
  })

  // ── KPI: Current week (from the same chart computation) ──
  const currentWeekData = chartData.find((d) => d.isCurrent)
  const totalEstimatedIn = currentWeekData?.cashIn ?? 0
  const totalEstimatedOut = currentWeekData?.cashOut ?? 0
  const netCashFlow = totalEstimatedIn - totalEstimatedOut

  // ── Pending invoices: not paid, not cancelled (includes both Pendiente and Vencida estados) ──
  const pendingInvoices = allIncomeInvoices.filter(
    (i: any) => i.estado !== 'Pagada' && i.estado !== 'Anulada'
  )
  const totalPendingUSD = pendingInvoices.reduce((sum: number, i: any) => sum + getInvoiceUSD(i), 0)

  // ── Overdue: fecha_vencimiento < today AND not paid/cancelled ──
  // "vencida = cuando la fecha_vencimiento ya pasó la fecha actual"
  const overdueInvoices = allIncomeInvoices
    .filter((i: any) => {
      const fv = i.fecha_vencimiento
      if (!fv) return false
      return fv < todayStr && i.estado !== 'Pagada' && i.estado !== 'Anulada'
    })
    .map((i: any) => {
      const dueDate = new Date(i.fecha_vencimiento + 'T12:00:00')
      const daysOverdue = Math.max(
        0,
        Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
      )
      return { ...i, daysOverdue }
    })
    .sort((a: any, b: any) => b.daysOverdue - a.daysOverdue)

  const totalOverdueUSD = overdueInvoices.reduce((sum: number, i: any) => sum + getInvoiceUSD(i), 0)

  // ── Pending per sociedad ──
  const pendingBySociedad = SOCIEDADES.map((soc: Sociedad) => {
    const socInvoices = pendingInvoices.filter((i: any) => i.sociedad === soc)
    const totalUSD = socInvoices.reduce((sum: number, i: any) => sum + getInvoiceUSD(i), 0)
    return { sociedad: soc, count: socInvoices.length, totalUSD }
  }).filter((s) => s.count > 0)

  // ── Deficit detection for current week ──
  const currentWeekDeficit = netCashFlow < 0

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
          trend={totalEstimatedIn > 0 ? 'up' : 'neutral'}
          trendLabel="semana actual"
        />
        <KpiCard
          title="Salidas Estimadas (semana)"
          value={formatCurrency(totalEstimatedOut, 'USD')}
          icon={<TrendingDown className="h-4 w-4" />}
          trend={totalEstimatedOut > 0 ? 'down' : 'neutral'}
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

      {/* Deficit Alert */}
      {currentWeekDeficit && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-800">
              Deficit proyectado esta semana: {formatCurrency(Math.abs(netCashFlow), 'USD')}
            </p>
            <p className="text-xs text-red-600 mt-1">
              Las salidas superan las entradas estimadas para esta semana
            </p>
          </div>
        </div>
      )}

      {/* Overdue Alert */}
      {overdueInvoices.length > 0 && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              {overdueInvoices.length} factura(s) vencida(s) por {formatCurrency(totalOverdueUSD, 'USD')}
            </p>
            <p className="text-xs text-amber-600 mt-1">
              Facturas con fecha de vencimiento pasada que aun no se han cobrado
            </p>
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
                        <span className="text-xs text-slate-400">
                          venc: {inv.fecha_vencimiento}
                        </span>
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
