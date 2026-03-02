// @ts-nocheck
"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertCircle,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Calendar,
} from "lucide-react"
import { calculateEstimatedCashFlow } from "@/actions/cashflow-calculator.actions"
import { CashflowBreakdownDialog } from "./cashflow-breakdown-dialog"
import { SOCIEDADES } from "@/lib/constants"

// ─── Inline helpers (pure math — avoids server action async issues) ───────────

function getWeekInfoSync(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00") // noon to avoid TZ shift
  const dayOfWeek = d.getDay()

  const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
  const weekStart = new Date(d)
  weekStart.setDate(diff)

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 4) // Friday

  const jan4 = new Date(d.getFullYear(), 0, 4)
  const msPerDay = 86400000
  const weekNum = Math.ceil(
    ((d.getTime() - jan4.getTime()) / msPerDay + jan4.getDay() + 1) / 7
  )

  const fmt = (dt: Date) => dt.toISOString().split("T")[0]
  return {
    weekNumber: weekNum,
    startDate: fmt(weekStart),
    endDate: fmt(weekEnd),
    isFriday: dayOfWeek === 5,
    dayOfWeek,
  }
}

function calcClosingBalance(
  openingBalance: number,
  cashIn: number,
  cashOut: number,
  manualIn: number,
  manualOut: number
) {
  return openingBalance + manualIn - manualOut + cashIn - cashOut
}

function checkDeficit(closingBalance: number) {
  const isDeficit = closingBalance < 0
  const suggestedActions: string[] = []
  if (isDeficit) {
    suggestedActions.push("Considerar factoring de facturas")
    suggestedActions.push("Revisar cronograma de pagos")
    suggestedActions.push("Contactar clientes para adelantos")
    if (Math.abs(closingBalance) > 50000)
      suggestedActions.push("Solicitar crédito de emergencia")
  }
  return { isDeficit, amount: isDeficit ? Math.abs(closingBalance) : 0, suggestedActions }
}

// ─────────────────────────────────────────────────────────────────────────────

interface WeeklyCashflowViewProps {
  sociedad?: string // optional override; defaults to internal selector
}

export function WeeklyCashflowView({ sociedad: societadProp }: WeeklyCashflowViewProps = {}) {
  const [sociedad, setSociedad] = useState(societadProp ?? SOCIEDADES[0])
  const [currentDate, setCurrentDate] = useState(
    new Date().toISOString().split("T")[0]
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [cashFlow, setCashFlow] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [breakdownOpen, setBreakdownOpen] = useState(false)
  const [manualInAdjustment, setManualInAdjustment] = useState(0)
  const [manualOutAdjustment, setManualOutAdjustment] = useState(0)
  const [openingBalance, setOpeningBalance] = useState(0)

  const weekInfo = useMemo(() => getWeekInfoSync(currentDate), [currentDate])

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      setError(null)
      try {
        const flow = await calculateEstimatedCashFlow(
          sociedad,
          weekInfo.startDate,
          weekInfo.endDate
        )
        setCashFlow(flow)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error cargando datos")
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [sociedad, weekInfo.startDate, weekInfo.endDate])

  // ── Derived ──
  const totalCashIn = (cashFlow?.estimated_cash_in ?? 0) + manualInAdjustment
  const totalCashOut = (cashFlow?.estimated_cash_out ?? 0) + manualOutAdjustment
  const closingBalance = calcClosingBalance(
    openingBalance,
    cashFlow?.estimated_cash_in ?? 0,
    cashFlow?.estimated_cash_out ?? 0,
    manualInAdjustment,
    manualOutAdjustment
  )
  const netFlow = totalCashIn - totalCashOut
  const deficit = checkDeficit(closingBalance)
  const isSurplus = closingBalance > 0

  const fmt = (n: number) =>
    `$${Math.abs(n).toLocaleString("es-CO", { maximumFractionDigits: 0 })}`

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Flujo de Caja Semanal</h1>
        <p className="text-sm text-gray-500 mt-1">
          Proyección automática de ingresos y egresos por semana
        </p>
      </div>

      {/* ── Controls bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border rounded-lg px-4 py-3">
        <div>
          <p className="text-sm font-medium text-gray-700">
            Semana {weekInfo.weekNumber}
          </p>
          <p className="text-xs text-gray-500">
            {weekInfo.startDate} → {weekInfo.endDate}
            {weekInfo.isFriday && (
              <span className="ml-2 text-blue-600 font-medium">
                📅 Viernes — Cierre de semana
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Sociedad selector */}
          {!societadProp && (
            <Select value={sociedad} onValueChange={setSociedad}>
              <SelectTrigger className="w-[150px] h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOCIEDADES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => {
            const d = new Date(currentDate); d.setDate(d.getDate() - 7)
            setCurrentDate(d.toISOString().split("T")[0])
          }}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() =>
            setCurrentDate(new Date().toISOString().split("T")[0])
          }>
            <Calendar className="h-3.5 w-3.5 mr-1" /> Hoy
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => {
            const d = new Date(currentDate); d.setDate(d.getDate() + 7)
            setCurrentDate(d.toISOString().split("T")[0])
          }}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ── Saldo inicial ── */}
      <Card className="border-dashed border-gray-300">
        <CardContent className="py-3 flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-gray-600 whitespace-nowrap">
            Saldo Inicial de la semana:
          </span>
          <Input
            type="number"
            step="1"
            className="w-44 h-8 font-mono text-sm"
            value={openingBalance}
            onChange={(e) => setOpeningBalance(parseFloat(e.target.value) || 0)}
          />
          <span className="text-xs text-gray-400">
            (saldo en caja al lunes)
          </span>
        </CardContent>
      </Card>

      {/* ── Error ── */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400 mr-2" />
          <span className="text-sm text-gray-500">Calculando flujo de caja…</span>
        </div>
      )}

      {/* ── Main grid ── */}
      {!loading && cashFlow && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* ── INGRESOS ── */}
            <Card className="border-green-200">
              <CardHeader className="bg-green-50 border-b border-green-200 py-3">
                <CardTitle className="flex items-center gap-2 text-green-900 text-sm">
                  <TrendingUp className="h-4 w-4" />
                  INGRESOS PROYECTADOS
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="bg-gray-50 rounded-md p-3">
                  <p className="text-xs text-gray-400 mb-1">Auto-calculado desde facturas</p>
                  <p className="text-2xl font-bold text-green-600">
                    {fmt(cashFlow.estimated_cash_in)}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {cashFlow.invoices_in.length} factura(s) con pago proyectado esta semana
                  </p>
                </div>

                <div>
                  <label className="text-xs text-gray-500 block mb-1">
                    Ajuste manual (+/-)
                  </label>
                  <Input
                    type="number"
                    step="1"
                    className="font-mono text-sm h-8"
                    value={manualInAdjustment}
                    onChange={(e) => setManualInAdjustment(parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div className="bg-green-100 rounded-md p-3 border border-green-200">
                  <p className="text-xs font-semibold text-green-800 mb-1">TOTAL INGRESOS</p>
                  <p className="text-3xl font-bold text-green-700">{fmt(totalCashIn)}</p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs h-8"
                  onClick={() => setBreakdownOpen(true)}
                >
                  Ver desglose de facturas →
                </Button>
              </CardContent>
            </Card>

            {/* ── EGRESOS ── */}
            <Card className="border-red-200">
              <CardHeader className="bg-red-50 border-b border-red-200 py-3">
                <CardTitle className="flex items-center gap-2 text-red-900 text-sm">
                  <TrendingDown className="h-4 w-4" />
                  EGRESOS PROYECTADOS
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="bg-gray-50 rounded-md p-3">
                  <p className="text-xs text-gray-400 mb-1">Auto-calculado</p>
                  <p className="text-2xl font-bold text-red-600">
                    {fmt(cashFlow.estimated_cash_out)}
                  </p>
                  <div className="text-xs text-gray-400 mt-1 space-y-0.5">
                    <p>· {cashFlow.invoices_out.length} factura(s) de gasto</p>
                    {cashFlow.payroll_total > 0 && (
                      <p>· Nómina (quincenal): {fmt(cashFlow.payroll_total)}</p>
                    )}
                    {cashFlow.liability_payments_total > 0 && (
                      <p>· Pasivos financieros: {fmt(cashFlow.liability_payments_total)}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-500 block mb-1">
                    Ajuste manual (+/-)
                  </label>
                  <Input
                    type="number"
                    step="1"
                    className="font-mono text-sm h-8"
                    value={manualOutAdjustment}
                    onChange={(e) => setManualOutAdjustment(parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div className="bg-red-100 rounded-md p-3 border border-red-200">
                  <p className="text-xs font-semibold text-red-800 mb-1">TOTAL EGRESOS</p>
                  <p className="text-3xl font-bold text-red-700">{fmt(totalCashOut)}</p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs h-8"
                  onClick={() => setBreakdownOpen(true)}
                >
                  Ver desglose de gastos →
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* ── Resumen final ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-gray-500 mb-1">Flujo Neto de la Semana</p>
                <p className={`text-2xl font-bold ${netFlow >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {netFlow >= 0 ? "+" : "-"}{fmt(netFlow)}
                </p>
                <p className="text-xs text-gray-400 mt-1">Ingresos − Egresos</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-gray-500 mb-1">Saldo Inicial</p>
                <p className="text-2xl font-bold text-gray-700">{fmt(openingBalance)}</p>
              </CardContent>
            </Card>

            <Card className={weekInfo.isFriday ? "border-2 border-blue-500 bg-blue-50" : ""}>
              <CardContent className="pt-4">
                <p className="text-xs text-gray-500 mb-1">
                  Saldo Final {weekInfo.isFriday ? "✓" : "(provisional)"}
                </p>
                <p className={`text-2xl font-bold ${closingBalance >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {closingBalance >= 0 ? "" : "-"}{fmt(closingBalance)}
                </p>
                {!weekInfo.isFriday && (
                  <p className="text-xs text-gray-400 mt-1">Se confirma el viernes</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Alertas ── */}
          {deficit.isDeficit && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>⚠️ Déficit Proyectado</AlertTitle>
              <AlertDescription>
                <p className="mb-2">
                  Faltante estimado: <strong>{fmt(deficit.amount)}</strong>
                </p>
                <ul className="list-disc pl-4 space-y-1">
                  {deficit.suggestedActions.map((a, i) => (
                    <li key={i} className="text-sm">{a}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {isSurplus && !deficit.isDeficit && (
            <Alert className="border-green-300 bg-green-50">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-900">✓ Superávit proyectado</AlertTitle>
              <AlertDescription className="text-green-700">
                Superávit: <strong>{fmt(closingBalance)}</strong>
              </AlertDescription>
            </Alert>
          )}
        </>
      )}

      {/* ── Breakdown dialog ── */}
      {cashFlow && (
        <CashflowBreakdownDialog
          open={breakdownOpen}
          onClose={() => setBreakdownOpen(false)}
          cashFlow={cashFlow}
          weekInfo={weekInfo}
          sociedad={sociedad}
        />
      )}
    </div>
  )
}
