// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/shared/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DollarSign, CheckCircle, Clock, AlertCircle, Loader2, Undo2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { payCommission, bulkPayCommissions, updateCommission } from '@/actions/commissions.actions'
import { formatCurrency } from '@/lib/currency'

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pendiente: { label: 'Pendiente', className: 'bg-gray-100 text-gray-800' },
  por_pagar: { label: 'Por pagar', className: 'bg-yellow-100 text-yellow-800' },
  pagada: { label: 'Pagada', className: 'bg-green-100 text-green-800' },
  anulada: { label: 'Anulada', className: 'bg-red-100 text-red-800' },
}

const MONEDAS_PAGO = ['USD', 'COP', 'MXN', 'BRL', 'PEN', 'EUR']
const FALLBACK_RATES: Record<string, number> = { USD: 1, COP: 4150, MXN: 17, BRL: 5, PEN: 3.7, EUR: 0.92 }

interface Props {
  commissions: any[]
  summary: { byVendedor: Record<string, any>; totals: { pendiente: number; por_pagar: number; pagada: number } }
  userEmail: string
}

export function ComisionesClient({ commissions, summary, userEmail }: Props) {
  const { toast } = useToast()
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterVendedor, setFilterVendedor] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [filterFechaDesde, setFilterFechaDesde] = useState('')
  const [filterFechaHasta, setFilterFechaHasta] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [paying, setPaying] = useState(false)
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0])
  const [monedaPago, setMonedaPago] = useState('COP')

  const vendedores = [...new Set(commissions.map(c => c.beneficiario_nombre).filter(Boolean))]

  const filtered = commissions.filter(c => {
    if (filterStatus !== 'all' && c.status !== filterStatus) return false
    if (filterVendedor !== 'all' && c.beneficiario_nombre !== filterVendedor) return false
    if (filterFechaDesde && c.fecha_pago) {
      const fp = c.fecha_pago.substring(0, 10)
      if (fp < filterFechaDesde) return false
    }
    if (filterFechaHasta && c.fecha_pago) {
      const fp = c.fecha_pago.substring(0, 10)
      if (fp > filterFechaHasta) return false
    }
    if (filterFechaDesde && !c.fecha_pago && filterStatus === 'pagada') return false
    if (search) {
      const q = search.toLowerCase()
      return (c.beneficiario_nombre || '').toLowerCase().includes(q) ||
             (c.cliente_nombre || '').toLowerCase().includes(q) ||
             (c.income_invoices?.numero_documento || '').toLowerCase().includes(q)
    }
    return true
  })

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  // Calculate selected total in payment currency
  const selectedTotal = [...selectedIds].reduce((sum, id) => {
    const c = commissions.find(x => x.id === id)
    return sum + (c?.monto_comision_usd || 0)
  }, 0)
  const rate = FALLBACK_RATES[monedaPago] || 1
  const selectedTotalInPayCurrency = monedaPago === 'USD' ? selectedTotal : selectedTotal * rate

  const handlePay = async (id: string) => {
    setPaying(true)
    try {
      await payCommission(id, payDate, userEmail)
      toast({ title: 'Comisión pagada' })
      window.location.reload()
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' })
    } finally { setPaying(false) }
  }

  const handleUnpay = async (id: string) => {
    setPaying(true)
    try {
      await updateCommission(id, { status: 'por_pagar', fecha_pago: null, pagado_por: null } as any)
      toast({ title: 'Comisión desmarcada' })
      window.location.reload()
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' })
    } finally { setPaying(false) }
  }

  const handleBulkPay = async () => {
    const porPagar = [...selectedIds].filter(id => {
      const c = commissions.find(x => x.id === id)
      return c?.status === 'por_pagar'
    })
    if (porPagar.length === 0) {
      toast({ title: 'Selecciona comisiones con estado "Por pagar"', variant: 'destructive' })
      return
    }
    setPaying(true)
    try {
      await bulkPayCommissions(porPagar, payDate, userEmail)
      toast({ title: `${porPagar.length} comisiones pagadas` })
      window.location.reload()
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' })
    } finally { setPaying(false) }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Comisiones" description="Control de comisiones por vendedor y aliado" />

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-500" />
              <p className="text-xs text-muted-foreground">Pendiente</p>
            </div>
            <p className="text-xl font-bold mt-1">{formatCurrency(summary.totals.pendiente, 'USD')}</p>
          </CardContent>
        </Card>
        <Card className="border-yellow-200">
          <CardContent className="py-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <p className="text-xs text-muted-foreground">Por pagar</p>
            </div>
            <p className="text-xl font-bold text-yellow-700 mt-1">{formatCurrency(summary.totals.por_pagar, 'USD')}</p>
          </CardContent>
        </Card>
        <Card className="border-green-200">
          <CardContent className="py-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <p className="text-xs text-muted-foreground">Pagada</p>
            </div>
            <p className="text-xl font-bold text-green-700 mt-1">{formatCurrency(summary.totals.pagada, 'USD')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              <p className="text-xs text-muted-foreground">Total registrado</p>
            </div>
            <p className="text-xl font-bold mt-1">{formatCurrency(summary.totals.pendiente + summary.totals.por_pagar + summary.totals.pagada, 'USD')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Per vendedor */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {Object.entries(summary.byVendedor).sort(([,a], [,b]) => b.total - a.total).map(([name, data]) => (
          <Card key={name} className="p-3">
            <p className="text-sm font-semibold">{name}</p>
            <div className="grid grid-cols-3 gap-1 mt-2 text-xs">
              <div>
                <p className="text-muted-foreground">Pendiente</p>
                <p className="font-medium">{formatCurrency(data.pendiente, 'USD')}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Por pagar</p>
                <p className="font-medium text-yellow-700">{formatCurrency(data.por_pagar, 'USD')}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Pagada</p>
                <p className="font-medium text-green-700">{formatCurrency(data.pagada, 'USD')}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          <Input placeholder="Buscar vendedor, cliente, factura..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pendiente">Pendiente</SelectItem>
              <SelectItem value="por_pagar">Por pagar</SelectItem>
              <SelectItem value="pagada">Pagada</SelectItem>
              <SelectItem value="anulada">Anulada</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterVendedor} onValueChange={setFilterVendedor}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Vendedor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {vendedores.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <label className="text-xs text-muted-foreground">Fecha pago desde:</label>
          <Input type="date" value={filterFechaDesde} onChange={(e) => setFilterFechaDesde(e.target.value)} className="w-40" />
          <label className="text-xs text-muted-foreground">hasta:</label>
          <Input type="date" value={filterFechaHasta} onChange={(e) => setFilterFechaHasta(e.target.value)} className="w-40" />
          {(filterFechaDesde || filterFechaHasta) && (
            <Button variant="ghost" size="sm" onClick={() => { setFilterFechaDesde(''); setFilterFechaHasta('') }}>
              Limpiar fechas
            </Button>
          )}
        </div>
      </div>

      {/* Bulk pay bar */}
      {selectedIds.size > 0 && (
        <Card className="border-green-300 bg-green-50">
          <CardContent className="py-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium">{selectedIds.size} seleccionadas</span>
              <Select value={monedaPago} onValueChange={setMonedaPago}>
                <SelectTrigger className="w-24 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONEDAS_PAGO.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="text-sm">
                <span className="text-muted-foreground">Total USD: </span>
                <span className="font-bold">{formatCurrency(selectedTotal, 'USD')}</span>
              </div>
              {monedaPago !== 'USD' && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Total {monedaPago}: </span>
                  <span className="font-bold">{new Intl.NumberFormat('es-CO', { minimumFractionDigits: 0 }).format(selectedTotalInPayCurrency)}</span>
                </div>
              )}
              <div className="flex items-center gap-2 ml-auto">
                <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className="w-40 h-8" />
                <Button onClick={handleBulkPay} disabled={paying} size="sm" className="bg-green-600 hover:bg-green-700 text-white">
                  {paying ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                  Pagar {selectedIds.size}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-2 py-2 text-left w-8"></th>
              <th className="px-2 py-2 text-left text-xs">Vendedor</th>
              <th className="px-2 py-2 text-left text-xs">Tipo</th>
              <th className="px-2 py-2 text-left text-xs">Cliente</th>
              <th className="px-2 py-2 text-left text-xs">Factura</th>
              <th className="px-2 py-2 text-left text-xs">Cuota</th>
              <th className="px-2 py-2 text-right text-xs">%</th>
              <th className="px-2 py-2 text-right text-xs">Base USD</th>
              <th className="px-2 py-2 text-right text-xs">Comisión USD</th>
              <th className="px-2 py-2 text-right text-xs">En {monedaPago}</th>
              <th className="px-2 py-2 text-left text-xs">Pago cliente</th>
              <th className="px-2 py-2 text-left text-xs">Estado</th>
              <th className="px-2 py-2 text-left text-xs">Pago comisión</th>
              <th className="px-2 py-2 text-xs"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => {
              const comUSD = c.monto_comision_usd || 0
              const comLocal = monedaPago === 'USD' ? comUSD : comUSD * (FALLBACK_RATES[monedaPago] || 1)
              return (
                <tr key={c.id} className="border-t hover:bg-slate-50">
                  <td className="px-2 py-2">
                    {(c.status === 'por_pagar' || c.status === 'pagada') && (
                      <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)} />
                    )}
                  </td>
                  <td className="px-2 py-2">
                    {c.beneficiario_nombre === 'Sin asignar' || !c.beneficiario_nombre ? (
                      <select
                        className="text-xs border rounded px-1 py-0.5 text-red-600 font-medium bg-red-50 w-full"
                        value=""
                        onChange={async (e) => {
                          if (!e.target.value) return
                          try {
                            await updateCommission(c.id, { beneficiario_nombre: e.target.value })
                            toast({ title: `Vendedor asignado: ${e.target.value}` })
                            window.location.reload()
                          } catch { toast({ title: 'Error', variant: 'destructive' }) }
                        }}
                      >
                        <option value="">⚠ Asignar vendedor</option>
                        {vendedores.map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    ) : (
                      <select
                        className="text-xs border-0 bg-transparent font-medium cursor-pointer hover:bg-slate-100 rounded px-1 py-0.5 w-full"
                        value={c.beneficiario_nombre}
                        onChange={async (e) => {
                          if (!e.target.value || e.target.value === c.beneficiario_nombre) return
                          try {
                            await updateCommission(c.id, { beneficiario_nombre: e.target.value })
                            toast({ title: `Vendedor cambiado a: ${e.target.value}` })
                            window.location.reload()
                          } catch { toast({ title: 'Error', variant: 'destructive' }) }
                        }}
                      >
                        {vendedores.map(v => <option key={v} value={v}>{v}</option>)}
                        {!vendedores.includes(c.beneficiario_nombre) && (
                          <option value={c.beneficiario_nombre}>{c.beneficiario_nombre}</option>
                        )}
                      </select>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <Badge variant="outline" className="text-[10px]">{c.tipo === 'aliado' ? 'Aliado' : 'Vendedor'}</Badge>
                  </td>
                  <td className="px-2 py-2 text-xs truncate max-w-[150px]">{c.cliente_nombre}</td>
                  <td className="px-2 py-2 text-xs">{c.income_invoices?.numero_documento || '—'}</td>
                  <td className="px-2 py-2 text-[10px]">{c.cuota_mes ? `${c.cuota_numero || ''}. ${c.cuota_mes}` : '—'}</td>
                  <td className="px-2 py-2">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={c.porcentaje}
                      onChange={async (e) => {
                        const newPct = parseFloat(e.target.value)
                        if (isNaN(newPct)) return
                        const newComision = (c.monto_base || 0) * (newPct / 100)
                        try {
                          await updateCommission(c.id, {
                            porcentaje: newPct,
                            monto_comision: newComision,
                            monto_comision_usd: newComision
                          })
                          toast({ title: `Comisión actualizada: ${newPct}%` })
                          window.location.reload()
                        } catch { toast({ title: 'Error', variant: 'destructive' }) }
                      }}
                      className="h-6 text-[10px] w-16 text-right"
                    />
                  </td>
                  <td className="px-2 py-2 text-xs text-right">{formatCurrency(c.monto_base || 0, 'USD')}</td>
                  <td className="px-2 py-2 text-xs text-right font-medium">{formatCurrency(comUSD, 'USD')}</td>
                  <td className="px-2 py-2 text-xs text-right">
                    {monedaPago === 'USD'
                      ? '—'
                      : new Intl.NumberFormat('es-CO', { minimumFractionDigits: 0 }).format(comLocal)}
                  </td>
                  <td className="px-2 py-2">
                    {c.income_invoices?.fecha_pago_o_cobro
                      ? <span className="text-green-700 font-medium text-xs">{new Date(c.income_invoices.fecha_pago_o_cobro + 'T00:00:00').toLocaleDateString('es-CO')}</span>
                      : <span className="text-muted-foreground text-xs">{c.income_invoices?.estado || '—'}</span>}
                  </td>
                  <td className="px-2 py-2">
                    <Badge variant="outline" className={`text-[10px] ${STATUS_CONFIG[c.status]?.className || ''}`}>
                      {STATUS_CONFIG[c.status]?.label || c.status}
                    </Badge>
                  </td>
                  <td className="px-2 py-2">
                    {c.status === 'pagada' ? (
                      <Input
                        type="date"
                        value={c.fecha_pago ? c.fecha_pago.substring(0, 10) : ''}
                        onChange={async (e) => {
                          const newDate = e.target.value
                          if (newDate) {
                            try {
                              await updateCommission(c.id, { fecha_pago: newDate })
                              toast({ title: 'Fecha actualizada' })
                              window.location.reload()
                            } catch { toast({ title: 'Error', variant: 'destructive' }) }
                          }
                        }}
                        className="h-6 text-[10px] w-32"
                      />
                    ) : (
                      <span className="text-xs">{c.fecha_pago ? new Date(c.fecha_pago).toLocaleDateString('es-CO') : '—'}</span>
                    )}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    {c.status === 'por_pagar' && (
                      <Button size="sm" variant="outline" className="h-6 text-[10px] text-green-700" onClick={() => handlePay(c.id)} disabled={paying}>
                        Pagar
                      </Button>
                    )}
                    {c.status === 'pagada' && (
                      <Button size="sm" variant="ghost" className="h-6 text-[10px] text-orange-600" onClick={() => handleUnpay(c.id)} disabled={paying}>
                        <Undo2 className="h-3 w-3 mr-1" />
                        Desmarcar
                      </Button>
                    )}
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={14} className="text-center py-8 text-muted-foreground text-sm">Sin comisiones</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
