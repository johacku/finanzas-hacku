// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { formatCurrency } from '@/lib/currency'
import {
  markIncomeInvoicePaid,
  cancelIncomeInvoice,
} from '@/actions/income-invoices.actions'
import {
  markExpenseInvoicePaid,
  cancelExpenseInvoice,
} from '@/actions/expense-invoices.actions'

type InvoiceType = 'income' | 'expense'

interface QuickPayModalProps {
  type: InvoiceType
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  invoices: any[]
  preselectedId?: string | null
  lockedToPreselected?: boolean // When true, can't change invoice (row action)
  open: boolean
  onClose: () => void
}

function getTodayStr() {
  return new Date().toISOString().split('T')[0]
}

function getLabel(invoice: any, type: InvoiceType): string {
  if (type === 'income') {
    const amount = invoice.total_usd
      ? formatCurrency(invoice.total_usd, 'USD')
      : formatCurrency(invoice.total_moneda_local, invoice.moneda)
    const doc = invoice.numero_documento ? `[${invoice.numero_documento}] ` : ''
    return `${doc}${invoice.razon_social_cliente} — ${amount}`
  } else {
    const amount = invoice.monto_usd
      ? formatCurrency(invoice.monto_usd, 'USD')
      : formatCurrency(invoice.monto_sin_impuestos ?? invoice.monto_presupuestado, invoice.moneda)
    const doc = invoice.numero_documento ? `[${invoice.numero_documento}] ` : ''
    return `${doc}${invoice.nombre_proveedor_concepto} — ${amount}`
  }
}

export function QuickPayModal({
  type,
  invoices,
  preselectedId,
  lockedToPreselected = false,
  open,
  onClose,
}: QuickPayModalProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()

  // Filter out already-paid and cancelled invoices
  const unpaid = invoices.filter(
    (i) => i.estado !== 'Pagada' && i.estado !== 'Anulada'
  )

  const [selectedId, setSelectedId] = useState<string>(preselectedId ?? unpaid[0]?.id ?? '')
  const [newEstado, setNewEstado] = useState<'Pagada' | 'Anulada'>('Pagada')
  const [fechaPago, setFechaPago] = useState(getTodayStr())
  const [searchQuery, setSearchQuery] = useState('')

  // Filter unpaid invoices by search query
  const filteredUnpaid = searchQuery.trim()
    ? unpaid.filter((inv) => {
        const q = searchQuery.toLowerCase()
        const label = getLabel(inv, type).toLowerCase()
        return label.includes(q)
      })
    : unpaid

  // Reset when modal opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setSelectedId(preselectedId ?? unpaid[0]?.id ?? '')
      setNewEstado('Pagada')
      setFechaPago(getTodayStr())
      setSearchQuery('')
    } else {
      onClose()
    }
  }

  const handleConfirm = () => {
    if (!selectedId) {
      toast({ title: 'Selecciona una factura', variant: 'destructive' })
      return
    }
    if (newEstado === 'Pagada' && !fechaPago) {
      toast({ title: 'Ingresa la fecha de pago', variant: 'destructive' })
      return
    }

    startTransition(async () => {
      try {
        if (type === 'income') {
          if (newEstado === 'Pagada') {
            await markIncomeInvoicePaid(selectedId, fechaPago)
          } else {
            await cancelIncomeInvoice(selectedId)
          }
        } else {
          if (newEstado === 'Pagada') {
            await markExpenseInvoicePaid(selectedId, fechaPago)
          } else {
            await cancelExpenseInvoice(selectedId)
          }
        }
        toast({
          title: newEstado === 'Pagada' ? 'Pago registrado' : 'Factura anulada',
          description:
            newEstado === 'Pagada'
              ? `Marcada como pagada el ${fechaPago}`
              : 'Factura marcada como anulada',
        })
        router.refresh()
        onClose()
      } catch (err: any) {
        toast({
          title: 'Error al actualizar',
          description: err?.message ?? 'Intenta de nuevo',
          variant: 'destructive',
        })
      }
    })
  }

  const title = type === 'income' ? 'Registrar Cobro' : 'Registrar Pago de Gasto'

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {unpaid.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">
              No hay facturas pendientes de pago.
            </p>
          ) : (
            <>
              {/* Invoice selector */}
              <div className="space-y-1.5">
                <Label>
                  {type === 'income' ? 'Factura de ingreso' : 'Gasto'}
                </Label>
                {lockedToPreselected && preselectedId ? (
                  // Locked mode: show the selected invoice as read-only
                  <div className="rounded-md border px-3 py-2 text-sm bg-slate-50">
                    {(() => {
                      const inv = unpaid.find((i) => i.id === preselectedId)
                      return inv ? getLabel(inv, type) : 'Factura seleccionada'
                    })()}
                  </div>
                ) : (
                  // Search mode: show searchable input + filtered list
                  <div className="space-y-2">
                    <Input
                      placeholder="Buscar por N° factura o cliente..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full"
                    />
                    <Select value={selectedId} onValueChange={setSelectedId}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Seleccionar factura..." />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredUnpaid.map((inv) => (
                          <SelectItem key={inv.id} value={inv.id}>
                            {getLabel(inv, type)}
                          </SelectItem>
                        ))}
                        {filteredUnpaid.length === 0 && (
                          <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                            Sin resultados
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* New status */}
              <div className="space-y-1.5">
                <Label>Nuevo estado</Label>
                <Select
                  value={newEstado}
                  onValueChange={(v) => setNewEstado(v as 'Pagada' | 'Anulada')}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pagada">Pagada</SelectItem>
                    <SelectItem value="Anulada">Anulada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Payment date — only when Pagada */}
              {newEstado === 'Pagada' && (
                <div className="space-y-1.5">
                  <Label>Fecha de pago</Label>
                  <Input
                    type="date"
                    value={fechaPago}
                    onChange={(e) => setFechaPago(e.target.value)}
                    max={getTodayStr()}
                  />
                  <p className="text-xs text-slate-500">
                    Esta fecha se usará para reflejar el pago en el flujo real del gráfico.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          {unpaid.length > 0 && (
            <Button
              onClick={handleConfirm}
              disabled={isPending || !selectedId}
              className={
                newEstado === 'Pagada'
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }
            >
              {isPending ? 'Guardando...' : `Confirmar ${newEstado}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
