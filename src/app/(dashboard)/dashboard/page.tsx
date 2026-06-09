// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server'
import { getLatestRates } from '@/actions/trm-rates.actions'
import { getLatestBalance } from '@/actions/daily-balances.actions'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { CurrencyRatesWidget } from '@/components/dashboard/currency-rates-widget'
import { CashflowChart } from '@/components/dashboard/cashflow-chart'
import { DailyBalanceWidget } from '@/components/dashboard/daily-balance-widget'
import { PageHeader } from '@/components/shared/page-header'
import { DashboardQuickPay } from '@/components/dashboard/dashboard-quick-pay'
import { DollarSign, TrendingUp, TrendingDown, AlertTriangle, Clock, Flame, Minus, Leaf } from 'lucide-react'
import { formatCurrency, convertToUSD } from '@/lib/currency'
import { getWeekStart, formatDateForDB, getWeekRangePastFuture, formatWeekLabel } from '@/lib/date'
import { SOCIEDADES, SOCIEDAD_CURRENCY_MAP, type Sociedad } from '@/lib/constants'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SociedadBadge } from '@/components/shared/sociedad-badge'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

/** Safely get USD amount from income invoice — always returns USD */
function getInvoiceUSD(invoice: any, rates: any): number {
  // Prefer pre-calculated USD value
  if (invoice.total_usd && invoice.total_usd > 0) return invoice.total_usd
  if (invoice.monto_usd && invoice.monto_usd > 0) return invoice.monto_usd
  // Fall back to converting local currency
  const localAmount = invoice.total_moneda_local ?? invoice.monto ?? 0
  if (localAmount <= 0) return 0
  const moneda = invoice.moneda
    ?? (invoice.sociedad ? SOCIEDAD_CURRENCY_MAP[invoice.sociedad as Sociedad] : null)
    ?? 'COP'
  if (moneda === 'USD') return localAmount
  return convertToUSD(localAmount, moneda, rates) ?? 0
}

type UrgencyLevel = 'Urgente' | 'Media' | 'Baja' | 'Sin definir'
const URGENCY_ORDER: UrgencyLevel[] = ['Urgente', 'Media', 'Baja', 'Sin definir']

const URGENCY_META: Record<UrgencyLevel, { color: string; bg: string; border: string; textColor: string }> = {
  'Urgente':    { color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-200',    textColor: 'text-red-700' },
  'Media':      { color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-200',  textColor: 'text-amber-700' },
  'Baja':       { color: 'text-green-600',  bg: 'bg-green-50',  border: 'border-green-200',  textColor: 'text-green-700' },
  'Sin definir':{ color: 'text-slate-500',  bg: 'bg-slate-50',  border: 'border-slate-200',  textColor: 'text-slate-600' },
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const rates = await getLatestRates()

  /**
   * Safely get USD amount from expense invoice — converts local currency using rates.
   */
  function getExpenseUSD(invoice: any): number {
    if (invoice.monto_usd && invoice.monto_usd > 0) return invoice.monto_usd
    const localAmount =
      invoice.monto_pago ?? invoice.monto_sin_impuestos ?? invoice.monto_presupuestado ?? 0
    if (localAmount <= 0) return 0
    const moneda = invoice.moneda
      ?? (invoice.sociedad ? SOCIEDAD_CURRENCY_MAP[invoice.sociedad as Sociedad] : null)
      ?? 'COP'
    if (moneda === 'USD') return localAmount
    return convertToUSD(localAmount, moneda, rates) ?? 0
  }

  // Fetch ALL income invoices
  const { data: incomeData } = await supabase.from('income_invoices').select('*')
  // Fetch ALL expense invoices
  const { data: expenseData } = await supabase.from('expense_invoices').select('*')
  // Fetch ALL active payroll
  const { data: payrollData } = await supabase.from('payroll').select('*').eq('active', true)

  const allIncomeInvoices = incomeData ?? []
  const allExpenseInvoices = expenseData ?? []
  const allPayroll = payrollData ?? []

  // ── Date references ──
  const today = new Date()
  const todayStr = formatDateForDB(today)
  const currentWeekStartDate = getWeekStart()
  const currentWeekStart = formatDateForDB(currentWeekStartDate)
  const currentWeekEndDate = new Date(currentWeekStartDate)
  currentWeekEndDate.setDate(currentWeekEndDate.getDate() + 6)
  const currentWeekEnd = formatDateForDB(currentWeekEndDate)

  /**
   * Calculate payroll cost in USD for a given week.
   * Quincenas: 15th and last day of each month.
   */
  function getPayrollForWeek(weekStartDate: Date, weekEndDate: Date): number {
    let payrollUSD = 0
    const wsYear = weekStartDate.getFullYear()
    const wsMonth = weekStartDate.getMonth()
    const weYear = weekEndDate.getFullYear()
    const weMonth = weekEndDate.getMonth()

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

        // Q1: 15th
        const q1 = new Date(year, month, 15)
        if (q1 >= weekStartDate && q1 <= weekEndDate) {
          payrollUSD += moneda === 'USD' ? quincena : (convertToUSD(quincena, moneda, rates) ?? 0)
        }
        // Q2: last day
        const lastDay = new Date(year, month + 1, 0).getDate()
        const q2 = new Date(year, month, lastDay)
        if (q2 >= weekStartDate && q2 <= weekEndDate) {
          payrollUSD += moneda === 'USD' ? quincena : (convertToUSD(quincena, moneda, rates) ?? 0)
        }
      }
    }
    return payrollUSD
  }

  // ── Build chart data ──
  // Past weeks  → ACTUAL payments (fecha_pago_o_cobro). Also compute projected for comparison.
  // Current     → PROJECTED unpaid + overdue roll-forward. ACTUAL paid so far this week.
  // Future      → PROJECTED unpaid due that week.
  // Running balance → cumulative net, carry-forward across all weeks.
  const weekRange = getWeekRangePastFuture(8, 12)
  // Use latest daily balance as starting point for running balance
  const latestBalance = await getLatestBalance()
  let runningBalance = latestBalance?.saldo_inicial_usd ? Number(latestBalance.saldo_inicial_usd) : 0

  const chartData = weekRange.map((weekStart: Date) => {
    const weekStr = formatDateForDB(weekStart)
    const weekEndDate = new Date(weekStart)
    weekEndDate.setDate(weekEndDate.getDate() + 6)
    const weekEndStr = formatDateForDB(weekEndDate)

    const isCurrent = weekStr === currentWeekStart
    const isFuture = weekStart > currentWeekStartDate
    const isPast = !isCurrent && !isFuture

    const weekPayroll = getPayrollForWeek(weekStart, weekEndDate)

    // ─── ACTUAL: invoices with real fecha_pago_o_cobro this week ───
    const actualCashIn = allIncomeInvoices
      .filter((i: any) => {
        const fp = i.fecha_pago_o_cobro
        return fp && fp >= weekStr && fp <= weekEndStr && i.estado === 'Pagada'
      })
      .reduce((sum: number, i: any) => sum + getInvoiceUSD(i, rates), 0)

    const actualExpenseOut = allExpenseInvoices
      .filter((i: any) => {
        const fp = i.fecha_pago_o_cobro
        return fp && fp >= weekStr && fp <= weekEndStr && i.estado === 'Pagada'
      })
      .reduce((sum: number, i: any) => sum + getExpenseUSD(i), 0)

    // Payroll is always paid on schedule — included in actual for past, projected for future
    const actualCashOut = actualExpenseOut + weekPayroll

    // ─── PROJECTED: based on due dates / expectativa_pago ───
    let projCashIn = 0
    let projExpenseOut = 0

    if (isPast) {
      // What was EXPECTED to be collected this week (by fecha_vencimiento)
      projCashIn = allIncomeInvoices
        .filter((i: any) => {
          const fv = i.fecha_vencimiento
          return fv && fv >= weekStr && fv <= weekEndStr
        })
        .reduce((sum: number, i: any) => sum + getInvoiceUSD(i, rates), 0)

      // What was EXPECTED to be paid this week (by expectativa_pago / fecha_emision)
      projExpenseOut = allExpenseInvoices
        .filter((i: any) => {
          if (i.estado === 'Anulada') return false
          const fp = i.expectativa_pago ?? i.fecha_emision
          return fp && fp >= weekStr && fp <= weekEndStr
        })
        .reduce((sum: number, i: any) => sum + getExpenseUSD(i), 0)

    } else if (isCurrent) {
      // UNPAID invoices due this week + overdue rolled forward from past weeks
      projCashIn = allIncomeInvoices
        .filter((i: any) => {
          if (i.estado === 'Pagada' || i.estado === 'Anulada') return false
          const fv = i.fecha_vencimiento
          if (!fv) return false
          return (fv >= weekStr && fv <= weekEndStr) || fv < weekStr
        })
        .reduce((sum: number, i: any) => sum + getInvoiceUSD(i, rates), 0)

      projExpenseOut = allExpenseInvoices
        .filter((i: any) => {
          if (i.estado === 'Pagada' || i.estado === 'Anulada') return false
          const fp = i.expectativa_pago ?? i.fecha_emision
          if (!fp) return false
          return (fp >= weekStr && fp <= weekEndStr) || fp < weekStr
        })
        .reduce((sum: number, i: any) => sum + getExpenseUSD(i), 0)

    } else {
      // Future: unpaid with due date in this future week
      projCashIn = allIncomeInvoices
        .filter((i: any) => {
          if (i.estado === 'Pagada' || i.estado === 'Anulada') return false
          const fv = i.fecha_vencimiento
          return fv && fv >= weekStr && fv <= weekEndStr
        })
        .reduce((sum: number, i: any) => sum + getInvoiceUSD(i, rates), 0)

      projExpenseOut = allExpenseInvoices
        .filter((i: any) => {
          if (i.estado === 'Pagada' || i.estado === 'Anulada') return false
          const fp = i.expectativa_pago ?? i.fecha_emision
          return fp && fp >= weekStr && fp <= weekEndStr
        })
        .reduce((sum: number, i: any) => sum + getExpenseUSD(i), 0)
    }

    const projCashOut = projExpenseOut + weekPayroll

    // Bars: actual for past weeks, projected for current/future
    const cashIn  = isPast ? actualCashIn  : projCashIn
    const cashOut = isPast ? actualCashOut : projCashOut

    // Running balance: accumulates actual for past, projected for current/future
    runningBalance += cashIn - cashOut

    return {
      week: formatWeekLabel(weekStart).split('–')[0].trim(),
      cashIn,
      cashOut,
      // Extra context for tooltip comparison (null means "not applicable")
      projCashIn: isPast ? projCashIn : null,
      projCashOut: isPast ? projCashOut : null,
      actualCashIn: isCurrent ? actualCashIn : null,
      actualCashOut: isCurrent ? actualCashOut : null,
      runningBalance,
      isCurrent,
      isFuture,
      isPast,
    }
  })

  // ── KPIs: current week ──
  const currentWeekData = chartData.find((d) => d.isCurrent)
  const totalEstimatedIn  = currentWeekData?.cashIn  ?? 0
  const totalEstimatedOut = currentWeekData?.cashOut ?? 0
  const netCashFlow = totalEstimatedIn - totalEstimatedOut

  // ── Pending income invoices (not paid/cancelled) ──
  const pendingInvoices = allIncomeInvoices.filter(
    (i: any) => i.estado !== 'Pagada' && i.estado !== 'Anulada'
  )
  const totalPendingUSD = pendingInvoices.reduce((sum: number, i: any) => sum + getInvoiceUSD(i, rates), 0)

  // ── Overdue income invoices ──
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

  const totalOverdueUSD = overdueInvoices.reduce((sum: number, i: any) => sum + getInvoiceUSD(i, rates), 0)

  // ── Pending per sociedad (income) ──
  const pendingBySociedad = SOCIEDADES.map((soc: Sociedad) => {
    const socInvoices = pendingInvoices.filter((i: any) => i.sociedad === soc)
    const totalUSD = socInvoices.reduce((sum: number, i: any) => sum + getInvoiceUSD(i, rates), 0)
    return { sociedad: soc, count: socInvoices.length, totalUSD }
  }).filter((s) => s.count > 0)

  // ── Pending expenses (not paid/cancelled) ──
  const pendingExpenses = allExpenseInvoices.filter(
    (i: any) => i.estado !== 'Pagada' && i.estado !== 'Anulada'
  )
  const totalPendingExpensesUSD = pendingExpenses.reduce(
    (sum: number, i: any) => sum + getExpenseUSD(i),
    0
  )
  const pendingExpensesBySociedad = SOCIEDADES.map((soc: Sociedad) => {
    const socExpenses = pendingExpenses.filter((i: any) => i.sociedad === soc)
    const totalUSD = socExpenses.reduce((sum: number, i: any) => sum + getExpenseUSD(i), 0)
    return { sociedad: soc, count: socExpenses.length, totalUSD }
  }).filter((s) => s.count > 0)

  // ── Desembolsos por urgencia (semana actual + vencidos) ──
  const currentWeekDisbursements = pendingExpenses.filter((i: any) => {
    const fp = i.expectativa_pago ?? i.fecha_emision
    if (!fp) return false
    return (fp >= currentWeekStart && fp <= currentWeekEnd) || fp < currentWeekStart
  })

  function getUrgencyLevel(i: any): UrgencyLevel {
    if (i.logica_prioridad === 'Urgente' || i.prioridad_pago === 1) return 'Urgente'
    if (i.logica_prioridad === 'Media'   || i.prioridad_pago === 2) return 'Media'
    if (i.logica_prioridad === 'Baja'    || i.prioridad_pago === 3) return 'Baja'
    return 'Sin definir'
  }

  const disbursementsByUrgency: Record<UrgencyLevel, { items: any[]; totalUSD: number }> = {
    'Urgente':    { items: [], totalUSD: 0 },
    'Media':      { items: [], totalUSD: 0 },
    'Baja':       { items: [], totalUSD: 0 },
    'Sin definir':{ items: [], totalUSD: 0 },
  }
  for (const exp of currentWeekDisbursements) {
    const level = getUrgencyLevel(exp)
    disbursementsByUrgency[level].items.push(exp)
    disbursementsByUrgency[level].totalUSD += getExpenseUSD(exp)
  }
  const totalDisbursementsUSD = currentWeekDisbursements.reduce(
    (sum: number, i: any) => sum + getExpenseUSD(i), 0
  )

  const currentWeekDeficit = netCashFlow < 0

  return (
    <div className="space-y-6">
      {/* Header + quick-pay buttons */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeader
          title="Dashboard"
          description={`Semana actual: ${formatWeekLabel(getWeekStart())}`}
        />
        <DashboardQuickPay
          unpaidIncome={pendingInvoices}
          unpaidExpenses={pendingExpenses}
        />
      </div>

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
              Déficit proyectado esta semana: {formatCurrency(Math.abs(netCashFlow), 'USD')}
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
              Proyectadas en la semana actual hasta que se registre el cobro
            </p>
          </div>
        </div>
      )}

      {/* Chart + Rates */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <CashflowChart data={chartData} />
        </div>
        <div className="space-y-4">
          <DailyBalanceWidget latestBalance={latestBalance} />
          <CurrencyRatesWidget rates={rates} />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">

        {/* Ingresos Pendientes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-600">
              Ingresos Pendientes por Cobrar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900 mb-3">
              {formatCurrency(totalPendingUSD, 'USD')}
            </div>
            <p className="text-xs text-slate-500 mb-3">{pendingInvoices.length} facturas pendientes</p>
            <div className="space-y-2">
              {pendingBySociedad.length > 0 ? (
                pendingBySociedad.map((item) => (
                  <div key={item.sociedad} className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2">
                      <SociedadBadge sociedad={item.sociedad} />
                      <span className="text-xs text-slate-500">{item.count}</span>
                    </div>
                    <span className="text-sm font-semibold text-slate-900">
                      {formatCurrency(item.totalUSD, 'USD')}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400">Sin facturas pendientes</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Gastos Pendientes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-600">
              Gastos Pendientes por Pagar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700 mb-3">
              {formatCurrency(totalPendingExpensesUSD, 'USD')}
            </div>
            <p className="text-xs text-slate-500 mb-3">{pendingExpenses.length} gastos pendientes</p>
            <div className="space-y-2">
              {pendingExpensesBySociedad.length > 0 ? (
                pendingExpensesBySociedad.map((item) => (
                  <div key={item.sociedad} className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2">
                      <SociedadBadge sociedad={item.sociedad} />
                      <span className="text-xs text-slate-500">{item.count}</span>
                    </div>
                    <span className="text-sm font-semibold text-red-700">
                      {formatCurrency(item.totalUSD, 'USD')}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400">Sin gastos pendientes</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Desembolsos por Urgencia ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
              <Flame className="h-4 w-4 text-red-500" />
              Desembolsos por Urgencia
            </CardTitle>
          </CardHeader>
          <CardContent>
            {currentWeekDisbursements.length === 0 ? (
              <p className="text-sm text-slate-400">Sin desembolsos esta semana</p>
            ) : (
              <>
                <div className="space-y-2 mb-3">
                  {URGENCY_ORDER.map((level) => {
                    const group = disbursementsByUrgency[level]
                    if (group.items.length === 0) return null
                    const meta = URGENCY_META[level]
                    return (
                      <div
                        key={level}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-md ${meta.bg} border ${meta.border}`}
                      >
                        <div className="flex items-center gap-2">
                          {level === 'Urgente'    && <Flame  className={`h-3.5 w-3.5 ${meta.color}`} />}
                          {level === 'Media'      && <Minus  className={`h-3.5 w-3.5 ${meta.color}`} />}
                          {level === 'Baja'       && <Leaf   className={`h-3.5 w-3.5 ${meta.color}`} />}
                          {level === 'Sin definir'&& <Minus  className={`h-3.5 w-3.5 ${meta.color}`} />}
                          <span className={`text-xs font-medium ${meta.textColor}`}>{level}</span>
                          <span className="text-xs text-slate-400">{group.items.length}</span>
                        </div>
                        <span className={`text-sm font-bold ${meta.textColor}`}>
                          {formatCurrency(group.totalUSD, 'USD')}
                        </span>
                      </div>
                    )
                  })}
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between">
                  <span className="text-xs text-slate-500">Total semana</span>
                  <span className="text-sm font-bold text-red-700">
                    {formatCurrency(totalDisbursementsUSD, 'USD')}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Facturas Vencidas Detalle */}
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
                          {inv.daysOverdue} días
                        </Badge>
                        <span className="text-xs text-slate-400">
                          venc: {inv.fecha_vencimiento}
                        </span>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-red-700 ml-2 shrink-0">
                      {formatCurrency(getInvoiceUSD(inv, rates), 'USD')}
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
