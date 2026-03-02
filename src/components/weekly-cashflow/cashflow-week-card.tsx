// @ts-nocheck
'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Pencil, Save, X, AlertTriangle } from 'lucide-react'
import { SociedadBadge } from '@/components/shared/sociedad-badge'
import { formatCurrency } from '@/lib/currency'
import { upsertCashflowEntry } from '@/actions/cashflow.actions'
import { useToast } from '@/hooks/use-toast'
import type { Database } from '@/types/database.types'
import type { Sociedad } from '@/lib/constants'

type WeeklyCashflowEntry = Database['public']['Tables']['weekly_cashflow_entries']['Row']

interface CashflowWeekCardProps {
  sociedad: Sociedad
  weekStartDate: string
  entry: WeeklyCashflowEntry | null
}

export function CashflowWeekCard({
  sociedad,
  weekStartDate,
  entry,
}: CashflowWeekCardProps) {
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  // Local display entry — updated optimistically on save
  const [displayEntry, setDisplayEntry] = useState<WeeklyCashflowEntry | null>(entry)

  const [form, setForm] = useState({
    estimated_cash_in: entry?.estimated_cash_in ?? 0,
    realtime_cash_in: entry?.realtime_cash_in ?? null,
    estimated_cash_out: entry?.estimated_cash_out ?? 0,
    realtime_cash_out: entry?.realtime_cash_out ?? null,
    opening_balance: entry?.opening_balance ?? null,
    closing_balance: entry?.closing_balance ?? null,
    requires_additional_cash: entry?.requires_additional_cash ?? false,
    cash_gap_usd: entry?.cash_gap_usd ?? null,
  })

  async function handleSave() {
    setLoading(true)
    try {
      await upsertCashflowEntry({
        sociedad,
        week_start_date: weekStartDate,
        ...form,
      })
      // Update local display state optimistically
      setDisplayEntry((prev) => ({
        ...(prev ?? {
          id: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          net_cash_flow: 0,
        }),
        sociedad,
        week_start_date: weekStartDate,
        ...form,
        net_cash_flow:
          (form.realtime_cash_in ?? form.estimated_cash_in) -
          (form.realtime_cash_out ?? form.estimated_cash_out),
      } as WeeklyCashflowEntry))
      toast({ title: `Flujo ${sociedad} guardado` })
      setEditing(false)
    } catch (e) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const cashIn = displayEntry?.realtime_cash_in ?? displayEntry?.estimated_cash_in ?? 0
  const cashOut = displayEntry?.realtime_cash_out ?? displayEntry?.estimated_cash_out ?? 0
  const netFlow = cashIn - cashOut

  return (
    <Card className={displayEntry?.requires_additional_cash ? 'border-amber-300 bg-amber-50' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SociedadBadge sociedad={sociedad} />
            {displayEntry?.requires_additional_cash && (
              <Badge className="bg-amber-100 text-amber-800 text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Requiere capital
              </Badge>
            )}
          </div>
          <div className="flex gap-1">
            {editing ? (
              <>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(false)}>
                  <X className="h-3 w-3" />
                </Button>
                <Button size="icon" variant="default" className="h-7 w-7" onClick={handleSave} disabled={loading}>
                  <Save className="h-3 w-3" />
                </Button>
              </>
            ) : (
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(true)}>
                <Pencil className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!editing ? (
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Entradas</p>
              <p className="font-semibold text-green-700">{formatCurrency(cashIn, 'USD')}</p>
              {displayEntry?.realtime_cash_in !== null && displayEntry?.realtime_cash_in !== undefined && (
                <p className="text-xs text-slate-400">
                  Est: {formatCurrency(displayEntry.estimated_cash_in, 'USD')}
                </p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Salidas</p>
              <p className="font-semibold text-red-700">{formatCurrency(cashOut, 'USD')}</p>
              {displayEntry?.realtime_cash_out !== null && displayEntry?.realtime_cash_out !== undefined && (
                <p className="text-xs text-slate-400">
                  Est: {formatCurrency(displayEntry.estimated_cash_out, 'USD')}
                </p>
              )}
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Neto</p>
              <p className={`font-bold ${netFlow >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {formatCurrency(netFlow, 'USD')}
              </p>
            </div>
            {displayEntry?.opening_balance !== null && (
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Saldo apertura</p>
                <p className="text-sm">{formatCurrency(displayEntry?.opening_balance ?? 0, 'USD')}</p>
              </div>
            )}
            {displayEntry?.closing_balance !== null && (
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Saldo cierre</p>
                <p className="text-sm">{formatCurrency(displayEntry?.closing_balance ?? 0, 'USD')}</p>
              </div>
            )}
            {displayEntry?.cash_gap_usd !== null && (
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Gap USD</p>
                <p className="text-sm text-red-600">{formatCurrency(displayEntry?.cash_gap_usd ?? 0, 'USD')}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500">Entradas Estimadas</label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.estimated_cash_in}
                  onChange={(e) => setForm({ ...form, estimated_cash_in: parseFloat(e.target.value) || 0 })}
                  className="h-8 mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">Entradas Real</label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.realtime_cash_in ?? ''}
                  onChange={(e) => setForm({ ...form, realtime_cash_in: e.target.value ? parseFloat(e.target.value) : null })}
                  className="h-8 mt-1"
                  placeholder="—"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">Salidas Estimadas</label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.estimated_cash_out}
                  onChange={(e) => setForm({ ...form, estimated_cash_out: parseFloat(e.target.value) || 0 })}
                  className="h-8 mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">Salidas Real</label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.realtime_cash_out ?? ''}
                  onChange={(e) => setForm({ ...form, realtime_cash_out: e.target.value ? parseFloat(e.target.value) : null })}
                  className="h-8 mt-1"
                  placeholder="—"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">Saldo Apertura</label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.opening_balance ?? ''}
                  onChange={(e) => setForm({ ...form, opening_balance: e.target.value ? parseFloat(e.target.value) : null })}
                  className="h-8 mt-1"
                  placeholder="—"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">Saldo Cierre</label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.closing_balance ?? ''}
                  onChange={(e) => setForm({ ...form, closing_balance: e.target.value ? parseFloat(e.target.value) : null })}
                  className="h-8 mt-1"
                  placeholder="—"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500">Gap (USD)</label>
              <Input
                type="number"
                step="0.01"
                value={form.cash_gap_usd ?? ''}
                onChange={(e) => setForm({ ...form, cash_gap_usd: e.target.value ? parseFloat(e.target.value) : null })}
                className="h-8 mt-1"
                placeholder="0"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={form.requires_additional_cash}
                onCheckedChange={(v) => setForm({ ...form, requires_additional_cash: Boolean(v) })}
              />
              <label className="text-xs text-slate-600">Requiere capital adicional</label>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
