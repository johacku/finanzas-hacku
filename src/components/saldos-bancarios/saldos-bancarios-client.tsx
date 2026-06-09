// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/shared/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Save, Calendar } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { bulkUpsertDailyBalances, getDailyBalancesForDate, getDailyBalances } from '@/actions/daily-balances.actions'

const FALLBACK_RATES: Record<string, number> = { COP: 4150, MXN: 17, BRL: 5, PEN: 3.7, EUR: 0.92, USD: 1 }

interface BankAccount {
  id: string
  nombre: string
  banco: string
  tipo: string
  numero: string
  moneda: string
  activo: boolean
}

interface Props {
  bankAccounts: BankAccount[]
  initialBalances: any[]
  userEmail: string
}

export function SaldosBancariosClient({ bankAccounts, initialBalances, userEmail }: Props) {
  const { toast } = useToast()
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)

  const activeAccounts = bankAccounts.filter(a => a.activo)

  // Balance state: { [accountId]: { local: string, usd: string, cierre: string } }
  const [balances, setBalances] = useState<Record<string, { local: string; usd: string; cierre: string }>>(() => {
    const map: Record<string, any> = {}
    for (const acc of activeAccounts) {
      const existing = initialBalances.find((b: any) => b.bank_account_id === acc.id)
      map[acc.id] = {
        local: existing ? String(existing.saldo_inicial) : '',
        usd: existing?.saldo_inicial_usd ? String(existing.saldo_inicial_usd) : '',
        cierre: existing?.saldo_cierre ? String(existing.saldo_cierre) : '',
      }
    }
    return map
  })

  // History
  const [history, setHistory] = useState<any[]>([])

  useEffect(() => {
    getDailyBalances().then(setHistory).catch(console.error)
  }, [])

  const loadDate = async (d: string) => {
    setLoading(true)
    try {
      const data = await getDailyBalancesForDate(d)
      const map: Record<string, any> = {}
      for (const acc of activeAccounts) {
        const existing = (data || []).find((b: any) => b.bank_account_id === acc.id)
        map[acc.id] = {
          local: existing ? String(existing.saldo_inicial) : '',
          usd: existing?.saldo_inicial_usd ? String(existing.saldo_inicial_usd) : '',
          cierre: existing?.saldo_cierre ? String(existing.saldo_cierre) : '',
        }
      }
      setBalances(map)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleLocalChange = (accId: string, value: string, moneda: string) => {
    const amount = parseFloat(value) || 0
    const rate = FALLBACK_RATES[moneda] || 1
    const usdSuggested = moneda === 'USD' ? amount : Math.round((amount / rate) * 100) / 100

    setBalances(prev => ({
      ...prev,
      [accId]: {
        ...prev[accId],
        local: value,
        usd: String(usdSuggested),
      }
    }))
  }

  const totalUSD = activeAccounts.reduce((sum, acc) => {
    return sum + (parseFloat(balances[acc.id]?.usd || '0') || 0)
  }, 0)

  const handleSave = async () => {
    setSaving(true)
    try {
      const rows = activeAccounts
        .filter(acc => balances[acc.id]?.local)
        .map(acc => ({
          bank_account_id: acc.id,
          saldo_inicial: parseFloat(balances[acc.id].local) || 0,
          saldo_inicial_usd: parseFloat(balances[acc.id].usd) || 0,
          saldo_cierre: balances[acc.id].cierre ? parseFloat(balances[acc.id].cierre) : null,
          saldo_cierre_usd: null,
        }))

      if (rows.length === 0) {
        toast({ title: 'Ingresa al menos un saldo', variant: 'destructive' })
        setSaving(false)
        return
      }

      await bulkUpsertDailyBalances(fecha, rows, userEmail)
      toast({ title: 'Saldos guardados', description: `${fecha} — Total: $${totalUSD.toLocaleString('en-US')} USD` })
      // Refresh history
      getDailyBalances().then(setHistory).catch(console.error)
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  // Group history by date
  const historyByDate = (history || []).reduce((acc: Record<string, any[]>, row: any) => {
    if (!acc[row.fecha]) acc[row.fecha] = []
    acc[row.fecha].push(row)
    return acc
  }, {})

  const TIPO_COLORS: Record<string, string> = {
    ahorros: 'bg-blue-100 text-blue-800',
    corriente: 'bg-green-100 text-green-800',
    tdc: 'bg-purple-100 text-purple-800',
  }

  return (
    <div>
      <PageHeader
        title="Saldos Bancarios"
        description="Registro diario de saldos por cuenta"
      />

      {/* Date + Load */}
      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-48"
            />
            <Button variant="outline" size="sm" onClick={() => loadDate(fecha)} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Cargar día
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              const today = new Date().toISOString().split('T')[0]
              setFecha(today)
              loadDate(today)
            }}>
              Hoy
            </Button>
          </div>

          {activeAccounts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No hay cuentas activas. Agrégalas en Configuración {'>'} Cuentas.</p>
          ) : (
            <>
              {/* Header */}
              <div className="grid grid-cols-12 gap-2 px-2 py-2 bg-slate-100 rounded-t-lg text-xs font-semibold text-slate-600">
                <span className="col-span-3">Cuenta</span>
                <span className="col-span-1">Tipo</span>
                <span className="col-span-1">Moneda</span>
                <span className="col-span-3 text-right">Saldo Inicial (local)</span>
                <span className="col-span-2 text-right">Saldo USD</span>
                <span className="col-span-2 text-right">Saldo Cierre</span>
              </div>

              {/* Rows */}
              {activeAccounts.map(acc => (
                <div key={acc.id} className="grid grid-cols-12 gap-2 px-2 py-2 border-b items-center">
                  <div className="col-span-3">
                    <p className="text-sm font-medium">{acc.banco}</p>
                    <p className="text-[10px] text-muted-foreground">{acc.nombre} · {acc.numero}</p>
                  </div>
                  <div className="col-span-1">
                    <Badge variant="outline" className={`text-[10px] ${TIPO_COLORS[acc.tipo] || ''}`}>
                      {acc.tipo.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="col-span-1">
                    <Badge variant="outline" className="text-[10px]">{acc.moneda}</Badge>
                  </div>
                  <div className="col-span-3">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder={`Saldo en ${acc.moneda}`}
                      value={balances[acc.id]?.local || ''}
                      onChange={(e) => handleLocalChange(acc.id, e.target.value, acc.moneda)}
                      className="h-8 text-sm text-right"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="USD"
                      value={balances[acc.id]?.usd || ''}
                      onChange={(e) => setBalances(prev => ({
                        ...prev,
                        [acc.id]: { ...prev[acc.id], usd: e.target.value }
                      }))}
                      className="h-8 text-sm text-right"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Cierre"
                      value={balances[acc.id]?.cierre || ''}
                      onChange={(e) => setBalances(prev => ({
                        ...prev,
                        [acc.id]: { ...prev[acc.id], cierre: e.target.value }
                      }))}
                      className="h-8 text-sm text-right"
                    />
                  </div>
                </div>
              ))}

              {/* Total + Save */}
              <div className="flex items-center justify-between px-2 py-3 bg-slate-50 rounded-b-lg">
                <div>
                  <p className="text-lg font-bold">${totalUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</p>
                  <p className="text-xs text-muted-foreground">Total saldo inicial consolidado</p>
                </div>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Guardar Saldos ({fecha})
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* History */}
      {Object.keys(historyByDate).length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <h3 className="text-sm font-semibold mb-3">Historial de Saldos</h3>
            <div className="space-y-3">
              {Object.entries(historyByDate).sort(([a], [b]) => b.localeCompare(a)).slice(0, 15).map(([date, rows]: [string, any[]]) => {
                const totalDay = rows.reduce((sum: number, r: any) => sum + (Number(r.saldo_inicial_usd) || 0), 0)
                return (
                  <div key={date} className="border rounded-lg p-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">{new Date(date + 'T00:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</span>
                      <span className="text-sm font-bold">${totalDay.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD</span>
                    </div>
                    <div className="space-y-1">
                      {rows.map((r: any) => (
                        <div key={r.id} className="flex justify-between text-xs text-muted-foreground">
                          <span>{r.bank_accounts?.banco || 'Cuenta'} - {r.bank_accounts?.nombre || ''}</span>
                          <span>{Number(r.saldo_inicial).toLocaleString('es-CO')} {r.bank_accounts?.moneda || ''} · ${Number(r.saldo_inicial_usd || 0).toLocaleString('en-US')} USD</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
