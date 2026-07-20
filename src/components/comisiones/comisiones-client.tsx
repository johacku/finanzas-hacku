// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/shared/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DollarSign, CheckCircle, Clock, AlertCircle, Loader2, Undo2, Plus, RefreshCw } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { updateCommission, createManualCommission, syncCommissionStatuses } from '@/actions/commissions.actions'
import { updateItemCommission, syncItemCommissionStatuses } from '@/actions/item-commissions.actions'
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
  itemCommissions?: any[]
  itemSummary?: { byItem: Record<string, any>; byVendedor: Record<string, any> }
  userEmail: string
  initialSearch?: string
}

export function ComisionesClient({ commissions, summary, itemCommissions = [], itemSummary, userEmail, initialSearch = '' }: Props) {
  const { toast } = useToast()
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterVendedor, setFilterVendedor] = useState<string>('all')
  const [filterQuincena, setFilterQuincena] = useState<string>('all')
  const [search, setSearch] = useState(initialSearch)
  const [filterFechaDesde, setFilterFechaDesde] = useState('')
  const [filterFechaHasta, setFilterFechaHasta] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [paying, setPaying] = useState(false)
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0])
  const [monedaPago, setMonedaPago] = useState('COP')
  const [payingId, setPayingId] = useState<string | null>(null)
  const [payAmount, setPayAmount] = useState<string>('')
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [addFactura, setAddFactura] = useState('')
  const [addVendedor, setAddVendedor] = useState('')
  const [addPorcentaje, setAddPorcentaje] = useState('5')
  const [addRol, setAddRol] = useState('closer')
  const [syncing, setSyncing] = useState(false)
  const [viewGrouped, setViewGrouped] = useState(false)
  const [viewMode, setViewMode] = useState<'vendedor' | 'items'>('vendedor')

  const vendedores = [...new Set(commissions.map(c => c.beneficiario_nombre).filter(Boolean))]
  const quincenas = [...new Set(commissions.map(c => c.quincena_corte).filter(Boolean))].sort().reverse()

  const filtered = commissions.filter(c => {
    if (filterStatus !== 'all' && c.status !== filterStatus) return false
    if (filterVendedor !== 'all' && c.beneficiario_nombre !== filterVendedor) return false
    if (filterQuincena !== 'all' && c.quincena_corte !== filterQuincena) return false
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
      for (const id of porPagar) {
        const c = commissions.find(x => x.id === id)
        if (c) {
          await updateCommission(id, {
            monto_pagado: c.monto_comision_usd || 0,
            status: 'pagada',
            fecha_pago: payDate,
            pagado_por: userEmail,
          })
        }
      }
      toast({ title: `${porPagar.length} comisiones pagadas` })
      window.location.reload()
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' })
    } finally { setPaying(false) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Comisiones" description="Control de comisiones por vendedor y aliado" />
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={syncing} onClick={async () => {
            setSyncing(true)
            try {
              await syncCommissionStatuses()
              await syncItemCommissionStatuses().catch(console.error)
              toast({ title: 'Estados sincronizados' })
              window.location.reload()
            } catch {
              toast({ title: 'Error al sincronizar', variant: 'destructive' })
            } finally { setSyncing(false) }
          }}>
            {syncing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
            Sincronizar
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowAddDialog(true)}>
            <Plus className="h-3 w-3 mr-1" /> Agregar comision
          </Button>
        </div>
      </div>

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

      {/* Invoice Summary */}
      {(() => {
        const invoiceSummary = Object.values(
          commissions.reduce((acc: Record<string, any>, c: any) => {
            const key = c.income_invoices?.numero_documento || c.cliente_nombre || c.id
            if (!acc[key]) acc[key] = {
              factura: c.income_invoices?.numero_documento || '\u2014',
              cliente: c.cliente_nombre || '\u2014',
              total_comision: 0,
              pagado: 0,
              pendiente: 0,
              count: 0
            }
            const usd = c.monto_comision_usd || 0
            acc[key].total_comision += usd
            acc[key].count++
            if (c.status === 'pagada') acc[key].pagado += usd
            else if (c.status !== 'anulada') acc[key].pendiente += usd
            return acc
          }, {})
        ).sort((a: any, b: any) => b.pendiente - a.pendiente)

        return (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Resumen por Factura</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto max-h-60">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="py-1.5 px-2 text-left">Factura</th>
                      <th className="py-1.5 px-2 text-left">Cliente</th>
                      <th className="py-1.5 px-2 text-right">{'Total Comisi\u00f3n'}</th>
                      <th className="py-1.5 px-2 text-right">Pagado</th>
                      <th className="py-1.5 px-2 text-right">Pendiente</th>
                      <th className="py-1.5 px-2 text-right">KAMs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceSummary.slice(0, 30).map((s: any, i: number) => (
                      <tr key={i} className="border-t">
                        <td className="py-1.5 px-2 font-medium">{s.factura}</td>
                        <td className="py-1.5 px-2 truncate max-w-[150px]">{s.cliente}</td>
                        <td className="py-1.5 px-2 text-right">{formatCurrency(s.total_comision, 'USD')}</td>
                        <td className="py-1.5 px-2 text-right text-green-700">{formatCurrency(s.pagado, 'USD')}</td>
                        <td className="py-1.5 px-2 text-right text-amber-700 font-medium">{s.pendiente > 0 ? formatCurrency(s.pendiente, 'USD') : '\u2014'}</td>
                        <td className="py-1.5 px-2 text-right">{s.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )
      })()}

      {/* View mode tabs */}
      <div className="flex items-center gap-2 border-b pb-2">
        <Button
          variant={viewMode === 'vendedor' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('vendedor')}
        >
          Por Vendedor
        </Button>
        <Button
          variant={viewMode === 'items' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('items')}
        >
          Por Items
        </Button>
      </div>

      {/* Item commissions view */}
      {viewMode === 'items' && (
        <div className="space-y-4">
          {/* Item summary cards */}
          {itemSummary?.byItem && Object.keys(itemSummary.byItem).length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {Object.entries(itemSummary.byItem).sort(([,a]: any, [,b]: any) => b.total - a.total).map(([name, data]: any) => (
                <Card key={name} className="p-3">
                  <p className="text-sm font-semibold truncate">{name}</p>
                  <p className="text-[10px] text-muted-foreground">{data.count} comisiones</p>
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
          )}

          {/* Item commissions table */}
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-2 py-2 text-left text-xs">Item</th>
                  <th className="px-2 py-2 text-left text-xs">Vendedor</th>
                  <th className="px-2 py-2 text-left text-xs">Rol</th>
                  <th className="px-2 py-2 text-left text-xs">Cliente</th>
                  <th className="px-2 py-2 text-right text-xs">Cantidad</th>
                  <th className="px-2 py-2 text-right text-xs">Precio</th>
                  <th className="px-2 py-2 text-right text-xs">Subtotal USD</th>
                  <th className="px-2 py-2 text-right text-xs">%</th>
                  <th className="px-2 py-2 text-right text-xs">Comision USD</th>
                  <th className="px-2 py-2 text-right text-xs">Pagado</th>
                  <th className="px-2 py-2 text-right text-xs">Saldo</th>
                  <th className="px-2 py-2 text-left text-xs">Estado</th>
                  <th className="px-2 py-2 text-xs"></th>
                </tr>
              </thead>
              <tbody>
                {(itemCommissions || [])
                  .filter(c => {
                    if (filterStatus !== 'all' && c.status !== filterStatus) return false
                    if (filterVendedor !== 'all' && c.beneficiario_nombre !== filterVendedor) return false
                    if (search) {
                      const q = search.toLowerCase()
                      return (c.beneficiario_nombre || '').toLowerCase().includes(q) ||
                             (c.cliente_nombre || '').toLowerCase().includes(q) ||
                             (c.item_nombre || '').toLowerCase().includes(q)
                    }
                    return true
                  })
                  .map((c: any) => {
                    const saldo = (c.monto_comision_usd || 0) - (c.monto_pagado || 0)
                    return (
                      <tr key={c.id} className="border-t hover:bg-slate-50">
                        <td className="px-2 py-2 text-xs font-medium truncate max-w-[140px]">{c.item_nombre}</td>
                        <td className="px-2 py-2 text-xs">{c.beneficiario_nombre}</td>
                        <td className="px-2 py-2">
                          <Badge variant="outline" className="text-[10px]">{c.rol || 'closer'}</Badge>
                        </td>
                        <td className="px-2 py-2 text-xs truncate max-w-[120px]">{c.cliente_nombre}</td>
                        <td className="px-2 py-2 text-xs text-right">{c.item_cantidad}</td>
                        <td className="px-2 py-2 text-xs text-right">{new Intl.NumberFormat('es-CO').format(c.item_precio)}</td>
                        <td className="px-2 py-2 text-xs text-right">{formatCurrency(c.item_subtotal_usd || 0, 'USD')}</td>
                        <td className="px-2 py-2 text-xs text-right">{c.porcentaje}%</td>
                        <td className="px-2 py-2 text-xs text-right font-medium">{formatCurrency(c.monto_comision_usd || 0, 'USD')}</td>
                        <td className="px-2 py-2 text-xs text-right text-green-700">{formatCurrency(c.monto_pagado || 0, 'USD')}</td>
                        <td className="px-2 py-2 text-xs text-right font-medium">
                          {saldo > 0.01 ? <span className="text-amber-700">{formatCurrency(saldo, 'USD')}</span> : <span className="text-green-700">$0</span>}
                        </td>
                        <td className="px-2 py-2">
                          <Badge variant="outline" className={`text-[10px] ${STATUS_CONFIG[c.status]?.className || ''}`}>
                            {STATUS_CONFIG[c.status]?.label || c.status}
                          </Badge>
                        </td>
                        <td className="px-2 py-2">
                          {c.status === 'por_pagar' && (
                            <Button size="sm" variant="outline" className="h-6 text-[10px] text-green-700"
                              onClick={async () => {
                                try {
                                  await updateItemCommission(c.id, {
                                    monto_pagado: c.monto_comision_usd || 0,
                                    status: 'pagada',
                                    fecha_pago: payDate,
                                    pagado_por: userEmail,
                                  })
                                  toast({ title: 'Comision item pagada' })
                                  window.location.reload()
                                } catch { toast({ title: 'Error', variant: 'destructive' }) }
                              }}>
                              Pagar
                            </Button>
                          )}
                          {c.status === 'pagada' && (
                            <Button size="sm" variant="ghost" className="h-6 text-[10px] text-orange-600"
                              onClick={async () => {
                                try {
                                  await updateItemCommission(c.id, { status: 'por_pagar', fecha_pago: null, pagado_por: null, monto_pagado: 0 })
                                  toast({ title: 'Comision desmarcada' })
                                  window.location.reload()
                                } catch { toast({ title: 'Error', variant: 'destructive' }) }
                              }}>
                              <Undo2 className="h-3 w-3 mr-1" />
                              Desmarcar
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                {(itemCommissions || []).length === 0 && (
                  <tr><td colSpan={13} className="text-center py-8 text-muted-foreground text-sm">
                    Sin comisiones por item. Se crean al solicitar facturas con items configurados.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Filters */}
      {viewMode === 'vendedor' && <>
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
          <Select value={filterQuincena} onValueChange={setFilterQuincena}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Quincena" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {quincenas.map(q => <SelectItem key={q} value={q}>{q}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant={viewGrouped ? 'default' : 'outline'} size="sm" onClick={() => setViewGrouped(!viewGrouped)}>
            {viewGrouped ? 'Vista agrupada' : 'Vista plana'}
          </Button>
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
      {viewGrouped ? (() => {
        const groupedByInvoice = filtered.reduce((acc: Record<string, any>, c: any) => {
          const key = c.income_invoices?.numero_documento || c.income_invoice_id || c.cliente_nombre || c.id
          if (!acc[key]) acc[key] = {
            factura: c.income_invoices?.numero_documento || '\u2014',
            cliente: c.cliente_nombre,
            sociedad: c.sociedad,
            invoiceStatus: c.income_invoices?.estado,
            items: [],
            totalBase: 0,
            totalComision: 0,
            totalPagado: 0,
          }
          acc[key].items.push(c)
          acc[key].totalBase = Math.max(acc[key].totalBase, c.monto_base || 0)
          acc[key].totalComision += c.monto_comision_usd || 0
          acc[key].totalPagado += c.monto_pagado || 0
          return acc
        }, {})

        return (
          <div className="space-y-3">
            {Object.values(groupedByInvoice).map((group: any, gi: number) => (
              <Card key={gi} className="overflow-hidden">
                <div className="bg-slate-100 px-3 py-2 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold">{group.factura}</span>
                    <span className="text-xs text-muted-foreground">{group.cliente}</span>
                    <Badge variant="outline" className="text-[10px]">{group.sociedad}</Badge>
                    {group.invoiceStatus && <Badge variant="outline" className="text-[10px]">{group.invoiceStatus}</Badge>}
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span>Base: <strong>{formatCurrency(group.totalBase, 'USD')}</strong></span>
                    <span>{'Comisi\u00f3n'}: <strong>{formatCurrency(group.totalComision, 'USD')}</strong></span>
                    <span className="text-green-700">Pagado: {formatCurrency(group.totalPagado, 'USD')}</span>
                    <span className="text-amber-700">Saldo: {formatCurrency(group.totalComision - group.totalPagado, 'USD')}</span>
                  </div>
                </div>
                <table className="w-full text-xs">
                  <tbody>
                    {group.items.map((c: any) => {
                      const saldo = (c.monto_comision_usd || 0) - (c.monto_pagado || 0)
                      return (
                        <tr key={c.id} className="border-t hover:bg-slate-50">
                          <td className="px-3 py-1.5 font-medium w-32">{c.beneficiario_nombre}</td>
                          <td className="px-3 py-1.5">
                            <Badge variant="outline" className="text-[9px]">{c.rol || c.tipo}</Badge>
                          </td>
                          <td className="px-3 py-1.5 text-right">{c.porcentaje}%</td>
                          <td className="px-3 py-1.5 text-right">{formatCurrency(c.monto_comision_usd || 0, 'USD')}</td>
                          <td className="px-3 py-1.5 text-right text-green-700">{formatCurrency(c.monto_pagado || 0, 'USD')}</td>
                          <td className="px-3 py-1.5 text-right font-medium">
                            {saldo > 0.01 ? <span className="text-amber-700">{formatCurrency(saldo, 'USD')}</span> : <span className="text-green-700">$0</span>}
                          </td>
                          <td className="px-3 py-1.5">
                            <Badge variant="outline" className={`text-[9px] ${STATUS_CONFIG[c.status]?.className || ''}`}>
                              {STATUS_CONFIG[c.status]?.label || c.status}
                            </Badge>
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            {c.cuota_mes ? `${c.cuota_numero}. ${c.cuota_mes}` : ''}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                {/* Item-level commissions for this invoice */}
                {(() => {
                  const invoiceId = group.items[0]?.income_invoice_id
                  const relatedItemComms = invoiceId ? (itemCommissions || []).filter((ic: any) => ic.income_invoice_id === invoiceId) : []
                  if (relatedItemComms.length === 0) return null
                  return (
                    <div className="border-t bg-blue-50/50 px-3 py-2">
                      <p className="text-[10px] font-semibold text-blue-700 mb-1">Comisiones por Item</p>
                      <div className="space-y-0.5">
                        {relatedItemComms.map((ic: any) => (
                          <div key={ic.id} className="flex items-center justify-between text-[10px]">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{ic.item_nombre}</span>
                              <span className="text-muted-foreground">{ic.beneficiario_nombre} ({ic.rol})</span>
                              <span className="text-muted-foreground">{ic.porcentaje}%</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{formatCurrency(ic.monto_comision_usd || 0, 'USD')}</span>
                              <Badge variant="outline" className={`text-[8px] ${STATUS_CONFIG[ic.status]?.className || ''}`}>
                                {STATUS_CONFIG[ic.status]?.label || ic.status}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}
              </Card>
            ))}
          </div>
        )
      })() : (
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
              <th className="px-2 py-2 text-right text-xs">Pagado</th>
              <th className="px-2 py-2 text-right text-xs">Saldo</th>
              <th className="px-2 py-2 text-right text-xs">En {monedaPago}</th>
              <th className="px-2 py-2 text-left text-xs">Pago cliente</th>
              <th className="px-2 py-2 text-left text-xs">Quincena</th>
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
                  <td className="px-2 py-2 text-xs text-right text-green-700">
                    {formatCurrency(c.monto_pagado || 0, 'USD')}
                  </td>
                  <td className="px-2 py-2 text-xs text-right font-medium">
                    {(() => {
                      const saldo = (c.monto_comision_usd || 0) - (c.monto_pagado || 0)
                      return saldo > 0.01 ? (
                        <span className="text-amber-700">{formatCurrency(saldo, 'USD')}</span>
                      ) : (
                        <span className="text-green-700">$0</span>
                      )
                    })()}
                  </td>
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
                  <td className="px-2 py-2 text-[10px]">{c.quincena_corte || '—'}</td>
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
                      payingId === c.id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            step="0.01"
                            value={payAmount}
                            onChange={(e) => setPayAmount(e.target.value)}
                            placeholder="Monto"
                            className="h-6 text-[10px] w-20"
                          />
                          <Button size="sm" variant="outline" className="h-6 text-[10px] text-green-700"
                            disabled={paying}
                            onClick={async () => {
                              const amount = parseFloat(payAmount)
                              if (isNaN(amount) || amount <= 0) return
                              setPaying(true)
                              try {
                                const totalPagado = (c.monto_pagado || 0) + amount
                                const comisionTotal = c.monto_comision_usd || 0
                                const fullyPaid = totalPagado >= comisionTotal - 0.01

                                await updateCommission(c.id, {
                                  monto_pagado: totalPagado,
                                  status: fullyPaid ? 'pagada' : 'por_pagar',
                                  fecha_pago: fullyPaid ? payDate : null,
                                  pagado_por: fullyPaid ? userEmail : null,
                                })
                                toast({ title: fullyPaid ? 'Comision pagada completa' : `Abono registrado: ${formatCurrency(amount, 'USD')}` })
                                window.location.reload()
                              } catch { toast({ title: 'Error', variant: 'destructive' }) }
                              finally { setPaying(false) }
                            }}
                          >OK</Button>
                          <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setPayingId(null)}>X</Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" className="h-6 text-[10px] text-green-700"
                          onClick={() => {
                            setPayingId(c.id)
                            const saldo = (c.monto_comision_usd || 0) - (c.monto_pagado || 0)
                            setPayAmount(String(Math.round(saldo * 100) / 100))
                          }}>
                          Pagar
                        </Button>
                      )
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
              <tr><td colSpan={17} className="text-center py-8 text-muted-foreground text-sm">Sin comisiones</td></tr>
            )}
          </tbody>
        </table>
      </div>
      )}
      </>}

      {/* Add commission dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Agregar comision a factura</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium">N° Factura</label>
              <Input placeholder="Ej: FVE2519" value={addFactura} onChange={(e) => setAddFactura(e.target.value)} className="h-8 text-sm mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium">Vendedor</label>
              <Select value={addVendedor} onValueChange={setAddVendedor}>
                <SelectTrigger className="h-8 text-sm mt-1"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {vendedores.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">Rol</label>
                <Select value={addRol} onValueChange={setAddRol}>
                  <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="closer">Closer</SelectItem>
                    <SelectItem value="support">Support</SelectItem>
                    <SelectItem value="aliado">Aliado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium">% Comision</label>
                <Input type="number" min="0" max="100" step="0.5" value={addPorcentaje} onChange={(e) => setAddPorcentaje(e.target.value)} className="h-8 text-sm mt-1" />
              </div>
            </div>
            <Button className="w-full" disabled={!addFactura || !addVendedor} onClick={async () => {
              const match = commissions.find((c: any) => c.income_invoices?.numero_documento === addFactura)
              if (!match) {
                toast({ title: 'Factura no encontrada', variant: 'destructive' })
                return
              }
              const pct = parseFloat(addPorcentaje) || 5
              try {
                await createManualCommission({
                  income_invoice_id: match.income_invoice_id || undefined,
                  beneficiario_nombre: addVendedor,
                  tipo: addRol === 'aliado' ? 'aliado' : 'vendedor',
                  porcentaje: pct,
                  monto_base: match.monto_base || 0,
                  sociedad: match.sociedad || undefined,
                  cliente_nombre: match.cliente_nombre || undefined,
                  rol: addRol,
                })
                toast({ title: 'Comision agregada' })
                setShowAddDialog(false)
                setAddFactura('')
                setAddVendedor('')
                setAddPorcentaje('5')
                setAddRol('closer')
                window.location.reload()
              } catch (e) {
                toast({ title: 'Error', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' })
              }
            }}>
              Agregar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
