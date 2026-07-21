// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useMemo } from 'react'
import { PageHeader } from '@/components/shared/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { DollarSign, CheckCircle, Clock, AlertCircle, Loader2, Undo2, Plus, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react'
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ComisionesClient({ commissions, summary, itemCommissions = [], itemSummary, userEmail, initialSearch = '' }: Props) {
  const { toast } = useToast()
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterVendedor, setFilterVendedor] = useState<string>('all')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  const [addCliente, setAddCliente] = useState('')
  const [addMontoBase, setAddMontoBase] = useState('')
  const [addSociedad, setAddSociedad] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  // Calculate local currency amount for a commission
  const calcLocal = (c: any) => {
    const inv = c.income_invoices
    const monedaFactura = inv?.moneda || c.item_moneda || 'USD'
    const comUsd = Number(c.monto_comision_usd) || 0
    if (monedaFactura === 'USD') return { moneda: 'USD', local: comUsd, rate: 1 }
    // Calculate rate from invoice totals
    const totalLocal = Number(inv?.total_moneda_local) || 0
    const totalUsd = Number(inv?.total_usd) || 0
    if (totalLocal > 0 && totalUsd > 0) {
      const rate = totalLocal / totalUsd
      return { moneda: monedaFactura, local: Math.round(comUsd * rate * 100) / 100, rate }
    }
    // Fallback rates
    const fb: Record<string, number> = { COP: 4150, MXN: 17, BRL: 5, PEN: 3.7, EUR: 0.92 }
    const rate = fb[monedaFactura] || 1
    return { moneda: monedaFactura, local: Math.round(comUsd * rate * 100) / 100, rate }
  }

  // Merge both commission sources into unified list with local currency
  const allCommissions = useMemo(() => {
    const legacy = commissions.map(c => {
      const lc = calcLocal(c)
      const pagadoLocal = Math.round((c.monto_pagado || 0) * lc.rate * 100) / 100
      return { ...c, _source: 'legacy', _itemName: null, _monedaLocal: lc.moneda, _comisionLocal: lc.local, _baseLocal: Math.round((c.monto_base || 0) * lc.rate * 100) / 100, _pagadoLocal: pagadoLocal, _saldoLocal: Math.round((lc.local - pagadoLocal) * 100) / 100, _rate: lc.rate }
    })
    const items = (itemCommissions || []).map(c => {
      const moneda = c.item_moneda || 'USD'
      const comLocal = c.monto_comision_local || c.monto_comision || 0
      const pagadoLocal = c.monto_pagado || 0 // item commissions pagado is in USD, approximate
      return {
        ...c,
        _source: 'item',
        _itemName: c.item_nombre,
        monto_base: c.item_subtotal_usd || c.monto_base,
        _monedaLocal: moneda,
        _comisionLocal: comLocal,
        _baseLocal: c.item_subtotal || 0,
        _pagadoLocal: pagadoLocal,
        _saldoLocal: comLocal - pagadoLocal,
        _rate: 1,
      }
    })
    return [...legacy, ...items]
  }, [commissions, itemCommissions])

  // Combine summaries — all in local currency per commission
  const combinedTotals = useMemo(() => {
    let pendiente = 0, por_pagar = 0, pagada = 0
    for (const c of allCommissions) {
      const local = Number(c._comisionLocal) || 0
      // Convert to monedaPago for aggregation
      const inPago = c._monedaLocal === monedaPago ? local :
        (c._monedaLocal === 'USD' ? local * (FALLBACK_RATES[monedaPago] || 1) :
         local / (FALLBACK_RATES[c._monedaLocal] || 1) * (FALLBACK_RATES[monedaPago] || 1))
      if (c.status === 'pendiente') pendiente += inPago
      else if (c.status === 'por_pagar') por_pagar += inPago
      else if (c.status === 'pagada') pagada += inPago
    }
    return { pendiente, por_pagar, pagada }
  }, [allCommissions, monedaPago])

  // Combined vendedores
  const allVendedores = useMemo(() => {
    const names = new Set<string>()
    for (const c of allCommissions) if (c.beneficiario_nombre) names.add(c.beneficiario_nombre)
    return Array.from(names).sort()
  }, [allCommissions])

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const quincenas = [...new Set(commissions.map(c => c.quincena_corte).filter(Boolean))].sort().reverse()

  // Filter
  const filtered = allCommissions.filter(c => {
    if (filterStatus !== 'all' && c.status !== filterStatus) return false
    if (filterVendedor !== 'all' && c.beneficiario_nombre !== filterVendedor) return false
    if (filterQuincena !== 'all' && (c.quincena_corte || '') !== filterQuincena) return false
    if (filterFechaDesde && c.fecha_pago) {
      if (c.fecha_pago.substring(0, 10) < filterFechaDesde) return false
    }
    if (filterFechaHasta && c.fecha_pago) {
      if (c.fecha_pago.substring(0, 10) > filterFechaHasta) return false
    }
    if (search) {
      const q = search.toLowerCase()
      return (c.beneficiario_nombre || '').toLowerCase().includes(q) ||
             (c.cliente_nombre || '').toLowerCase().includes(q) ||
             (c._itemName || '').toLowerCase().includes(q) ||
             (c.income_invoices?.numero_documento || '').toLowerCase().includes(q)
    }
    return true
  })

  // Group by invoice/client for grouped view
  const grouped = useMemo(() => {
    const groups: Record<string, { key: string; factura: string; cliente: string; sociedad: string; invoiceStatus: string; monedaLocal: string; items: any[]; totalComision: number; totalComisionLocal: number; totalPagado: number; totalBase: number }> = {}
    for (const c of filtered) {
      const key = c.income_invoice_id || c.cliente_nombre || c.id
      if (!groups[key]) {
        groups[key] = {
          key,
          factura: c.income_invoices?.numero_documento || '—',
          cliente: c.cliente_nombre || '—',
          sociedad: c.sociedad || '',
          invoiceStatus: c.income_invoices?.estado || '',
          monedaLocal: c._monedaLocal || 'USD',
          items: [],
          totalComision: 0,
          totalComisionLocal: 0,
          totalPagado: 0,
          totalBase: 0,
        }
      }
      groups[key].items.push(c)
      groups[key].totalComision += c.monto_comision_usd || 0
      groups[key].totalComisionLocal += c._comisionLocal || 0
      groups[key].totalPagado += c.monto_pagado || 0
      groups[key].totalBase = Math.max(groups[key].totalBase, c.monto_base || 0)
    }
    return Object.values(groups).sort((a, b) => (b.totalComision - b.totalPagado) - (a.totalComision - a.totalPagado))
  }, [filtered])

  // Combined per-vendedor summary
  // Convert local amount to monedaPago
  const toMonedaPago = (amount: number, fromMoneda: string) => {
    if (fromMoneda === monedaPago) return amount
    // Convert to USD first, then to monedaPago
    const usd = fromMoneda === 'USD' ? amount : amount / (FALLBACK_RATES[fromMoneda] || 1)
    return monedaPago === 'USD' ? usd : usd * (FALLBACK_RATES[monedaPago] || 1)
  }

  const vendedorSummary = useMemo(() => {
    const byV: Record<string, { pendiente: number; por_pagar: number; pagada: number; total: number }> = {}
    for (const c of allCommissions) {
      const name = c.beneficiario_nombre || 'Desconocido'
      const local = Number(c._comisionLocal) || 0
      const inPago = toMonedaPago(local, c._monedaLocal)
      if (!byV[name]) byV[name] = { pendiente: 0, por_pagar: 0, pagada: 0, total: 0 }
      byV[name].total += inPago
      if (c.status === 'pendiente') byV[name].pendiente += inPago
      else if (c.status === 'por_pagar') byV[name].por_pagar += inPago
      else if (c.status === 'pagada') byV[name].pagada += inPago
    }
    return byV
  }, [allCommissions, monedaPago])

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSelectedIds(next)
  }

  const selectedTotal = [...selectedIds].reduce((sum, id) => {
    const c = allCommissions.find(x => x.id === id)
    return sum + (c?.monto_comision_usd || 0)
  }, 0)
  const rate = FALLBACK_RATES[monedaPago] || 1
  const selectedTotalInPayCurrency = monedaPago === 'USD' ? selectedTotal : selectedTotal * rate

  const handlePaySingle = async (c: any, amount: number) => {
    setPaying(true)
    try {
      const totalPagado = (c.monto_pagado || 0) + amount
      const fullyPaid = totalPagado >= (c.monto_comision_usd || 0) - 0.01
      const updateFn = c._source === 'item' ? updateItemCommission : updateCommission
      await updateFn(c.id, {
        monto_pagado: totalPagado,
        status: fullyPaid ? 'pagada' : 'por_pagar',
        fecha_pago: fullyPaid ? payDate : null,
        pagado_por: fullyPaid ? userEmail : null,
      })
      toast({ title: fullyPaid ? 'Comision pagada' : `Abono: ${formatCurrency(amount, 'USD')}` })
      window.location.reload()
    } catch { toast({ title: 'Error', variant: 'destructive' }) }
    finally { setPaying(false) }
  }

  const handleUnpay = async (c: any) => {
    setPaying(true)
    try {
      const updateFn = c._source === 'item' ? updateItemCommission : updateCommission
      await updateFn(c.id, { status: 'por_pagar', fecha_pago: null, pagado_por: null, monto_pagado: 0 })
      toast({ title: 'Comision desmarcada' })
      window.location.reload()
    } catch { toast({ title: 'Error', variant: 'destructive' }) }
    finally { setPaying(false) }
  }

  const handleBulkPay = async () => {
    const porPagar = [...selectedIds].filter(id => {
      const c = allCommissions.find(x => x.id === id)
      return c?.status === 'por_pagar'
    })
    if (porPagar.length === 0) { toast({ title: 'Selecciona comisiones "Por pagar"', variant: 'destructive' }); return }
    setPaying(true)
    try {
      for (const id of porPagar) {
        const c = allCommissions.find(x => x.id === id)
        if (!c) continue
        const updateFn = c._source === 'item' ? updateItemCommission : updateCommission
        await updateFn(id, { monto_pagado: c.monto_comision_usd || 0, status: 'pagada', fecha_pago: payDate, pagado_por: userEmail })
      }
      toast({ title: `${porPagar.length} comisiones pagadas` })
      window.location.reload()
    } catch { toast({ title: 'Error', variant: 'destructive' }) }
    finally { setPaying(false) }
  }

  const toggleGroup = (key: string) => {
    const next = new Set(expandedGroups)
    if (next.has(key)) next.delete(key); else next.add(key)
    setExpandedGroups(next)
  }

  // Filtered totals per vendedor (what to pay) — in monedaPago
  const filteredVendedorTotals = useMemo(() => {
    const byV: Record<string, { porPagar: number; pendiente: number; total: number }> = {}
    for (const c of filtered) {
      const name = c.beneficiario_nombre || 'Desconocido'
      const saldoLocal = c._saldoLocal || 0
      const saldoInPago = toMonedaPago(saldoLocal, c._monedaLocal)
      if (!byV[name]) byV[name] = { porPagar: 0, pendiente: 0, total: 0 }
      byV[name].total += saldoInPago > 0.5 ? saldoInPago : 0
      if (c.status === 'por_pagar') byV[name].porPagar += saldoInPago > 0.5 ? saldoInPago : 0
      if (c.status === 'pendiente') byV[name].pendiente += saldoInPago > 0.5 ? saldoInPago : 0
    }
    return byV
  }, [filtered, monedaPago])

  // Commission row renderer
  const renderCommissionRow = (c: any, compact = false) => {
    const saldoLocal = c._saldoLocal || 0
    const saldoInPago = toMonedaPago(saldoLocal, c._monedaLocal)
    const updateFn = c._source === 'item' ? updateItemCommission : updateCommission

    return (
      <tr key={c.id} className="border-t hover:bg-slate-50 text-xs">
        <td className="px-2 py-1.5">
          {(c.status === 'por_pagar' || c.status === 'pagada') && (
            <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)} />
          )}
        </td>
        <td className="px-2 py-1.5">
          <select
            className="text-xs border rounded px-1 py-0.5 bg-transparent font-medium cursor-pointer hover:bg-slate-100 w-full max-w-[130px]"
            value={c.beneficiario_nombre || ''}
            onChange={async (e) => {
              if (!e.target.value || e.target.value === c.beneficiario_nombre) return
              try {
                await updateFn(c.id, { beneficiario_nombre: e.target.value })
                toast({ title: `Vendedor: ${e.target.value}` })
                window.location.reload()
              } catch { toast({ title: 'Error', variant: 'destructive' }) }
            }}
          >
            {!c.beneficiario_nombre && <option value="">Asignar...</option>}
            {allVendedores.map(v => <option key={v} value={v}>{v}</option>)}
            {c.beneficiario_nombre && !allVendedores.includes(c.beneficiario_nombre) && (
              <option value={c.beneficiario_nombre}>{c.beneficiario_nombre}</option>
            )}
          </select>
        </td>
        <td className="px-2 py-1.5">
          <Badge variant="outline" className="text-[9px]">{c.rol || c.tipo || 'vendedor'}</Badge>
        </td>
        <td className="px-2 py-1.5 truncate max-w-[120px]">
          {c._itemName ? <span className="text-blue-600 font-medium">{c._itemName}</span> : <span className="text-muted-foreground">—</span>}
        </td>
        {!compact && <td className="px-2 py-1.5 truncate max-w-[120px]">{c.cliente_nombre || '—'}</td>}
        {!compact && <td className="px-2 py-1.5">{c.income_invoices?.numero_documento || c.cuota_mes || '—'}</td>}
        <td className="px-2 py-1.5 text-right">
          <Input
            type="number" min="0" max="100" step="0.5" value={c.porcentaje}
            onChange={async (e) => {
              const newPct = parseFloat(e.target.value)
              if (isNaN(newPct)) return
              const newComision = (c.monto_base || 0) * (newPct / 100)
              try {
                await updateFn(c.id, { porcentaje: newPct, monto_comision: newComision, monto_comision_usd: newComision })
                toast({ title: `${newPct}%` })
                window.location.reload()
              } catch { toast({ title: 'Error', variant: 'destructive' }) }
            }}
            className="h-5 text-[10px] w-14 text-right"
          />
        </td>
        <td className="px-2 py-1.5 text-right text-[10px]">
          {new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(c._baseLocal || 0)} {c._monedaLocal}
        </td>
        <td className="px-2 py-1.5 text-right font-medium text-[10px]">
          {new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(c._comisionLocal || 0)} {c._monedaLocal}
        </td>
        <td className="px-2 py-1.5 text-right text-green-700 text-[10px]">
          {new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(c._pagadoLocal || 0)} {c._monedaLocal}
        </td>
        <td className="px-2 py-1.5 text-right font-medium text-[10px]">
          {saldoLocal > 0.5 ? <span className="text-amber-700">{new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(saldoLocal)} {c._monedaLocal}</span> : <span className="text-green-700">0</span>}
        </td>
        <td className="px-2 py-1.5 text-right text-[10px]">
          {monedaPago !== c._monedaLocal
            ? <span>{new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(saldoInPago)} {monedaPago}</span>
            : '—'}
        </td>
        <td className="px-2 py-1.5">
          <Badge variant="outline" className={`text-[9px] ${STATUS_CONFIG[c.status]?.className || ''}`}>
            {STATUS_CONFIG[c.status]?.label || c.status}
          </Badge>
        </td>
        <td className="px-2 py-1.5 whitespace-nowrap">
          {c.status === 'por_pagar' && (
            payingId === c.id ? (
              <div className="flex items-center gap-1">
                <Input type="number" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="h-5 text-[10px] w-16" />
                <Button size="sm" variant="outline" className="h-5 text-[10px] text-green-700" disabled={paying}
                  onClick={() => { const amt = parseFloat(payAmount); if (amt > 0) handlePaySingle(c, amt) }}>OK</Button>
                <Button size="sm" variant="ghost" className="h-5 text-[10px]" onClick={() => setPayingId(null)}>X</Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" className="h-5 text-[10px] text-green-700"
                onClick={() => { setPayingId(c.id); setPayAmount(String(Math.round(saldo * 100) / 100)) }}>
                Pagar
              </Button>
            )
          )}
          {c.status === 'pagada' && (
            <Button size="sm" variant="ghost" className="h-5 text-[10px] text-orange-600" onClick={() => handleUnpay(c)} disabled={paying}>
              <Undo2 className="h-3 w-3 mr-0.5" /> Desmarcar
            </Button>
          )}
        </td>
      </tr>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Comisiones" description={`${allCommissions.length} comisiones (${commissions.length} legacy + ${itemCommissions.length} por item)`} />
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={syncing} onClick={async () => {
            setSyncing(true)
            try {
              await syncCommissionStatuses()
              await syncItemCommissionStatuses().catch(console.error)
              toast({ title: 'Estados sincronizados' })
              window.location.reload()
            } catch { toast({ title: 'Error al sincronizar', variant: 'destructive' }) }
            finally { setSyncing(false) }
          }}>
            {syncing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
            Sincronizar
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowAddDialog(true)}>
            <Plus className="h-3 w-3 mr-1" /> Agregar
          </Button>
        </div>
      </div>

      {/* Currency selector - prominent */}
      <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-3">
        <span className="text-sm font-medium">Ver comisiones en:</span>
        <Select value={monedaPago} onValueChange={setMonedaPago}>
          <SelectTrigger className="w-[120px] h-9 font-semibold"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MONEDAS_PAGO.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">Todos los montos se convierten a la moneda seleccionada</span>
      </div>

      {/* Summary Cards — shown in selected monedaPago */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-gray-500" /><p className="text-xs text-muted-foreground">Pendiente</p></div>
            <p className="text-xl font-bold mt-1">{new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(combinedTotals.pendiente)} <span className="text-sm font-normal text-muted-foreground">{monedaPago}</span></p>
          </CardContent>
        </Card>
        <Card className="border-yellow-200">
          <CardContent className="py-4">
            <div className="flex items-center gap-2"><AlertCircle className="h-4 w-4 text-yellow-600" /><p className="text-xs text-muted-foreground">Por pagar</p></div>
            <p className="text-xl font-bold text-yellow-700 mt-1">{new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(combinedTotals.por_pagar)} <span className="text-sm font-normal text-muted-foreground">{monedaPago}</span></p>
          </CardContent>
        </Card>
        <Card className="border-green-200">
          <CardContent className="py-4">
            <div className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-600" /><p className="text-xs text-muted-foreground">Pagada</p></div>
            <p className="text-xl font-bold text-green-700 mt-1">{new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(combinedTotals.pagada)} <span className="text-sm font-normal text-muted-foreground">{monedaPago}</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-2"><DollarSign className="h-4 w-4" /><p className="text-xs text-muted-foreground">Total</p></div>
            <p className="text-xl font-bold mt-1">{new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(combinedTotals.pendiente + combinedTotals.por_pagar + combinedTotals.pagada)} <span className="text-sm font-normal text-muted-foreground">{monedaPago}</span></p>
          </CardContent>
        </Card>
      </div>

      {/* Per vendedor cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {Object.entries(vendedorSummary).sort(([,a], [,b]) => b.total - a.total).map(([name, data]) => (
          <Card key={name} className="p-3 cursor-pointer hover:bg-slate-50" onClick={() => setFilterVendedor(filterVendedor === name ? 'all' : name)}>
            <p className={`text-sm font-semibold ${filterVendedor === name ? 'text-blue-600' : ''}`}>{name}</p>
            <div className="grid grid-cols-3 gap-1 mt-2 text-xs">
              <div><p className="text-muted-foreground">Pend.</p><p className="font-medium">{new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(data.pendiente)}</p></div>
              <div><p className="text-muted-foreground">x Pagar</p><p className="font-medium text-yellow-700">{new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(data.por_pagar)}</p></div>
              <div><p className="text-muted-foreground">Pagada</p><p className="font-medium text-green-700">{new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(data.pagada)}</p></div>
            </div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          <Input placeholder="Buscar vendedor, cliente, item, factura..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pendiente">Pendiente</SelectItem>
              <SelectItem value="por_pagar">Por pagar</SelectItem>
              <SelectItem value="pagada">Pagada</SelectItem>
              <SelectItem value="anulada">Anulada</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterVendedor} onValueChange={setFilterVendedor}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Vendedor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {allVendedores.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={monedaPago} onValueChange={setMonedaPago}>
            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONEDAS_PAGO.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Desde:</span>
            <Input type="date" value={filterFechaDesde} onChange={(e) => setFilterFechaDesde(e.target.value)} className="w-36 h-8" />
            <span>Hasta:</span>
            <Input type="date" value={filterFechaHasta} onChange={(e) => setFilterFechaHasta(e.target.value)} className="w-36 h-8" />
          </div>
          <span className="text-xs text-muted-foreground">{filtered.length} resultados</span>
        </div>
      </div>

      {/* Filtered totals per vendedor - what to pay */}
      {Object.keys(filteredVendedorTotals).length > 0 && (
        <Card className="border-slate-200">
          <CardContent className="py-3">
            <p className="text-xs font-semibold mb-2">Resumen filtrado — Saldo por vendedor</p>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {Object.entries(filteredVendedorTotals)
                .filter(([, d]) => d.total > 0.01)
                .sort(([, a], [, b]) => b.total - a.total)
                .map(([name, data]) => (
                <div key={name} className="bg-slate-50 rounded p-2">
                  <p className="text-xs font-medium truncate">{name}</p>
                  <div className="flex justify-between items-baseline mt-1">
                    <span className="text-sm font-bold">{new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(data.total)} {monedaPago}</span>
                  </div>
                  <div className="flex gap-2 text-[10px] mt-0.5">
                    {data.porPagar > 0.5 && <span className="text-yellow-700">x Pagar: {new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(data.porPagar)}</span>}
                    {data.pendiente > 0.5 && <span className="text-gray-500">Pend: {new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(data.pendiente)}</span>}
                  </div>
                </div>
              ))}
            </div>
            {/* Grand total of filtered */}
            <div className="flex justify-between items-center mt-3 pt-2 border-t text-sm">
              <span className="font-semibold">Total saldo filtrado</span>
              <span className="font-bold">{new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(Object.values(filteredVendedorTotals).reduce((s, d) => s + d.total, 0))} {monedaPago}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bulk pay bar */}
      {selectedIds.size > 0 && (
        <Card className="border-green-300 bg-green-50">
          <CardContent className="py-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium">{selectedIds.size} seleccionadas</span>
              <span className="text-sm">Total USD: <strong>{formatCurrency(selectedTotal, 'USD')}</strong></span>
              {monedaPago !== 'USD' && <span className="text-sm">En {monedaPago}: <strong>{new Intl.NumberFormat('es-CO').format(selectedTotalInPayCurrency)}</strong></span>}
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

      {/* Grouped view by invoice */}
      <div className="space-y-2">
        {grouped.map((group) => {
          const isExpanded = expandedGroups.has(group.key)
          const hasItems = group.items.some((c: any) => c._itemName)

          return (
            <Card key={group.key} className="overflow-hidden">
              {/* Group header */}
              <button
                type="button"
                className="w-full bg-slate-50 hover:bg-slate-100 px-3 py-2 flex justify-between items-center text-left"
                onClick={() => toggleGroup(group.key)}
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <span className="text-xs font-bold">{group.factura}</span>
                  <span className="text-xs text-muted-foreground truncate max-w-[200px]">{group.cliente}</span>
                  <Badge variant="outline" className="text-[10px]">{group.sociedad}</Badge>
                  {group.invoiceStatus && <Badge variant="outline" className="text-[10px]">{group.invoiceStatus}</Badge>}
                  {hasItems && <Badge className="bg-blue-100 text-blue-800 text-[9px]">Items</Badge>}
                  <span className="text-[10px] text-muted-foreground">{group.items.length} comision{group.items.length !== 1 ? 'es' : ''}</span>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span>Comision: <strong>{new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(group.totalComisionLocal)} {group.monedaLocal}</strong></span>
                  <span className="text-green-700">Pagado: {new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(group.items.reduce((s: number, c: any) => s + (c._pagadoLocal || 0), 0))} {group.monedaLocal}</span>
                  {(() => {
                    const saldoLocal = group.totalComisionLocal - group.items.reduce((s: number, c: any) => s + (c._pagadoLocal || 0), 0)
                    return saldoLocal > 0.5 ? <span className="text-amber-700 font-bold">Saldo: {new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(saldoLocal)} {group.monedaLocal}</span> : null
                  })()}
                  {monedaPago !== group.monedaLocal && (
                    <span className="text-muted-foreground">({new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(toMonedaPago(group.totalComisionLocal, group.monedaLocal))} {monedaPago})</span>
                  )}
                </div>
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50/50">
                      <tr className="text-[10px] text-muted-foreground">
                        <th className="px-2 py-1 w-8"></th>
                        <th className="px-2 py-1 text-left">Vendedor</th>
                        <th className="px-2 py-1 text-left">Rol</th>
                        <th className="px-2 py-1 text-left">Item</th>
                        <th className="px-2 py-1 text-right">%</th>
                        <th className="px-2 py-1 text-right">Base</th>
                        <th className="px-2 py-1 text-right">Comision</th>
                        <th className="px-2 py-1 text-right">Pagado</th>
                        <th className="px-2 py-1 text-right">Saldo</th>
                        <th className="px-2 py-1 text-right">En {monedaPago}</th>
                        <th className="px-2 py-1 text-left">Estado</th>
                        <th className="px-2 py-1"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((c: any) => renderCommissionRow(c, true))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )
        })}
        {grouped.length === 0 && (
          <p className="text-center py-8 text-muted-foreground text-sm">Sin comisiones con los filtros actuales</p>
        )}
      </div>

      {/* Add commission dialog - full form */}
      <Dialog open={showAddDialog} onOpenChange={(open) => {
        setShowAddDialog(open)
        if (!open) { setAddFactura(''); setAddVendedor(''); setAddPorcentaje('5'); setAddRol('closer'); setAddCliente(''); setAddMontoBase(''); setAddSociedad('') }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Crear Comision</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium">N° Factura (opcional — buscar existente)</label>
              <Input placeholder="Ej: FVE2519" value={addFactura} onChange={(e) => {
                setAddFactura(e.target.value)
                // Auto-fill from matching invoice
                const match = commissions.find((c: any) => c.income_invoices?.numero_documento === e.target.value)
                if (match) {
                  setAddCliente(match.cliente_nombre || '')
                  setAddMontoBase(String(match.monto_base || 0))
                  setAddSociedad(match.sociedad || '')
                }
              }} className="h-8 text-sm mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">Cliente *</label>
                <Input placeholder="Nombre cliente" value={addCliente} onChange={(e) => setAddCliente(e.target.value)} className="h-8 text-sm mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium">Sociedad</label>
                <Select value={addSociedad} onValueChange={setAddSociedad}>
                  <SelectTrigger className="h-8 text-sm mt-1"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hackÜ SAS">hackÜ SAS</SelectItem>
                    <SelectItem value="hackÜ LLC">hackÜ LLC</SelectItem>
                    <SelectItem value="hackÜ MEX">hackÜ MEX</SelectItem>
                    <SelectItem value="hackÜ PER">hackÜ PER</SelectItem>
                    <SelectItem value="hackÜ BRA">hackÜ BRA</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium">Monto Base (USD) *</label>
              <Input type="number" min="0" step="0.01" placeholder="Ej: 5000" value={addMontoBase} onChange={(e) => setAddMontoBase(e.target.value)} className="h-8 text-sm mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium">Vendedor / Beneficiario *</label>
              <Select value={addVendedor} onValueChange={setAddVendedor}>
                <SelectTrigger className="h-8 text-sm mt-1"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {allVendedores.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
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
            {/* Preview */}
            {addMontoBase && addPorcentaje && (
              <div className="bg-slate-50 rounded p-2 text-xs">
                <span className="text-muted-foreground">Comision: </span>
                <span className="font-bold">{formatCurrency((parseFloat(addMontoBase) || 0) * ((parseFloat(addPorcentaje) || 0) / 100), 'USD')}</span>
              </div>
            )}
            <Button className="w-full" disabled={!addVendedor || !addMontoBase || !addCliente} onClick={async () => {
              const base = parseFloat(addMontoBase) || 0
              if (base <= 0) { toast({ title: 'Monto base debe ser mayor a 0', variant: 'destructive' }); return }
              // Try to find matching invoice
              const match = commissions.find((c: any) => c.income_invoices?.numero_documento === addFactura)
              try {
                await createManualCommission({
                  income_invoice_id: match?.income_invoice_id || undefined,
                  beneficiario_nombre: addVendedor,
                  tipo: addRol === 'aliado' ? 'aliado' : 'vendedor',
                  porcentaje: parseFloat(addPorcentaje) || 5,
                  monto_base: base,
                  sociedad: addSociedad || undefined,
                  cliente_nombre: addCliente || undefined,
                  rol: addRol,
                  numero_documento: addFactura || undefined,
                })
                toast({ title: 'Comision creada' })
                setShowAddDialog(false)
                window.location.reload()
              } catch (e) {
                toast({ title: 'Error', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' })
              }
            }}>Crear Comision</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
