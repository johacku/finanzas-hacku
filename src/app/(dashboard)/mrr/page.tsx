// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server'
import { getLatestRates } from '@/actions/trm-rates.actions'
import { formatCurrency, convertToUSD } from '@/lib/currency'
import { SOCIEDADES, SOCIEDAD_CURRENCY_MAP, type Sociedad } from '@/lib/constants'
import { PageHeader } from '@/components/shared/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const dynamic = 'force-dynamic'

export default async function MRRPage() {
  const supabase = await createClient()
  const rates = await getLatestRates()

  // Fetch income invoices (not cancelled)
  const { data: invoices } = await supabase
    .from('income_invoices')
    .select('*')
    .neq('estado', 'Anulada')

  const allInvoices = invoices ?? []

  function getUSD(inv: any): number {
    if (inv.total_usd && inv.total_usd > 0) return inv.total_usd
    const local = inv.total_moneda_local ?? inv.monto ?? 0
    if (local <= 0) return 0
    const moneda = inv.moneda ?? (inv.sociedad ? SOCIEDAD_CURRENCY_MAP[inv.sociedad as Sociedad] : null) ?? 'COP'
    if (moneda === 'USD') return local
    return convertToUSD(local, moneda, rates) ?? 0
  }

  // Generate months: June 2026 to Dec 2026 (7 months)
  const months: string[] = []
  for (let m = 5; m <= 11; m++) { // 5=June, 11=December (0-indexed)
    months.push(`2026-${String(m + 1).padStart(2, '0')}`)
  }

  // Parse diferido from observaciones
  function parseDiferido(obs: string | null): { numCuotas: number; cuotas: Array<{ mes: string; monto: number }> } | null {
    if (!obs) return null
    const match = obs.match(/Pago diferido en (\d+) cuotas: (.+)/)
    if (!match) return null
    const numCuotas = parseInt(match[1])
    const cuotasStr = match[2].split(' | ')
    const cuotas = cuotasStr.map((c) => {
      const [mes, montoStr] = c.split(': ')
      return { mes: mes?.trim() || '', monto: parseFloat(montoStr?.replace(/\./g, '').replace(',', '.')) || 0 }
    })
    return { numCuotas, cuotas }
  }

  // Map month name to YYYY-MM key
  function mesNameToKey(mesName: string, baseDate: string): string | null {
    // mesName like "Junio de 2026" or "Julio de 2026"
    const monthNames: Record<string, number> = {
      'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4, 'mayo': 5, 'junio': 6,
      'julio': 7, 'agosto': 8, 'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12
    }
    const lower = mesName.toLowerCase()
    for (const [name, num] of Object.entries(monthNames)) {
      if (lower.includes(name)) {
        const yearMatch = mesName.match(/\d{4}/)
        const year = yearMatch ? yearMatch[0] : baseDate.substring(0, 4)
        return `${year}-${String(num).padStart(2, '0')}`
      }
    }
    return null
  }

  // Build MRR data: { [month]: { [sociedad]: number, byClient: { [client]: number }, byVendedor: { [vendedor]: number } } }
  const mrrData: Record<string, {
    total: number
    bySociedad: Record<string, number>
    byClient: Record<string, number>
    byVendedor: Record<string, number>
  }> = {}

  for (const m of months) {
    mrrData[m] = { total: 0, bySociedad: {}, byClient: {}, byVendedor: {} }
  }

  for (const inv of allInvoices) {
    const usd = getUSD(inv)
    if (usd <= 0) continue

    const fechaEmision = inv.fecha_creacion || inv.fecha_emision || ''
    const emisionMonth = fechaEmision.substring(0, 7) // YYYY-MM
    const client = inv.razon_social_cliente || 'Desconocido'
    const vendedor = inv.vendedor || 'Sin vendedor'
    const sociedad = inv.sociedad || 'hackÜ SAS'

    // Check if diferido
    const diferido = parseDiferido(inv.observaciones)

    if (diferido && diferido.cuotas.length > 0) {
      // Distribute across cuota months
      // Calculate USD per cuota proportionally
      const totalLocal = diferido.cuotas.reduce((s, c) => s + c.monto, 0)
      for (const cuota of diferido.cuotas) {
        const monthKey = mesNameToKey(cuota.mes, fechaEmision)
        if (!monthKey || !mrrData[monthKey]) continue
        const cuotaUSD = totalLocal > 0 ? (cuota.monto / totalLocal) * usd : 0
        mrrData[monthKey].total += cuotaUSD
        mrrData[monthKey].bySociedad[sociedad] = (mrrData[monthKey].bySociedad[sociedad] || 0) + cuotaUSD
        mrrData[monthKey].byClient[client] = (mrrData[monthKey].byClient[client] || 0) + cuotaUSD
        mrrData[monthKey].byVendedor[vendedor] = (mrrData[monthKey].byVendedor[vendedor] || 0) + cuotaUSD
      }
    } else {
      // Non-deferred: 100% in emission month
      if (!mrrData[emisionMonth]) continue
      mrrData[emisionMonth].total += usd
      mrrData[emisionMonth].bySociedad[sociedad] = (mrrData[emisionMonth].bySociedad[sociedad] || 0) + usd
      mrrData[emisionMonth].byClient[client] = (mrrData[emisionMonth].byClient[client] || 0) + usd
      mrrData[emisionMonth].byVendedor[vendedor] = (mrrData[emisionMonth].byVendedor[vendedor] || 0) + usd
    }
  }

  const monthLabels: Record<string, string> = {
    '2026-06': 'Jun 2026', '2026-07': 'Jul 2026', '2026-08': 'Ago 2026',
    '2026-09': 'Sep 2026', '2026-10': 'Oct 2026', '2026-11': 'Nov 2026', '2026-12': 'Dic 2026',
  }

  // Current month MRR
  const currentMonth = new Date().toISOString().substring(0, 7)
  const currentMRR = mrrData[currentMonth]?.total || 0
  const currentARR = currentMRR * 12

  // Top clients this month
  const currentClients = Object.entries(mrrData[currentMonth]?.byClient || {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 15)

  // Top vendedores this month
  const currentVendedores = Object.entries(mrrData[currentMonth]?.byVendedor || {})
    .sort(([, a], [, b]) => b - a)

  return (
    <div className="space-y-6">
      <PageHeader
        title="MRR & ARR"
        description="Monthly & Annual Recurring Revenue"
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-r from-green-900 to-green-800 text-white">
          <CardContent className="py-4">
            <p className="text-xs text-green-300">MRR — {monthLabels[currentMonth] || currentMonth}</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(currentMRR, 'USD')}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-blue-900 to-blue-800 text-white">
          <CardContent className="py-4">
            <p className="text-xs text-blue-300">ARR (MRR x 12)</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(currentARR, 'USD')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Clientes activos ({monthLabels[currentMonth]})</p>
            <p className="text-2xl font-bold mt-1">{Object.keys(mrrData[currentMonth]?.byClient || {}).length}</p>
          </CardContent>
        </Card>
      </div>

      {/* MRR by Month Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">MRR por Mes (USD)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 text-xs text-muted-foreground">Sociedad</th>
                  {months.map(m => (
                    <th key={m} className={`text-right py-2 px-2 text-xs ${m === currentMonth ? 'text-green-700 font-bold' : 'text-muted-foreground'}`}>
                      {monthLabels[m] || m}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SOCIEDADES.map(soc => {
                  const hasData = months.some(m => (mrrData[m]?.bySociedad[soc] || 0) > 0)
                  if (!hasData) return null
                  return (
                    <tr key={soc} className="border-b">
                      <td className="py-2 px-2 text-xs font-medium">{soc}</td>
                      {months.map(m => (
                        <td key={m} className={`text-right py-2 px-2 text-xs ${m === currentMonth ? 'font-bold' : ''}`}>
                          {formatCurrency(mrrData[m]?.bySociedad[soc] || 0, 'USD')}
                        </td>
                      ))}
                    </tr>
                  )
                })}
                <tr className="border-t-2 font-bold">
                  <td className="py-2 px-2 text-xs">Total</td>
                  {months.map(m => (
                    <td key={m} className={`text-right py-2 px-2 text-xs ${m === currentMonth ? 'text-green-700' : ''}`}>
                      {formatCurrency(mrrData[m]?.total || 0, 'USD')}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* By Vendedor */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">MRR por Vendedor — {monthLabels[currentMonth]}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {currentVendedores.map(([name, amount]) => (
                <div key={name} className="flex justify-between items-center">
                  <span className="text-sm">{name}</span>
                  <span className="text-sm font-bold">{formatCurrency(amount, 'USD')}</span>
                </div>
              ))}
              {currentVendedores.length === 0 && <p className="text-xs text-muted-foreground">Sin datos</p>}
            </div>
          </CardContent>
        </Card>

        {/* Top Clients */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Top Clientes MRR — {monthLabels[currentMonth]}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {currentClients.map(([name, amount], i) => (
                <div key={name} className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground w-4">{i + 1}</span>
                    <span className="text-xs truncate max-w-[250px]">{name}</span>
                  </div>
                  <span className="text-xs font-bold whitespace-nowrap">{formatCurrency(amount, 'USD')}</span>
                </div>
              ))}
              {currentClients.length === 0 && <p className="text-xs text-muted-foreground">Sin datos</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
