// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Loader2, Search, Download, CheckCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { searchAlegraInvoices, importAlegraInvoice } from '@/actions/alegra.actions'

interface Props {
  open: boolean
  onClose: () => void
}

export function AlegraImportModal({ open, onClose }: Props) {
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [fromDate, setFromDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  const [invoices, setInvoices] = useState<any[]>([])
  const [importing, setImporting] = useState<string | null>(null)
  const [imported, setImported] = useState<Set<string>>(new Set())

  const handleSearch = async () => {
    setLoading(true)
    try {
      const results = await searchAlegraInvoices(search || undefined, fromDate)
      setInvoices(results)
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Error al buscar', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async (alegraId: string, fullNumber: string) => {
    setImporting(alegraId)
    try {
      const result = await importAlegraInvoice(alegraId)
      toast({ title: 'Importada', description: `${result.numero_documento} - ${result.cliente}` })
      setImported(prev => new Set([...prev, fullNumber]))
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Error al importar', variant: 'destructive' })
    } finally {
      setImporting(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Facturas desde Alegra</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-xs font-medium">Buscar cliente o factura</label>
            <Input
              placeholder="Nombre del cliente o N° factura..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-medium">Desde</label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="mt-1 w-40" />
          </div>
          <Button onClick={handleSearch} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-1" />}
            Buscar
          </Button>
        </div>

        {invoices.length > 0 && (
          <div className="border rounded-lg overflow-hidden mt-4">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs">N° Factura</th>
                  <th className="px-3 py-2 text-left text-xs">Cliente</th>
                  <th className="px-3 py-2 text-left text-xs">Fecha</th>
                  <th className="px-3 py-2 text-right text-xs">Total</th>
                  <th className="px-3 py-2 text-left text-xs">Moneda</th>
                  <th className="px-3 py-2 text-left text-xs">Estado Alegra</th>
                  <th className="px-3 py-2 text-xs"></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const isImported = inv.alreadyImported || imported.has(inv.fullNumber)
                  return (
                    <tr key={inv.alegra_id} className="border-t hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium text-xs">{inv.fullNumber}</td>
                      <td className="px-3 py-2 text-xs truncate max-w-[200px]">{inv.clientName}</td>
                      <td className="px-3 py-2 text-xs">{inv.date}</td>
                      <td className="px-3 py-2 text-xs text-right font-medium">
                        {new Intl.NumberFormat('es-CO').format(inv.total)}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <Badge variant="outline" className="text-[10px]">{inv.currency}</Badge>
                      </td>
                      <td className="px-3 py-2 text-xs">{inv.status}</td>
                      <td className="px-3 py-2">
                        {isImported ? (
                          <Badge className="bg-green-100 text-green-800 text-[10px]">
                            <CheckCircle className="h-3 w-3 mr-1" /> Ya existe
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            disabled={importing === inv.alegra_id}
                            onClick={() => handleImport(inv.alegra_id, inv.fullNumber)}
                          >
                            {importing === inv.alegra_id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <><Download className="h-3 w-3 mr-1" /> Importar</>
                            )}
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {invoices.length === 0 && !loading && (
          <p className="text-center text-muted-foreground text-sm py-8">
            Busca facturas en Alegra por cliente o N° de factura
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
