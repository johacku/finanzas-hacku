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
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface CashflowChartData {
  week: string
  cashIn: number
  cashOut: number
  net: number
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-slate-600">
          Flujo de Caja — Últimas 12 semanas (USD)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="week"
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickLine={false}
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
            <Bar dataKey="cashIn" fill="#22c55e" radius={[3, 3, 0, 0]} name="cashIn" />
            <Bar dataKey="cashOut" fill="#ef4444" radius={[3, 3, 0, 0]} name="cashOut" />
            <Line
              type="monotone"
              dataKey="net"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              name="net"
            />
          </ComposedChart>
        </ResponsiveContainer>
        {data.length === 0 && (
          <div className="flex items-center justify-center h-32 text-sm text-slate-400">
            No hay datos de flujo de caja aún
          </div>
        )}
      </CardContent>
    </Card>
  )
}
