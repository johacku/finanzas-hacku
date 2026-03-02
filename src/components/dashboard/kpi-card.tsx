import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ReactNode } from 'react'

interface KpiCardProps {
  title: string
  value: string
  subtitle?: string
  trend?: 'up' | 'down' | 'neutral'
  trendLabel?: string
  icon?: ReactNode
  className?: string
}

export function KpiCard({
  title,
  value,
  subtitle,
  trend,
  trendLabel,
  icon,
  className,
}: KpiCardProps) {
  return (
    <Card className={cn('', className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-slate-600">{title}</CardTitle>
        {icon && <div className="text-slate-400">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-slate-900">{value}</div>
        <div className="flex items-center gap-1 mt-1">
          {trend && trend !== 'neutral' && (
            <span
              className={cn(
                'flex items-center text-xs font-medium',
                trend === 'up' ? 'text-green-600' : 'text-red-600'
              )}
            >
              {trend === 'up' ? (
                <TrendingUp className="h-3 w-3 mr-0.5" />
              ) : (
                <TrendingDown className="h-3 w-3 mr-0.5" />
              )}
              {trendLabel}
            </span>
          )}
          {trend === 'neutral' && (
            <span className="flex items-center text-xs font-medium text-slate-500">
              <Minus className="h-3 w-3 mr-0.5" />
              {trendLabel}
            </span>
          )}
          {subtitle && !trend && (
            <p className="text-xs text-slate-500">{subtitle}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
