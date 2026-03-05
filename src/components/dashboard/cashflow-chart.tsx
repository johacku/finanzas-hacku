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
  cashIn: number
  cashOut: number
  net: number
  isCurrent?: boolean
  isFuture?: boolean
}

interface CashflowChartProps {
  data: CashflowChartData[]
}

export function CashflowChart({ data }: CashflowChartProps) {
  const formatUSD = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value)

  // Find the current week index for the reference line
  const currentIdx = data.findIndex((d) => d.isCurrent)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-slate-600">
            Flujo de Caja — 8 semanas + 12 semanas proyectadas (USD)
          </CardTitle>
          <div className="flex gap-2">
            <Badge variant="outline" className="text-xs bg-slate-50">Pasado</Badge>
            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">Proyectado</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="week"
              tick={{ fontSize: 10, fill: '#64748b' }}
              tickLine={false}
              interval={1}
            />
            <YAxis
              tickFormatter={formatUSD}
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              formatter={(value: number | string | undefined, name: string | undefined) => [
                formatUSD(Number(value ?? 0)),
                name === 'cashIn' ? 'Entradas' : name === 'cashOut' ? 'Salidas' : 'Neto',
              ]}
              labelFormatter={(label, payload) => {
                const item = payload?.[0]?.payload
                const prefix = item?.isCurrent ? '(Actual) ' : item?.isFuture ? '(Proyectado) ' : ''
                return `${prefix}${label}`
              }}
              contentStyle={{
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontSize: '12px',
              }}
            />
            <Legend
              formatter={(value) =>
                value === 'cashIn' ? 'Entradas' : value === 'cashOut' ? 'Salidas' : 'Neto'
              }
            />
            {currentIdx >= 0 && (
              <ReferenceLine
                x={data[currentIdx]?.week}
                stroke="#3b82f6"
                strokeWidth={2}
                strokeDasharray="5 5"
                label={{ value: 'Hoy', position: 'top', fontSize: 10, fill: '#3b82f6' }}
              />
            )}
            <Bar dataKey="cashIn" name="cashIn" radius={[3, 3, 0, 0]}>
              {data.map((entry, index) => (
                <Cell
                  key={`in-${index}`}
                  fill={entry.isFuture ? '#86efac' : '#22c55e'}
                  opacity={entry.isFuture ? 0.7 : 1}
                />
              ))}
            </Bar>
            <Bar dataKey="cashOut" name="cashOut" radius={[3, 3, 0, 0]}>
              {data.map((entry, index) => (
                <Cell
                  key={`out-${index}`}
                  fill={entry.isFuture ? '#fca5a5' : '#ef4444'}
                  opacity={entry.isFuture ? 0.7 : 1}
                />
              ))}
            </Bar>
            <Line
              type="monotone"
              dataKey="net"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              name="net"
              strokeDasharray={(data.some(d => d.isFuture)) ? undefined : undefined}
            />
          </ComposedChart>
        </ResponsiveContainer>
        {data.length === 0 && (
          <div className="flex items-center justify-center h-32 text-sm text-slate-400">
            No hay datos de flujo de caja aun
          </div>
        )}
      </CardContent>
    </Card>
  )
}
