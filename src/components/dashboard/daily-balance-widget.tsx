// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Landmark, Save, Loader2 } from 'lucide-react'
import { upsertDailyBalance } from '@/actions/daily-balances.actions'
import { useToast } from '@/hooks/use-toast'

interface DailyBalanceWidgetProps {
  latestBalance: any | null
  userEmail?: string
}

export function DailyBalanceWidget({ latestBalance, userEmail }: DailyBalanceWidgetProps) {
  const today = new Date().toISOString().split('T')[0]
  const isToday = latestBalance?.fecha === today

  const [saldoInicial, setSaldoInicial] = useState<string>(
    isToday ? String(latestBalance?.saldo_inicial_usd || '') : ''
  )
  const [saldoCierre, setSaldoCierre] = useState<string>(
    isToday ? String(latestBalance?.saldo_cierre_usd || '') : ''
  )
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const handleSave = async (type: 'inicial' | 'cierre') => {
    setSaving(true)
    try {
      await upsertDailyBalance({
        fecha: today,
        saldo_inicial_usd: parseFloat(saldoInicial) || 0,
        saldo_cierre_usd: type === 'cierre' ? (parseFloat(saldoCierre) || null) : (isToday ? latestBalance?.saldo_cierre_usd : null),
        registrado_por: userEmail,
      })
      toast({ title: type === 'inicial' ? 'Saldo inicial guardado' : 'Saldo de cierre guardado' })
      // Reload to reflect in chart
      window.location.reload()
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-slate-600">Saldo Bancario del Dia</CardTitle>
        <Landmark className="h-4 w-4 text-slate-400" />
      </CardHeader>
      <CardContent className="space-y-3">
        {latestBalance && !isToday && (
          <p className="text-xs text-muted-foreground">
            Ultimo registro: {latestBalance.fecha} — ${Number(latestBalance.saldo_inicial_usd).toLocaleString('en-US')} USD
          </p>
        )}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground whitespace-nowrap w-20">Saldo inicial</label>
            <Input
              type="number"
              step="0.01"
              placeholder="USD"
              value={saldoInicial}
              onChange={(e) => setSaldoInicial(e.target.value)}
              className="h-8 text-sm"
            />
            <Button size="sm" className="h-8" onClick={() => handleSave('inicial')} disabled={saving || !saldoInicial}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground whitespace-nowrap w-20">Saldo cierre</label>
            <Input
              type="number"
              step="0.01"
              placeholder="USD"
              value={saldoCierre}
              onChange={(e) => setSaldoCierre(e.target.value)}
              className="h-8 text-sm"
            />
            <Button size="sm" variant="outline" className="h-8" onClick={() => handleSave('cierre')} disabled={saving || !saldoCierre}>
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            </Button>
          </div>
        </div>
        {isToday && saldoInicial && (
          <p className="text-xs text-green-600">Saldo de hoy registrado: ${Number(saldoInicial).toLocaleString('en-US')} USD</p>
        )}
      </CardContent>
    </Card>
  )
}
