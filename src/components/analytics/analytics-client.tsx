// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/shared/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d']

const formatUSD = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)

interface AnalyticsClientProps {
  requests: any[]
}

export function AnalyticsClient({ requests }: AnalyticsClientProps) {
  // Extract unique values for filters
  const sociedades = useMemo(
    () => [...new Set(requests.map((r) => r.sociedad).filter(Boolean))].sort(),
    [requests]
  )
  const vendedores = useMemo(
    () => [...new Set(requests.map((r) => r.vendedor_nombre).filter(Boolean))].sort(),
    [requests]
  )

  // Derive min/max months from data
  const months = useMemo(() => {
    const set = new Set<string>()
    for (const r of requests) {
      if (r.fecha_emision) {
        const d = r.fecha_emision.slice(0, 7) // "YYYY-MM"
        set.add(d)
      }
    }
    return [...set].sort()
  }, [requests])

  // Filter state
  const [mesDesde, setMesDesde] = useState('')
  const [mesHasta, setMesHasta] = useState('')
  const [sociedad, setSociedad] = useState('')
  const [vendedor, setVendedor] = useState('')

  // Filtered requests
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      if (sociedad && r.sociedad !== sociedad) return false
      if (vendedor && r.vendedor_nombre !== vendedor) return false
      if (mesDesde && r.fecha_emision) {
        const m = r.fecha_emision.slice(0, 7)
        if (m < mesDesde) return false
      }
      if (mesHasta && r.fecha_emision) {
        const m = r.fecha_emision.slice(0, 7)
        if (m > mesHasta) return false
      }
      return true
    })
  }, [requests, sociedad, vendedor, mesDesde, mesHasta])

  // Extract and compute all items
  const { itemStats, sociedadRevenue, clientRevenue } = useMemo(() => {
    const allItems: Array<{
      name: string
      quantity: number
      price: number
      revenue: number
      sociedad: string
      vendedor: string
      fecha: string
      cliente: string
    }> = []

    for (const req of filteredRequests) {
      const items = req.items || []
      for (const item of items) {
        const qty = item.quantity || 0
        const price = item.price || 0
        const discount = item.discount || 0
        const subtotal = qty * price * (1 - discount / 100)
        const usdRate =
          req.moneda === 'COP' ? 4150 : req.moneda === 'MXN' ? 17 : req.moneda === 'BRL' ? 5 : 1
        const revenueUSD = req.moneda === 'USD' ? subtotal : subtotal / usdRate

        allItems.push({
          name: item.name || item.alegra_item_id || 'Sin nombre',
          quantity: qty,
          price,
          revenue: revenueUSD,
          sociedad: req.sociedad,
          vendedor: req.vendedor_nombre || 'Sin vendedor',
          fecha: req.fecha_emision,
          cliente: req.alegra_client_name || '',
        })
      }
    }

    // Aggregate by item name
    const itemStats = Object.values(
      allItems.reduce(
        (acc, item) => {
          if (!acc[item.name])
            acc[item.name] = { name: item.name, count: 0, totalQty: 0, totalRevenue: 0, avgPrice: 0 }
          acc[item.name].count++
          acc[item.name].totalQty += item.quantity
          acc[item.name].totalRevenue += item.revenue
          return acc
        },
        {} as Record<string, any>
      )
    )
      .map((s: any) => ({ ...s, avgPrice: s.totalQty > 0 ? s.totalRevenue / s.totalQty : 0 }))
      .sort((a: any, b: any) => b.totalRevenue - a.totalRevenue)

    // Aggregate by sociedad
    const sociedadRevenue = Object.values(
      allItems.reduce(
        (acc, item) => {
          const key = item.sociedad || 'Sin sociedad'
          if (!acc[key]) acc[key] = { name: key, value: 0 }
          acc[key].value += item.revenue
          return acc
        },
        {} as Record<string, any>
      )
    ).sort((a: any, b: any) => b.value - a.value)

    // Aggregate by client
    const clientRevenue = Object.values(
      allItems.reduce(
        (acc, item) => {
          const key = item.cliente || 'Sin cliente'
          if (!acc[key]) acc[key] = { name: key, totalRevenue: 0, count: 0 }
          acc[key].totalRevenue += item.revenue
          acc[key].count++
          return acc
        },
        {} as Record<string, any>
      )
    ).sort((a: any, b: any) => b.totalRevenue - a.totalRevenue)

    return { itemStats, sociedadRevenue, clientRevenue }
  }, [filteredRequests])

  const top10Revenue = itemStats.slice(0, 10)
  const top10Qty = [...itemStats].sort((a: any, b: any) => b.totalQty - a.totalQty).slice(0, 10)
  const top20Clients = clientRevenue.slice(0, 20)

  const totalRevenue = itemStats.reduce((sum: number, s: any) => sum + s.totalRevenue, 0)
  const totalItems = itemStats.reduce((sum: number, s: any) => sum + s.totalQty, 0)

  // The 11 allowed Alegra items
  const CLASSIFIED_ITEMS = [
    { id: '49', name: 'Licencias PRO' },
    { id: '1', name: 'Panel administrativo: Dashboard' },
    { id: '3', name: 'Linea personalizada de WhatsApp' },
    { id: '20', name: 'Licencias Starter' },
    { id: '107', name: 'Minutos de edicion' },
    { id: '8', name: 'Hora de desarrollo de software' },
    { id: '47', name: 'Mensajes masivos' },
    { id: '154', name: 'Licencias hackÜ Comms' },
    { id: '80', name: 'Sesiones de Whatsapp' },
    { id: '95', name: 'Hora de entrenamiento' },
    { id: '101', name: 'Implementación' },
    { id: '33', name: 'Creación de contenido' },
  ]
  const CLASSIFIED_ITEM_IDS = CLASSIFIED_ITEMS.map(i => i.id)
  const CLASSIFIED_ITEM_NAMES = CLASSIFIED_ITEMS.map(i => i.name)

  // Item mappings from localStorage
  const [itemMappings, setItemMappings] = useState<Record<string, string>>(() => {
    if (typeof window === 'undefined') return {}
    try { return JSON.parse(localStorage.getItem('item-mappings') || '{}') } catch { return {} }
  })

  const saveMapping = (unclassifiedName: string, classifiedName: string) => {
    const next = { ...itemMappings, [unclassifiedName]: classifiedName }
    setItemMappings(next)
    localStorage.setItem('item-mappings', JSON.stringify(next))
  }

  const removeMapping = (unclassifiedName: string) => {
    const next = { ...itemMappings }
    delete next[unclassifiedName]
    setItemMappings(next)
    localStorage.setItem('item-mappings', JSON.stringify(next))
  }

  // Separate classified vs unclassified
  const unclassifiedItems = itemStats.filter((s: any) => {
    // If mapped, it's classified
    if (itemMappings[s.name]) return false
    // If name matches a known item, it's classified
    if (CLASSIFIED_ITEM_NAMES.includes(s.name)) return false
    // Check by alegra_item_id
    const matchingItems = filteredRequests.flatMap((r: any) => (r.items || []))
      .filter((i: any) => (i.name || '') === s.name)
    return !matchingItems.some((i: any) => CLASSIFIED_ITEM_IDS.includes(String(i.alegra_item_id)))
  })

  // Count mapped items
  const mappedCount = Object.keys(itemMappings).length

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Analytics"
        description="Analisis de ventas por item, sociedad y vendedor"
      />

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Mes desde</label>
              <select
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={mesDesde}
                onChange={(e) => setMesDesde(e.target.value)}
              >
                <option value="">Todos</option>
                {months.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Mes hasta</label>
              <select
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={mesHasta}
                onChange={(e) => setMesHasta(e.target.value)}
              >
                <option value="">Todos</option>
                {months.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Sociedad</label>
              <select
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={sociedad}
                onChange={(e) => setSociedad(e.target.value)}
              >
                <option value="">Todas</option>
                {sociedades.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Vendedor</label>
              <select
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={vendedor}
                onChange={(e) => setVendedor(e.target.value)}
              >
                <option value="">Todos</option>
                {vendedores.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Revenue Total (USD)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatUSD(totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Items Vendidos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalItems.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Facturas Filtradas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{filteredRequests.length.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 10 by Revenue */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 10 Items por Revenue (USD)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={top10Revenue}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={150}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip formatter={(value: number) => formatUSD(value)} />
                  <Bar dataKey="totalRevenue" fill="#0088FE" name="Revenue USD" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top 10 by Quantity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 10 Items por Cantidad</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={top10Qty}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={150}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip />
                  <Bar dataKey="totalQty" fill="#00C49F" name="Cantidad" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pie Chart - Revenue by Sociedad */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Revenue por Sociedad (USD)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sociedadRevenue}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name} (${(percent * 100).toFixed(0)}%)`
                  }
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {sociedadRevenue.map((_: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatUSD(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Full Item Ranking Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ranking de Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-2 font-medium text-slate-500">#</th>
                  <th className="text-left py-3 px-2 font-medium text-slate-500">Item</th>
                  <th className="text-right py-3 px-2 font-medium text-slate-500">Veces vendido</th>
                  <th className="text-right py-3 px-2 font-medium text-slate-500">Cantidad total</th>
                  <th className="text-right py-3 px-2 font-medium text-slate-500">Revenue USD</th>
                  <th className="text-right py-3 px-2 font-medium text-slate-500">Precio prom.</th>
                </tr>
              </thead>
              <tbody>
                {itemStats.map((item: any, idx: number) => (
                  <tr key={item.name} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-2 px-2 text-slate-400">{idx + 1}</td>
                    <td className="py-2 px-2 font-medium">{item.name}</td>
                    <td className="py-2 px-2 text-right">{item.count}</td>
                    <td className="py-2 px-2 text-right">{item.totalQty.toLocaleString()}</td>
                    <td className="py-2 px-2 text-right">{formatUSD(item.totalRevenue)}</td>
                    <td className="py-2 px-2 text-right">{formatUSD(item.avgPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Top Clients Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top Clientes por Revenue</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-2 font-medium text-slate-500">#</th>
                  <th className="text-left py-3 px-2 font-medium text-slate-500">Cliente</th>
                  <th className="text-right py-3 px-2 font-medium text-slate-500">Items comprados</th>
                  <th className="text-right py-3 px-2 font-medium text-slate-500">Revenue USD</th>
                </tr>
              </thead>
              <tbody>
                {top20Clients.map((client: any, idx: number) => (
                  <tr key={client.name} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-2 px-2 text-slate-400">{idx + 1}</td>
                    <td className="py-2 px-2 font-medium">{client.name}</td>
                    <td className="py-2 px-2 text-right">{client.count}</td>
                    <td className="py-2 px-2 text-right">{formatUSD(client.totalRevenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      {/* Unclassified Items */}
      {unclassifiedItems.length > 0 && (
        <Card className="border-amber-200">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
              Items sin clasificar ({unclassifiedItems.length})
            </CardTitle>
            <p className="text-xs text-muted-foreground">Asigna cada item a una categoría del catálogo permitido. Los mapeos se guardan en tu navegador.</p>
            {mappedCount > 0 && (
              <p className="text-xs text-green-700 mt-1">{mappedCount} item(s) ya mapeados — su revenue se suma al item clasificado en los gráficos.</p>
            )}
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-sm">
                <thead className="bg-amber-50 sticky top-0">
                  <tr>
                    <th className="py-2 px-2 text-left text-xs">Item sin clasificar</th>
                    <th className="py-2 px-2 text-right text-xs">Vendido</th>
                    <th className="py-2 px-2 text-right text-xs">Cant.</th>
                    <th className="py-2 px-2 text-right text-xs">Revenue</th>
                    <th className="py-2 px-2 text-left text-xs">Clasificar como</th>
                  </tr>
                </thead>
                <tbody>
                  {unclassifiedItems.map((s: any, i: number) => (
                    <tr key={i} className="border-t">
                      <td className="py-2 px-2 font-medium text-amber-800 text-xs">{s.name}</td>
                      <td className="py-2 px-2 text-right text-xs">{s.count}</td>
                      <td className="py-2 px-2 text-right text-xs">{s.totalQty}</td>
                      <td className="py-2 px-2 text-right text-xs">{formatUSD(s.totalRevenue)}</td>
                      <td className="py-2 px-2">
                        <select
                          className="text-xs border rounded px-2 py-1 w-full max-w-[200px]"
                          value=""
                          onChange={(e) => { if (e.target.value) saveMapping(s.name, e.target.value) }}
                        >
                          <option value="">— Seleccionar —</option>
                          {CLASSIFIED_ITEMS.map(ci => (
                            <option key={ci.id} value={ci.name}>{ci.name}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 font-bold">
                  <tr>
                    <td className="py-2 px-2">Total sin clasificar</td>
                    <td className="py-2 px-2 text-right">{unclassifiedItems.reduce((s: number, i: any) => s + i.count, 0)}</td>
                    <td className="py-2 px-2 text-right">{unclassifiedItems.reduce((s: number, i: any) => s + i.totalQty, 0)}</td>
                    <td className="py-2 px-2 text-right">{formatUSD(unclassifiedItems.reduce((s: number, i: any) => s + i.totalRevenue, 0))}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mapped items */}
      {mappedCount > 0 && (
        <Card className="border-green-200">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
              Items mapeados ({mappedCount})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {Object.entries(itemMappings).map(([from, to]) => (
                <div key={from} className="flex items-center justify-between py-1 border-b last:border-0">
                  <div className="text-xs">
                    <span className="text-amber-700">{from}</span>
                    <span className="text-muted-foreground mx-2">→</span>
                    <span className="text-green-700 font-medium">{to}</span>
                  </div>
                  <button onClick={() => removeMapping(from)} className="text-[10px] text-red-500 hover:underline">Quitar</button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
