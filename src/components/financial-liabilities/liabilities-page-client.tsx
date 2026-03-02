"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Plus,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  MoreVertical,
  Edit2,
  Trash2,
  CreditCard,
  CheckCircle2,
  Calendar,
} from "lucide-react"
import {
  getLiabilities,
  getLiabilityDetail,
  deleteLiability,
} from "@/actions/financial-liabilities.actions"
import type { Database } from "@/types/database.types"
import { LiabilityModal } from "./liability-modal"
import { SOCIEDADES } from "@/lib/constants"

type Liability = Database["public"]["Tables"]["financial_liabilities"]["Row"]
type LiabilityPayment = Database["public"]["Tables"]["liability_payments"]["Row"]

interface LiabilitiesPageClientProps {
  sociedad?: string
}

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  paid_off: "bg-gray-100 text-gray-800",
  suspended: "bg-yellow-100 text-yellow-800",
  defaulted: "bg-red-100 text-red-800",
  scheduled: "bg-blue-100 text-blue-800",
  paid: "bg-green-100 text-green-800",
  overdue: "bg-red-100 text-red-800",
}

const statusLabels: Record<string, string> = {
  active: "Activo",
  paid_off: "Pagado",
  suspended: "Suspendido",
  defaulted: "En mora",
  scheduled: "Programado",
  paid: "Pagado",
  overdue: "Vencido",
}

const typeLabels: Record<string, string> = {
  line_of_credit: "Línea de Crédito",
  rotating_card: "TDC Rotativa",
  loan: "Préstamo",
  other: "Otro",
}

const typeIcons: Record<string, string> = {
  line_of_credit: "🏦",
  rotating_card: "💳",
  loan: "📋",
  other: "📌",
}

const fmt = (n: number | null | undefined) =>
  n != null
    ? `$${n.toLocaleString("es-CO", { maximumFractionDigits: 0 })}`
    : "—"

export function LiabilitiesPageClient({
  sociedad: societadProp,
}: LiabilitiesPageClientProps = {}) {
  const [sociedad, setSociedad] = useState(societadProp ?? SOCIEDADES[0])
  const [liabilities, setLiabilities] = useState<Liability[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedLiability, setSelectedLiability] = useState<Liability | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  // Expanded rows: liabilityId -> payments[]
  const [expandedRows, setExpandedRows] = useState<Record<string, LiabilityPayment[]>>({})
  const [loadingPayments, setLoadingPayments] = useState<Record<string, boolean>>({})

  // Fetch liabilities
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError(null)
      setExpandedRows({}) // reset expanded on sociedad change
      try {
        const data = await getLiabilities(sociedad)
        setLiabilities(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error cargando pasivos")
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [sociedad, refreshKey])

  // Toggle expanded row
  const toggleRow = async (liability: Liability) => {
    const id = liability.id
    if (expandedRows[id]) {
      // Collapse
      setExpandedRows((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      return
    }
    // Expand: load payments
    setLoadingPayments((prev) => ({ ...prev, [id]: true }))
    try {
      const detail = await getLiabilityDetail(id)
      setExpandedRows((prev) => ({ ...prev, [id]: detail.payments }))
    } catch {
      setExpandedRows((prev) => ({ ...prev, [id]: [] }))
    } finally {
      setLoadingPayments((prev) => ({ ...prev, [id]: false }))
    }
  }

  const handleCreate = () => {
    setSelectedLiability(null)
    setModalOpen(true)
  }

  const handleEdit = (liability: Liability) => {
    setSelectedLiability(liability)
    setModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este pasivo financiero?")) return
    try {
      await deleteLiability(id)
      setRefreshKey((k) => k + 1)
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error eliminando pasivo")
    }
  }

  const handleRefresh = () => setRefreshKey((k) => k + 1)

  // Summary stats
  const totalDeuda = liabilities
    .filter((l) => l.status === "active")
    .reduce((sum, l) => sum + (l.monto_total ?? 0), 0)

  const totalDisponible = liabilities
    .filter((l) => l.status === "active")
    .reduce((sum, l) => sum + (l.monto_disponible ?? 0), 0)

  const totalUsado = totalDeuda - totalDisponible
  const pctUtilizado = totalDeuda > 0 ? Math.round((totalUsado / totalDeuda) * 100) : 0

  const activeCount = liabilities.filter((l) => l.status === "active").length

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pasivos Financieros</h1>
          <p className="text-sm text-gray-500 mt-1">
            Créditos, TDCs y préstamos con seguimiento de pagos
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!societadProp && (
            <Select value={sociedad} onValueChange={setSociedad}>
              <SelectTrigger className="w-[160px] h-9 text-sm">
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
          <Button onClick={handleCreate} className="gap-2 h-9">
            <Plus className="h-4 w-4" />
            Agregar Pasivo
          </Button>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* ── Summary cards ── */}
      {!loading && liabilities.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-gray-500 mb-1">Pasivos Activos</p>
              <p className="text-2xl font-bold text-gray-800">{activeCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-gray-500 mb-1">Total Deuda</p>
              <p className="text-2xl font-bold text-red-600">{fmt(totalDeuda)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-gray-500 mb-1">Disponible</p>
              <p className="text-2xl font-bold text-green-600">{fmt(totalDisponible)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-gray-500 mb-1">% Utilizado</p>
              <p className={`text-2xl font-bold ${pctUtilizado > 80 ? "text-red-600" : pctUtilizado > 50 ? "text-yellow-600" : "text-gray-800"}`}>
                {pctUtilizado}%
              </p>
              <div className="mt-1 bg-gray-200 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all ${pctUtilizado > 80 ? "bg-red-500" : pctUtilizado > 50 ? "bg-yellow-500" : "bg-green-500"}`}
                  style={{ width: `${Math.min(pctUtilizado, 100)}%` }}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400 mr-2" />
          <span className="text-sm text-gray-500">Cargando pasivos…</span>
        </div>
      )}

      {/* ── Empty ── */}
      {!loading && liabilities.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <CreditCard className="h-10 w-10 text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No hay pasivos registrados</p>
            <p className="text-sm text-gray-400 mt-1">
              Registra créditos, TDCs o préstamos para {sociedad}
            </p>
            <Button onClick={handleCreate} className="mt-4 gap-2" variant="outline">
              <Plus className="h-4 w-4" />
              Agregar Primer Pasivo
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Liabilities list ── */}
      {!loading && liabilities.length > 0 && (
        <div className="space-y-4">
          {liabilities.map((liability) => {
            const isExpanded = !!expandedRows[liability.id]
            const isLoadingPayments = !!loadingPayments[liability.id]
            const payments = expandedRows[liability.id] ?? []

            // Compute payment totals
            const totalCapital = payments.reduce((s, p) => s + (p.monto_capital ?? 0), 0)
            const totalInteres = payments.reduce((s, p) => s + (p.monto_interes ?? 0), 0)
            const totalPago = payments.reduce((s, p) => s + (p.monto_pago ?? 0), 0)

            const usadoPct =
              liability.monto_total && liability.monto_total > 0
                ? Math.round(
                    ((liability.monto_total - (liability.monto_disponible ?? 0)) /
                      liability.monto_total) *
                      100
                  )
                : null

            return (
              <Card key={liability.id} className="overflow-hidden">
                {/* ── Liability header row ── */}
                <CardHeader className="py-3 px-4 bg-gray-50 border-b">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Expand/collapse */}
                      <button
                        onClick={() => toggleRow(liability)}
                        className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                      >
                        {isLoadingPayments ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>

                      <span className="text-xl flex-shrink-0">
                        {typeIcons[liability.tipo] ?? "📌"}
                      </span>

                      <div className="min-w-0">
                        <CardTitle className="text-sm font-semibold text-gray-900 truncate">
                          {liability.nombre}
                        </CardTitle>
                        <p className="text-xs text-gray-400">
                          {typeLabels[liability.tipo] ?? liability.tipo}
                          {liability.banco ? ` · ${liability.banco}` : ""}
                          {liability.moneda ? ` · ${liability.moneda}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 flex-shrink-0">
                      {/* Key metrics */}
                      <div className="hidden sm:flex items-center gap-6 text-right">
                        <div>
                          <p className="text-xs text-gray-400">Total</p>
                          <p className="text-sm font-bold text-gray-700">
                            {fmt(liability.monto_total)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">Disponible</p>
                          <p className="text-sm font-bold text-green-600">
                            {fmt(liability.monto_disponible)}
                          </p>
                        </div>
                        {liability.tasa_interes != null && (
                          <div>
                            <p className="text-xs text-gray-400">Tasa</p>
                            <p className="text-sm font-bold text-gray-700">
                              {liability.tasa_interes}%
                            </p>
                          </div>
                        )}
                        {usadoPct != null && (
                          <div className="w-20">
                            <p className="text-xs text-gray-400 mb-0.5">Uso</p>
                            <div className="bg-gray-200 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full ${usadoPct > 80 ? "bg-red-500" : usadoPct > 50 ? "bg-yellow-500" : "bg-green-500"}`}
                                style={{ width: `${Math.min(usadoPct, 100)}%` }}
                              />
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">{usadoPct}% usado</p>
                          </div>
                        )}
                      </div>

                      <Badge
                        className={`${statusColors[liability.status] ?? "bg-gray-100 text-gray-700"} border-0 text-xs`}
                      >
                        {statusLabels[liability.status] ?? liability.status}
                      </Badge>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(liability)}>
                            <Edit2 className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(liability.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>

                {/* ── Expandable payment schedule ── */}
                {isExpanded && (
                  <CardContent className="p-0">
                    {payments.length === 0 ? (
                      <div className="flex items-center gap-2 px-6 py-4 text-sm text-gray-500">
                        <Calendar className="h-4 w-4 text-gray-300" />
                        No hay pagos programados para este pasivo.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-50 text-xs">
                              <TableHead className="py-2">Fecha de Pago</TableHead>
                              <TableHead className="text-right py-2">Capital</TableHead>
                              <TableHead className="text-right py-2">Interés</TableHead>
                              <TableHead className="text-right py-2 font-bold">Total Cuota</TableHead>
                              <TableHead className="py-2">Estado</TableHead>
                              <TableHead className="py-2">Notas</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {payments.map((payment) => (
                              <TableRow key={payment.id} className="text-sm hover:bg-gray-50">
                                <TableCell className="py-2 font-mono text-xs">
                                  <div className="flex items-center gap-1.5">
                                    <Calendar className="h-3.5 w-3.5 text-gray-400" />
                                    {payment.fecha_pago}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right py-2 font-mono">
                                  {payment.monto_capital != null ? (
                                    <span className="text-blue-700">
                                      {fmt(payment.monto_capital)}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right py-2 font-mono">
                                  {payment.monto_interes != null ? (
                                    <span className="text-orange-600">
                                      {fmt(payment.monto_interes)}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right py-2 font-mono font-bold">
                                  {fmt(payment.monto_pago)}
                                </TableCell>
                                <TableCell className="py-2">
                                  <Badge
                                    className={`${statusColors[payment.estado ?? "scheduled"] ?? "bg-gray-100 text-gray-700"} border-0 text-xs`}
                                  >
                                    {payment.estado === "paid" ? (
                                      <CheckCircle2 className="h-3 w-3 mr-1" />
                                    ) : null}
                                    {statusLabels[payment.estado ?? "scheduled"] ?? payment.estado}
                                  </Badge>
                                </TableCell>
                                <TableCell className="py-2 text-xs text-gray-500">
                                  {payment.notas ?? "—"}
                                </TableCell>
                              </TableRow>
                            ))}

                            {/* ── Totals row ── */}
                            <TableRow className="bg-gray-50 font-semibold text-sm border-t-2">
                              <TableCell className="py-2 text-gray-600">
                                TOTALES ({payments.length} cuotas)
                              </TableCell>
                              <TableCell className="text-right py-2 font-mono text-blue-700">
                                {fmt(totalCapital)}
                              </TableCell>
                              <TableCell className="text-right py-2 font-mono text-orange-600">
                                {fmt(totalInteres)}
                              </TableCell>
                              <TableCell className="text-right py-2 font-mono font-bold text-gray-900">
                                {fmt(totalPago)}
                              </TableCell>
                              <TableCell />
                              <TableCell />
                            </TableRow>
                          </TableBody>
                        </Table>

                        {/* ── Capital vs Interés breakdown bar ── */}
                        {totalPago > 0 && (
                          <div className="px-4 py-3 bg-gray-50 border-t flex items-center gap-4 text-xs">
                            <div className="flex items-center gap-1.5">
                              <span className="inline-block w-3 h-3 rounded-sm bg-blue-400" />
                              <span className="text-gray-600">
                                Capital: <strong>{fmt(totalCapital)}</strong>{" "}
                                ({totalPago > 0 ? Math.round((totalCapital / totalPago) * 100) : 0}%)
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="inline-block w-3 h-3 rounded-sm bg-orange-400" />
                              <span className="text-gray-600">
                                Interés: <strong>{fmt(totalInteres)}</strong>{" "}
                                ({totalPago > 0 ? Math.round((totalInteres / totalPago) * 100) : 0}%)
                              </span>
                            </div>
                            <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                              <div
                                className="h-full bg-blue-400 float-left rounded-l-full"
                                style={{
                                  width: `${totalPago > 0 ? (totalCapital / totalPago) * 100 : 0}%`,
                                }}
                              />
                              <div
                                className="h-full bg-orange-400 rounded-r-full"
                                style={{
                                  width: `${totalPago > 0 ? (totalInteres / totalPago) * 100 : 0}%`,
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* ── Modal ── */}
      <LiabilityModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setSelectedLiability(null)
        }}
        liability={selectedLiability}
        onSuccess={handleRefresh}
      />
    </div>
  )
}
