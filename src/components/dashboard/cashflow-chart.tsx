'use client'

import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Line,
  ComposedChart,
  ReferenceLine,
  Cell,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface CashflowChartData {
  week: string
  /** Main bar: actual for past weeks, projected for current/future */
  cashIn: number
  cashOut: number
  /** Projected figures for past weeks — shown in tooltip for comparison */
  projCashIn: number | null
  projCashOut: number | null
  /** Actual paid so far this week (current week only) */
  actualCashIn: number | null
  actualCashOut: number | null
  /** Cumulative net — carries forward across weeks */
  runningBalance: number
  isCurrent?: boolean
  isFuture?: boolean
  isPast?: boolean
}

interface CashflowChartProps {
  data: CashflowChartData[]
}

const formatUSD = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const d: CashflowChartData = payload[0]?.payload

  const rows: { label: string; value: number; color: string; italic?: boolean }[] = []

  if (d.isPast) {
    rows.push({ label: 'Cobrado real',   value: d.cashIn,  color: '#16a34a' })
    rows.push({ label: 'Pagado real',    value: d.cashOut, color: '#dc2626' })
    if (d.projCashIn  != null) rows.push({ label: 'Proyectado cobro', value: d.projCashIn,  color: '#86efac', italic: true })
    if (d.projCashOut != null) rows.push({ label: 'Proyectado pago',  value: d.projCashOut, color: '#fca5a5', italic: true })
  } else if (d.isCurrent) {
    rows.push({ label: 'Proyectado cobro',  value: d.cashIn,  color: '#16a34a' })
    rows.push({ label: 'Proyectado pago',   value: d.cashOut, color: '#dc2626' })
    if (d.actualCashIn  != null) rows.push({ label: 'Ya cobrado',  value: d.actualCashIn,  color: '#4ade80', italic: true })
    if (d.actualCashOut != null) rows.push({ label: 'Ya pagado',   value: d.actualCashOut, color: '#f87171', italic: true })
  } else {
    rows.push({ label: 'Proyectado cobro', value: d.cashIn,  color: '#22c55e' })
    rows.push({ label: 'Proyectado pago',  value: d.cashOut, color: '#ef4444' })
  }

  const weekNet = d.cashIn - d.cashOut

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-md text-xs space-y-1.5 min-w-[180px]">
      <p className="font-semibold text-slate-700 border-b pb-1 mb-1">
        {d.isCurrent ? '📍 ' : d.isFuture ? '🔮 ' : ''}{label}
      </p>
      {rows.map((r) => (
        <div key={r.label} className="flex justify-between gap-4">
          <span style={{ color: r.color }} className={r.italic ? 'italic' : ''}>{r.label}</span>
          <span className="font-medium text-slate-800">{formatUSD(r.value)}</span>
        </div>
      ))}
      <div className={`flex justify-between gap-4 pt-1 border-t font-semibold ${weekNet >= 0 ? 'text-green-700' : 'text-red-700'}`}>
        <span>Neto semana</span>
        <span>{formatUSD(weekNet)}</span>
      </div>
      <div className={`flex justify-between gap-4 font-semibold ${d.runningBalance >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
        <span>Balance acum.</span>
        <span>{formatUSD(d.runningBalance)}</span>
      </div>
    </div>
  )
}

export function CashflowChart({ data }: CashflowChartProps) {
  const currentIdx = data.findIndex((d) => d.isCurrent)
  const hasBalance = data.some((d) => d.runningBalance !== 0)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm font-medium text-slate-600">
            Flujo de Caja — Real vs Proyectado (USD)
          </CardTitle>
          <div className="flex gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs bg-slate-50">Real (pasado)</Badge>
            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">Proyectado</Badge>
            {hasBalance && (
              <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">Balance acum.</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart data={data} margin={{ top: 8, right: 40, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="week"
              tick={{ fontSize: 10, fill: '#64748b' }}
              tickLine={false}
              interval={1}
            />
            {/* Left Y-axis: weekly cash flows */}
            <YAxis
              yAxisId="left"
              tickFormatter={formatUSD}
              tick={{ fontSize: 10, fill: '#64748b' }}
              tickLine={false}
              axisLine={false}
            />
            {/* Right Y-axis: running balance */}
            <YAxis
              yAxisId="right"
              orientation="right"
              tickFormatter={formatUSD}
              tick={{ fontSize: 10, fill: '#7c3aed' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              formatter={(value) => {
                if (value === 'cashIn')  return 'Entradas (real/proy.)'
                if (value === 'cashOut') return 'Salidas (real/proy.)'
                if (value === 'runningBalance') return 'Balance acumulado'
                return value
              }}
            />

            {/* "Hoy" reference line */}
            {currentIdx >= 0 && (
              <ReferenceLine
                yAxisId="left"
                x={data[currentIdx]?.week}
                stroke="#3b82f6"
                strokeWidth={2}
                strokeDasharray="5 5"
                label={{ value: 'Hoy', position: 'top', fontSize: 10, fill: '#3b82f6' }}
              />
            )}

            {/* Zero balance reference */}
            <ReferenceLine yAxisId="right" y={0} stroke="#c4b5fd" strokeDasharray="3 3" />

            {/* Cash-In bars */}
            <Bar yAxisId="left" dataKey="cashIn" name="cashIn" radius={[3, 3, 0, 0]} maxBarSize={28}>
              {data.map((entry, index) => (
                <Cell
                  key={`in-${index}`}
                  fill={entry.isPast ? '#16a34a' : entry.isCurrent ? '#22c55e' : '#86efac'}
                  opacity={entry.isFuture ? 0.75 : 1}
                />
              ))}
            </Bar>

            {/* Cash-Out bars */}
            <Bar yAxisId="left" dataKey="cashOut" name="cashOut" radius={[3, 3, 0, 0]} maxBarSize={28}>
              {data.map((entry, index) => (
                <Cell
                  key={`out-${index}`}
                  fill={entry.isPast ? '#dc2626' : entry.isCurrent ? '#ef4444' : '#fca5a5'}
                  opacity={entry.isFuture ? 0.75 : 1}
                />
              ))}
            </Bar>

            {/* Running balance line (right axis) */}
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="runningBalance"
              stroke="#7c3aed"
              strokeWidth={2.5}
              dot={false}
              name="runningBalance"
              strokeDasharray="4 2"
            />
          </ComposedChart>
        </ResponsiveContainer>

        {/* Legend footer */}
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500 border-t pt-3">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-green-700" />
            Cobros reales (semanas pasadas)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-green-400 opacity-75" />
            Cobros proyectados
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-red-700" />
            Pagos reales
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-red-300 opacity-75" />
            Pagos proyectados
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-8 border-t-2 border-dashed border-purple-600" />
            Balance acumulado
          </span>
        </div>

        {data.length === 0 && (
          <div className="flex items-center justify-center h-32 text-sm text-slate-400">
            No hay datos de flujo de caja aún
          </div>
        )}
      </CardContent>
    </Card>
  )
}
