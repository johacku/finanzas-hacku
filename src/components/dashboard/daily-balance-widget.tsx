// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Landmark, Save, Loader2 } from 'lucide-react'
import { bulkUpsertDailyBalances } from '@/actions/daily-balances.actions'
import { useToast } from '@/hooks/use-toast'

interface BankAccount {
  id: string
  nombre: string
  banco: string
  tipo: string
  numero: string
  moneda: string
  activo: boolean
}

interface DailyBalanceWidgetProps {
  bankAccounts: BankAccount[]
  todayBalances: any[]
  latestTotal: number
  latestFecha: string | null
  userEmail?: string
}

export function DailyBalanceWidget({ bankAccounts, todayBalances, latestTotal, latestFecha, userEmail }: DailyBalanceWidgetProps) {
  const today = new Date().toISOString().split('T')[0]
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)

  // Initialize balances from today's data or empty
  const activeAccounts = bankAccounts.filter(a => a.activo)

  const [balances, setBalances] = useState<Record<string, { inicial: string; inicialUsd: string; cierre: string }>>(
    () => {
      const map: Record<string, any> = {}
      for (const acc of activeAccounts) {
        const existing = todayBalances.find((b: any) => b.bank_account_id === acc.id)
        map[acc.id] = {
          inicial: existing ? String(existing.saldo_inicial) : '',
          inicialUsd: existing?.saldo_inicial_usd ? String(existing.saldo_inicial_usd) : '',
          cierre: existing?.saldo_cierre ? String(existing.saldo_cierre) : '',
        }
      }
      return map
    }
  )

  const totalUSD = activeAccounts.reduce((sum, acc) => {
    const val = parseFloat(balances[acc.id]?.inicialUsd || balances[acc.id]?.inicial || '0')
    return sum + (isNaN(val) ? 0 : val)
  }, 0)

  const handleSave = async () => {
    setSaving(true)
    try {
      const rows = activeAccounts
        .filter(acc => balances[acc.id]?.inicial)
        .map(acc => ({
          bank_account_id: acc.id,
          saldo_inicial: parseFloat(balances[acc.id].inicial) || 0,
          saldo_inicial_usd: parseFloat(balances[acc.id].inicialUsd || balances[acc.id].inicial) || 0,
          saldo_cierre: balances[acc.id].cierre ? parseFloat(balances[acc.id].cierre) : null,
          saldo_cierre_usd: null,
        }))

      if (rows.length === 0) {
        toast({ title: 'Ingresa al menos un saldo', variant: 'destructive' })
        return
      }

      await bulkUpsertDailyBalances(today, rows, userEmail)
      toast({ title: 'Saldos guardados', description: `Total: $${totalUSD.toLocaleString('en-US')} USD` })
      window.location.reload()
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const updateBalance = (accId: string, field: string, value: string) => {
    setBalances(prev => ({
      ...prev,
      [accId]: { ...prev[accId], [field]: value }
    }))
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-slate-600">Saldos Bancarios — {today}</CardTitle>
        <Landmark className="h-4 w-4 text-slate-400" />
      </CardHeader>
      <CardContent className="space-y-3">
        {latestFecha && latestFecha !== today && (
          <p className="text-xs text-amber-600">Ultimo registro: {latestFecha} — ${latestTotal.toLocaleString('en-US')} USD</p>
        )}

        {activeAccounts.length === 0 ? (
          <p className="text-xs text-muted-foreground">No hay cuentas activas. Agregalas en Configuracion.</p>
        ) : (
          <>
            <div className="space-y-2">
              {activeAccounts.map(acc => (
                <div key={acc.id} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{acc.banco} - {acc.nombre}</p>
                    <p className="text-[10px] text-muted-foreground">{acc.tipo.toUpperCase()} · {acc.moneda}</p>
                  </div>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Inicial"
                    value={balances[acc.id]?.inicial || ''}
                    onChange={(e) => {
                      updateBalance(acc.id, 'inicial', e.target.value)
                      if (acc.moneda === 'USD') updateBalance(acc.id, 'inicialUsd', e.target.value)
                    }}
                    className="h-7 text-xs w-28"
                  />
                  {acc.moneda !== 'USD' && (
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="USD"
                      value={balances[acc.id]?.inicialUsd || ''}
                      onChange={(e) => updateBalance(acc.id, 'inicialUsd', e.target.value)}
                      className="h-7 text-xs w-24"
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <div>
                <p className="text-sm font-semibold">${totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</p>
                <p className="text-[10px] text-muted-foreground">Total saldo inicial</p>
              </div>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                Guardar
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
