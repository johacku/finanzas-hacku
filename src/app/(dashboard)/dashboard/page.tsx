// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server'
import { getLatestRates } from '@/actions/trm-rates.actions'
import { getLatestTotalBalanceUSD } from '@/actions/daily-balances.actions'
import { KpiCard } from '@/components/dashboard/kpi-card'
import { CurrencyRatesWidget } from '@/components/dashboard/currency-rates-widget'
import { CashflowChart } from '@/components/dashboard/cashflow-chart'
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

  /**
   * For factoring invoices, determine the effective dates for cashflow:
   * - If tiene_factoraje && fecha_cobro_factoring → treat as actual income (like fecha_pago_o_cobro)
   * - If tiene_factoraje && fecha_factoraje (no cobro yet) → use fecha_factoraje as projected date
   * - Otherwise → use fecha_vencimiento as projected date
   */
  function getIncomeProjectedDate(i: any): string | null {
    if (i.tiene_factoraje) {
      // If factoring company already paid, this is "actual" — handled via fecha_cobro_factoring
      if (i.fecha_cobro_factoring) return null // skip from projected, handled in actuals
      // Tentative factoring date overrides vencimiento for projections
      if (i.fecha_factoraje) return i.fecha_factoraje
    }
    return i.fecha_vencimiento
  }

  /** Get actual payment date for income invoice (supports factoring cobro) */
  function getIncomeActualDate(i: any): string | null {
    // If factoring and the factoring company paid, that's actual income
    if (i.tiene_factoraje && i.fecha_cobro_factoring) return i.fecha_cobro_factoring
    // Regular payment
    return i.fecha_pago_o_cobro
  }

  // ── Date references ──
  const today = new Date()
  const todayStr = formatDateForDB(today)
  const currentWeekStartDate = getWeekStart()
  const currentWeekStart = formatDateForDB(currentWeekStartDate)
  const currentWeekEndDate = new Date(currentWeekStartDate)
  currentWeekEndDate.setDate(currentWeekEndDate.getDate() + 6)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const currentWeekEnd = formatDateForDB(currentWeekEndDate)

  /**
   * Calculate payroll cost in USD for a given week.
   * Quincenas: 15th and last day of each month.
   */
  // Known holiday dates (YYYY-MM-DD) where payroll shifts to previous Friday
  const HOLIDAYS = ['2026-06-15'] // Lunes festivo junio 2026

  function adjustPayrollDate(date: Date): Date {
    const day = date.getDay()
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

    // Holiday Monday → previous Friday
    if (HOLIDAYS.includes(dateStr)) {
      const adjusted = new Date(date)
      adjusted.setDate(adjusted.getDate() - 3) // Mon → Fri
      return adjusted
    }
    if (day === 6) { // Saturday → Friday
      const adjusted = new Date(date)
      adjusted.setDate(adjusted.getDate() - 1)
      return adjusted
    }
    if (day === 0) { // Sunday → Friday
      const adjusted = new Date(date)
      adjusted.setDate(adjusted.getDate() - 2)
      return adjusted
    }
    return date
  }

  function getPayrollForWeek(weekStartDate: Date, weekEndDate: Date): number {
    let payrollUSD = 0
    const wsYear = weekStartDate.getFullYear()
    const wsMonth = weekStartDate.getMonth()
    const weYear = weekEndDate.getFullYear()
    const weMonth = weekEndDate.getMonth()

    // Check current month + next month (to catch end-of-month payroll that shifts)
    const monthsToCheck: [number, number][] = [[wsYear, wsMonth]]
    if (weYear !== wsYear || weMonth !== wsMonth) {
      monthsToCheck.push([weYear, weMonth])
    }
    // Also check next month's 15th in case it shifts back into this week
    const nextMonth = weMonth === 11 ? 0 : weMonth + 1
    const nextYear = weMonth === 11 ? weYear + 1 : weYear
    if (!monthsToCheck.some(([y, m]) => y === nextYear && m === nextMonth)) {
      monthsToCheck.push([nextYear, nextMonth])
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

        // Q1: 15th (adjusted for weekends)
        const q1 = adjustPayrollDate(new Date(year, month, 15))
        if (q1 >= weekStartDate && q1 <= weekEndDate) {
          payrollUSD += moneda === 'USD' ? quincena : (convertToUSD(quincena, moneda, rates) ?? 0)
        }
        // Q2: last day of month (adjusted for weekends)
        const lastDay = new Date(year, month + 1, 0).getDate()
        const q2 = adjustPayrollDate(new Date(year, month, lastDay))
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
  const latestBalanceInfo = await getLatestTotalBalanceUSD()
  const bankBalance = latestBalanceInfo.total // e.g. $20,380
  let runningBalance = bankBalance // START from bank balance
  let runningActive = false

  const chartData = weekRange.map((weekStart: Date) => {
    const weekStr = formatDateForDB(weekStart)
    const weekEndDate = new Date(weekStart)
    weekEndDate.setDate(weekEndDate.getDate() + 6)
    const weekEndStr = formatDateForDB(weekEndDate)

    const isCurrent = weekStr === currentWeekStart
    const isFuture = weekStart > currentWeekStartDate
    const isPast = !isCurrent && !isFuture

    const weekPayroll = getPayrollForWeek(weekStart, weekEndDate)

    // ─── ACTUAL: invoices with real payment date this week ───
    const actualCashIn = allIncomeInvoices
      .filter((i: any) => {
        const fp = getIncomeActualDate(i)
        return fp && fp >= weekStr && fp <= weekEndStr && (i.estado === 'Pagada' || (i.tiene_factoraje && i.fecha_cobro_factoring))
      })
      .reduce((sum: number, i: any) => sum + getInvoiceUSD(i, rates), 0)

    const actualExpenseOut = allExpenseInvoices
      .filter((i: any) => {
        const fp = i.fecha_pago_o_cobro
        return fp && fp >= weekStr && fp <= weekEndStr && i.estado === 'Pagada'
      })
      .reduce((sum: number, i: any) => sum + getExpenseUSD(i), 0)

    const actualCashOut = actualExpenseOut + (isPast ? weekPayroll : 0)

    // ─── PROJECTED: based on due dates / expectativa_pago ───
    let projCashIn = 0
    let projExpenseOut = 0

    if (isPast) {
      projCashIn = allIncomeInvoices
        .filter((i: any) => {
          const fv = getIncomeProjectedDate(i) ?? i.fecha_vencimiento
          return fv && fv >= weekStr && fv <= weekEndStr
        })
        .reduce((sum: number, i: any) => sum + getInvoiceUSD(i, rates), 0)

      projExpenseOut = allExpenseInvoices
        .filter((i: any) => {
          if (i.estado === 'Anulada') return false
          const fp = i.expectativa_pago ?? i.fecha_emision
          return fp && fp >= weekStr && fp <= weekEndStr
        })
        .reduce((sum: number, i: any) => sum + getExpenseUSD(i), 0)

    } else if (isCurrent) {
      projCashIn = allIncomeInvoices
        .filter((i: any) => {
          if (i.estado === 'Pagada' || i.estado === 'Anulada') return false
          // Skip invoices already collected via factoring
          if (i.tiene_factoraje && i.fecha_cobro_factoring) return false
          const fv = getIncomeProjectedDate(i)
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
      projCashIn = allIncomeInvoices
        .filter((i: any) => {
          if (i.estado === 'Pagada' || i.estado === 'Anulada') return false
          // Skip invoices already collected via factoring
          if (i.tiene_factoraje && i.fecha_cobro_factoring) return false
          const fv = getIncomeProjectedDate(i)
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

    // Running balance = bank balance + accumulated (cobros - pagos) from current week onward
    if (isCurrent) {
      runningActive = true
      // Current week: bank balance + this week's net
      runningBalance = bankBalance + projCashIn - projCashOut
    } else if (isFuture && runningActive) {
      // Future: keep accumulating
      runningBalance += cashIn - cashOut
    }

    return {
      week: formatWeekLabel(weekStart).split('–')[0].trim(),
      cashIn,
      cashOut,
      projCashIn: isPast ? projCashIn : null,
      projCashOut: isPast ? projCashOut : null,
      actualCashIn: isCurrent ? actualCashIn : null,
      actualCashOut: isCurrent ? actualCashOut : null,
      // Show balance: past=null, current & future = calculated
      runningBalance: (isCurrent || isFuture) ? runningBalance : null,
      isCurrent,
      isFuture,
      isPast,
    }
  })

  // ── KPIs: current week ──
  const currentWeekData = chartData.find((d) => d.isCurrent)
  const totalEstimatedIn  = currentWeekData?.cashIn  ?? 0
  const totalEstimatedOut = currentWeekData?.cashOut ?? 0
  // Flujo neto = saldo banco + cobros proyectados - pagos proyectados
  const netCashFlow = bankBalance + totalEstimatedIn - totalEstimatedOut

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

  // ── Desembolsos por semana (current + next 3 weeks) ──
  function getUrgencyLevel(i: any): UrgencyLevel {
    // Check logica_prioridad enum first (most explicit)
    if (i.logica_prioridad === 'Urgente') return 'Urgente'
    if (i.logica_prioridad === 'Media') return 'Media'
    if (i.logica_prioridad === 'Baja') return 'Baja'
    // Check prioridad_pago (integer 1-3, may come as string from DB)
    const pp = Number(i.prioridad_pago)
    if (pp === 1) return 'Urgente'
    if (pp === 2) return 'Media'
    if (pp === 3) return 'Baja'
    // Check prioridad_id linked name (from prioridades_pago master list)
    const pNombre = i.prioridad_nombre ?? i.prioridades_pago?.nombre
    if (pNombre) {
      const n = pNombre.toLowerCase()
      if (n === 'crítico' || n === 'critico' || n === 'alto') return 'Urgente'
      if (n === 'normal') return 'Media'
      if (n === 'bajo' || n === 'diferido') return 'Baja'
    }
    return 'Sin definir'
  }

  // Build 4 weeks of disbursements
  const disbursementWeeks = [0, 1, 2, 3].map((offset) => {
    const ws = new Date(currentWeekStartDate)
    ws.setDate(ws.getDate() + offset * 7)
    const we = new Date(ws)
    we.setDate(we.getDate() + 6)
    const wsStr = formatDateForDB(ws)
    const weStr = formatDateForDB(we)

    const items = pendingExpenses.filter((i: any) => {
      const fp = i.expectativa_pago ?? i.fecha_emision
      if (!fp) return false
      if (offset === 0) {
        // Current week: include overdue + this week
        return (fp >= wsStr && fp <= weStr) || fp < wsStr
      }
      return fp >= wsStr && fp <= weStr
    })

    const totalUSD = items.reduce((sum: number, i: any) => sum + getExpenseUSD(i), 0)

    // Group by urgency
    const byUrgency: Record<UrgencyLevel, any[]> = { 'Urgente': [], 'Media': [], 'Baja': [], 'Sin definir': [] }
    for (const item of items) {
      byUrgency[getUrgencyLevel(item)].push(item)
    }

    return {
      label: offset === 0 ? 'Esta semana' : offset === 1 ? 'Próxima semana' : `Semana +${offset}`,
      weekLabel: `${formatWeekLabel(ws)}`,
      items,
      totalUSD,
      byUrgency,
    }
  })

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const totalDisbursementsUSD = disbursementWeeks[0].totalUSD

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

      {/* Saldo Consolidado */}
      <Card className="bg-gradient-to-r from-slate-900 to-slate-800 text-white">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">Saldo Bancario Consolidado {latestBalanceInfo.fecha ? `(${latestBalanceInfo.fecha})` : ''}</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(latestBalanceInfo.total, 'USD')}</p>
            </div>
            <div className="text-right space-y-1">
              {(latestBalanceInfo.accounts || []).map((acc: any, i: number) => (
                <p key={i} className="text-[11px] text-slate-400">
                  {acc.banco} · {acc.moneda !== 'USD' ? `${Number(acc.saldo_inicial).toLocaleString('es-CO')} ${acc.moneda} · ` : ''}${formatCurrency(acc.saldo_inicial_usd, 'USD')}
                </p>
              ))}
              {(!latestBalanceInfo.accounts || latestBalanceInfo.accounts.length === 0) && (
                <p className="text-[11px] text-slate-500">Sin saldos registrados. Ve a Saldos Bancarios.</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

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

      {/* Chart (full width) */}
      <CashflowChart data={chartData} />

      {/* TRM Rates (below chart) */}
      <CurrencyRatesWidget rates={rates} />

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

        {/* ── Desembolsos por Semana ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
              <Flame className="h-4 w-4 text-red-500" />
              Desembolsos por Semana
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {disbursementWeeks.map((week, wi) => (
              <div key={wi}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold text-slate-700">{week.label}</span>
                  <span className="text-sm font-bold text-red-700">{formatCurrency(week.totalUSD, 'USD')}</span>
                </div>
                {week.items.length === 0 ? (
                  <p className="text-xs text-slate-400 ml-2">Sin pagos proyectados</p>
                ) : (
                  <div className="space-y-1">
                    {URGENCY_ORDER.map((level) => {
                      const items = week.byUrgency[level]
                      if (!items || items.length === 0) return null
                      const meta = URGENCY_META[level]
                      return (
                        <div key={level}>
                          <div className={`flex items-center gap-1.5 px-2 py-1 rounded ${meta.bg}`}>
                            {level === 'Urgente' && <Flame className={`h-3 w-3 ${meta.color}`} />}
                            {level === 'Media' && <Minus className={`h-3 w-3 ${meta.color}`} />}
                            {level === 'Baja' && <Leaf className={`h-3 w-3 ${meta.color}`} />}
                            {level === 'Sin definir' && <Minus className={`h-3 w-3 ${meta.color}`} />}
                            <span className={`text-[11px] font-medium ${meta.textColor}`}>{level}</span>
                          </div>
                          {items.map((item: any) => (
                            <div key={item.id} className="flex justify-between items-center px-2 py-1 ml-4 border-b border-slate-50 last:border-0">
                              <span className="text-xs text-slate-700 truncate max-w-[200px]">
                                {item.nombre_proveedor_concepto || 'Sin detalle'}
                              </span>
                              <span className="text-xs font-medium text-slate-900 whitespace-nowrap">
                                {formatCurrency(getExpenseUSD(item), 'USD')}
                              </span>
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                )}
                {wi < disbursementWeeks.length - 1 && <div className="border-t mt-2" />}
              </div>
            ))}
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
