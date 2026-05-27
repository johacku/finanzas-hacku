// @ts-nocheck
'use client'

import { useState } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/shared/data-table'
import { PageHeader } from '@/components/shared/page-header'
import { AlegraInvoiceRequestForm } from './alegra-invoice-request-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Plus, MoreHorizontal, Eye, FileText, CheckCircle, XCircle, ExternalLink, List, LayoutGrid } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { updateAlegraRequestStatus, getAlegraInvoiceDetails } from '@/actions/alegra.actions'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Loader2, RefreshCw } from 'lucide-react'
import { SOCIEDADES } from '@/lib/constants'

type AlegraInvoiceRequest = {
  id: string
  alegra_invoice_id?: string | null
  alegra_client_name: string
  sociedad: string
  moneda: string
  total: number
  total_usd?: number | null
  fecha_emision: string
  fecha_vencimiento: string
  solicitante_email: string
  solicitante_nombre: string
  status: string
  vendedor_nombre?: string | null
  oc_numero?: string | null
  oc_url?: string | null
  alegra_pdf_url?: string | null
  observaciones?: string | null
  anotaciones?: string | null
  created_at: string
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  borrador: { label: 'Borrador', className: 'bg-gray-100 text-gray-800' },
  pendiente_aprobacion: { label: 'Pendiente Aprobación', className: 'bg-yellow-100 text-yellow-800' },
  aprobada: { label: 'Aprobada', className: 'bg-blue-100 text-blue-800' },
  facturada: { label: 'Facturada', className: 'bg-green-100 text-green-800' },
  rechazada: { label: 'Rechazada', className: 'bg-red-100 text-red-800' },
  anulada: { label: 'Anulada', className: 'bg-gray-100 text-gray-800' },
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'borrador', label: 'Borrador' },
  { value: 'pendiente_aprobacion', label: 'Pendiente Aprobación' },
  { value: 'aprobada', label: 'Aprobada' },
  { value: 'facturada', label: 'Facturada' },
  { value: 'rechazada', label: 'Rechazada' },
  { value: 'anulada', label: 'Anulada' },
]

interface AlegraInvoicesTableProps {
  initialData: AlegraInvoiceRequest[]
  userEmail: string
  userName: string
}

function KanbanBoard({ data, onStatusUpdate }: { data: AlegraInvoiceRequest[], onStatusUpdate: (id: string, status: string) => void }) {
  const columns = [
    { key: 'borrador', label: 'Borrador', className: 'border-gray-300' },
    { key: 'pendiente_aprobacion', label: 'Pendiente Aprobación', className: 'border-yellow-400' },
    { key: 'aprobada', label: 'Aprobada', className: 'border-blue-400' },
    { key: 'facturada', label: 'Facturada', className: 'border-green-400' },
    { key: 'rechazada', label: 'Rechazada', className: 'border-red-400' },
    { key: 'anulada', label: 'Anulada', className: 'border-gray-400' },
  ]

  return (
    <div className="grid grid-cols-6 gap-3 overflow-x-auto min-w-[1200px]">
      {columns.map((col) => {
        const items = data.filter((r) => r.status === col.key)
        return (
          <div key={col.key} className={`border-t-4 ${col.className} bg-slate-50 rounded-lg p-2 min-h-[400px]`}>
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="text-xs font-semibold text-slate-600 uppercase">{col.label}</h3>
              <Badge variant="secondary" className="text-xs">{items.length}</Badge>
            </div>
            <div className="space-y-2">
              {items.map((item) => (
                <KanbanCard key={item.id} item={item} onStatusUpdate={onStatusUpdate} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function KanbanCard({ item, onStatusUpdate }: { item: AlegraInvoiceRequest, onStatusUpdate: (id: string, status: string) => void }) {
  return (
    <Card className="p-3 shadow-sm hover:shadow-md transition-shadow cursor-default">
      <div className="space-y-2">
        <p className="text-sm font-medium leading-tight">{item.alegra_client_name}</p>
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">{item.sociedad}</span>
          <span className="text-sm font-semibold">
            {new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(item.total)} {item.moneda}
          </span>
        </div>
        {item.total_usd && item.moneda !== 'USD' && (
          <p className="text-xs text-muted-foreground text-right">
            ≈ {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.total_usd)}
          </p>
        )}
        <div className="flex justify-between items-center text-xs text-muted-foreground">
          <span>{new Date(item.fecha_emision).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}</span>
          <span>{item.vendedor_nombre || item.solicitante_nombre}</span>
        </div>
        {item.oc_numero && (
          <p className="text-xs text-muted-foreground">OC: {item.oc_numero}</p>
        )}
        {/* Quick actions */}
        <div className="flex gap-1 pt-1">
          {item.status === 'pendiente_aprobacion' && (
            <>
              <Button size="sm" variant="outline" className="h-6 text-xs flex-1 text-green-600" onClick={() => onStatusUpdate(item.id, 'aprobada')}>
                Aprobar
              </Button>
              <Button size="sm" variant="outline" className="h-6 text-xs flex-1 text-red-600" onClick={() => onStatusUpdate(item.id, 'rechazada')}>
                Rechazar
              </Button>
            </>
          )}
          {item.status === 'facturada' && item.alegra_pdf_url && (
            <Button size="sm" variant="outline" className="h-6 text-xs flex-1" onClick={() => window.open(item.alegra_pdf_url!, '_blank')}>
              Ver PDF
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}

export function AlegraInvoicesTable({ initialData, userEmail, userName }: AlegraInvoicesTableProps) {
  const [data, setData] = useState(initialData)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [showForm, setShowForm] = useState(false)
  const [detailItem, setDetailItem] = useState<AlegraInvoiceRequest | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [viewMode, setViewMode] = useState<'lista' | 'kanban'>('lista')
  const [filterSociedad, setFilterSociedad] = useState<string>('all')
  const [filterVendedor, setFilterVendedor] = useState<string>('all')
  const [filterFechaDesde, setFilterFechaDesde] = useState<string>('')
  const [filterFechaHasta, setFilterFechaHasta] = useState<string>('')
  const { toast } = useToast()

  const vendedorOptions = [...new Set(data.map(r => r.vendedor_nombre).filter(Boolean))] as string[]

  // Client-side filtering
  const filtered = data.filter((row) => {
    if (filterStatus && filterStatus !== 'all' && row.status !== filterStatus) return false
    if (filterSociedad !== 'all' && row.sociedad !== filterSociedad) return false
    if (filterVendedor !== 'all' && row.vendedor_nombre !== filterVendedor) return false
    if (filterFechaDesde && row.fecha_emision < filterFechaDesde) return false
    if (filterFechaHasta && row.fecha_emision > filterFechaHasta) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        row.alegra_client_name.toLowerCase().includes(q) ||
        row.solicitante_nombre.toLowerCase().includes(q) ||
        (row.oc_numero ?? '').toLowerCase().includes(q) ||
        (row.alegra_invoice_id ?? '').toLowerCase().includes(q)
      )
    }
    return true
  })

  async function handleStatusUpdate(id: string, newStatus: string) {
    try {
      await updateAlegraRequestStatus(id, newStatus)
      setData((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
      )
      toast({ title: 'Estado actualizado' })
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Error al actualizar',
        variant: 'destructive',
      })
    }
  }

  async function handleSyncAlegra(item: AlegraInvoiceRequest) {
    if (!item.alegra_invoice_id || item.alegra_invoice_id === 'nuevo') {
      toast({ title: 'No hay factura en Alegra para sincronizar', variant: 'destructive' })
      return
    }
    setSyncing(true)
    try {
      const alegraInvoice = await getAlegraInvoiceDetails(item.alegra_invoice_id)
      const alegraStatus = alegraInvoice?.status
      let newStatus = item.status
      let pdfUrl = null

      if (alegraStatus === 'open' || alegraStatus === 'closed') {
        newStatus = 'facturada'
        pdfUrl = alegraInvoice?.pdf
      } else if (alegraStatus === 'void') {
        newStatus = 'anulada'
      }

      if (newStatus !== item.status) {
        await updateAlegraRequestStatus(item.id, newStatus, {
          alegra_pdf_url: pdfUrl || undefined,
          alegra_numero_factura: alegraInvoice?.numberTemplate?.text || undefined,
        })
        setData((prev) => prev.map((r) => r.id === item.id ? { ...r, status: newStatus, alegra_pdf_url: pdfUrl || r.alegra_pdf_url } : r))
        setDetailItem((prev) => prev && prev.id === item.id ? { ...prev, status: newStatus, alegra_pdf_url: pdfUrl || prev.alegra_pdf_url } : prev)
        toast({ title: `Estado actualizado a: ${STATUS_CONFIG[newStatus]?.label || newStatus}` })
      } else {
        toast({ title: `Alegra reporta: ${alegraStatus} — sin cambios` })
      }
    } catch (e) {
      toast({ title: 'Error al sincronizar', description: e instanceof Error ? e.message : 'Error', variant: 'destructive' })
    } finally {
      setSyncing(false)
    }
  }

  const columns: ColumnDef<AlegraInvoiceRequest>[] = [
    {
      accessorKey: 'status',
      header: 'Estado',
      cell: ({ row }) => {
        const status = row.original.status
        const config = STATUS_CONFIG[status] || { label: status, className: 'bg-gray-100 text-gray-800' }
        return (
          <Badge variant="outline" className={config.className}>
            {config.label}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'fecha_emision',
      header: 'Fecha',
      cell: ({ row }) => new Date(row.original.fecha_emision).toLocaleDateString('es-CO'),
    },
    {
      accessorKey: 'alegra_client_name',
      header: 'Cliente',
    },
    {
      accessorKey: 'sociedad',
      header: 'Sociedad',
    },
    {
      accessorKey: 'total',
      header: 'Total',
      cell: ({ row }) =>
        new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2 }).format(row.original.total),
    },
    {
      accessorKey: 'moneda',
      header: 'Moneda',
    },
    {
      accessorKey: 'vendedor_nombre',
      header: 'Vendedor/KAM',
      cell: ({ row }) => row.original.vendedor_nombre || '-',
    },
    {
      accessorKey: 'solicitante_nombre',
      header: 'Solicitante',
    },
    {
      accessorKey: 'alegra_invoice_id',
      header: '# Factura Alegra',
      cell: ({ row }) => row.original.alegra_invoice_id || '-',
    },
    {
      id: 'oc',
      header: 'OC',
      cell: ({ row }) => {
        if (row.original.oc_url) {
          return (
            <a
              href={row.original.oc_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline inline-flex items-center gap-1 text-sm"
            >
              {row.original.oc_numero || 'Ver OC'}
              <ExternalLink className="h-3 w-3" />
            </a>
          )
        }
        return row.original.oc_numero || '-'
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const request = row.original
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setDetailItem(request)}>
                <Eye className="mr-2 h-4 w-4" />
                Ver detalles
              </DropdownMenuItem>
              {request.status === 'facturada' && request.alegra_pdf_url && (
                <DropdownMenuItem
                  onClick={() => window.open(request.alegra_pdf_url!, '_blank')}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Ver PDF
                </DropdownMenuItem>
              )}
              {request.alegra_invoice_id && request.alegra_invoice_id !== 'nuevo' && request.status !== 'facturada' && (
                <DropdownMenuItem onClick={() => handleSyncAlegra(request)}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Sincronizar con Alegra
                </DropdownMenuItem>
              )}
              {request.status === 'pendiente_aprobacion' && (
                <>
                  <DropdownMenuItem onClick={() => handleStatusUpdate(request.id, 'aprobada')}>
                    <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                    Aprobar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleStatusUpdate(request.id, 'rechazada')}>
                    <XCircle className="mr-2 h-4 w-4 text-red-600" />
                    Rechazar
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  return (
    <div>
      <PageHeader
        title="Solicitudes de Facturación"
        description={`${filtered.length} solicitudes`}
        actions={
          <div className="flex gap-2">
            <div className="flex border rounded-md">
              <Button
                variant={viewMode === 'lista' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('lista')}
                className="rounded-r-none"
              >
                <List className="h-4 w-4 mr-1" />
                Lista
              </Button>
              <Button
                variant={viewMode === 'kanban' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('kanban')}
                className="rounded-l-none"
              >
                <LayoutGrid className="h-4 w-4 mr-1" />
                Kanban
              </Button>
            </div>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Solicitar Factura
            </Button>
          </div>
        }
      />

      {/* Filters */}
      <div className="space-y-3 mb-4">
        <div className="flex gap-3 flex-wrap">
          <Input
            placeholder="Buscar cliente, solicitante, OC..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterSociedad} onValueChange={setFilterSociedad}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Sociedad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {SOCIEDADES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterVendedor} onValueChange={setFilterVendedor}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Vendedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {vendedorOptions.map((v) => (
                <SelectItem key={v} value={v}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-3 items-center">
          <label className="text-sm text-muted-foreground whitespace-nowrap">Fecha desde:</label>
          <Input
            type="date"
            value={filterFechaDesde}
            onChange={(e) => setFilterFechaDesde(e.target.value)}
            className="w-[160px]"
          />
          <label className="text-sm text-muted-foreground whitespace-nowrap">hasta:</label>
          <Input
            type="date"
            value={filterFechaHasta}
            onChange={(e) => setFilterFechaHasta(e.target.value)}
            className="w-[160px]"
          />
          {(filterSociedad !== 'all' || filterVendedor !== 'all' || filterFechaDesde || filterFechaHasta) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilterSociedad('all')
                setFilterVendedor('all')
                setFilterFechaDesde('')
                setFilterFechaHasta('')
              }}
            >
              Limpiar filtros
            </Button>
          )}
        </div>
      </div>

      {viewMode === 'lista' ? (
        <DataTable columns={columns} data={filtered} />
      ) : (
        <KanbanBoard data={filtered} onStatusUpdate={handleStatusUpdate} />
      )}

      {showForm && (
        <AlegraInvoiceRequestForm
          open={showForm}
          onOpenChange={setShowForm}
          onSuccess={() => window.location.reload()}
          userEmail={userEmail}
          userName={userName}
        />
      )}

      {/* Detail Modal */}
      <Dialog open={!!detailItem} onOpenChange={(open) => !open && setDetailItem(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle de Solicitud</DialogTitle>
          </DialogHeader>
          {detailItem && (
            <div className="space-y-4">
              {/* Status + Actions */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Estado:</span>
                  <Badge variant="outline" className={STATUS_CONFIG[detailItem.status]?.className}>
                    {STATUS_CONFIG[detailItem.status]?.label || detailItem.status}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  {detailItem.alegra_invoice_id && detailItem.alegra_invoice_id !== 'nuevo' && detailItem.status !== 'facturada' && (
                    <Button size="sm" variant="outline" onClick={() => handleSyncAlegra(detailItem)} disabled={syncing}>
                      {syncing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                      Sincronizar Alegra
                    </Button>
                  )}
                </div>
              </div>

              {/* Change status manually */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground whitespace-nowrap">Cambiar estado:</span>
                <Select
                  value={detailItem.status}
                  onValueChange={async (newStatus) => {
                    await handleStatusUpdate(detailItem.id, newStatus)
                    setDetailItem({ ...detailItem, status: newStatus })
                  }}
                >
                  <SelectTrigger className="w-[220px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>{config.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Cliente</span>
                  <p className="font-medium">{detailItem.alegra_client_name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Sociedad</span>
                  <p className="font-medium">{detailItem.sociedad}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Total</span>
                  <p className="font-medium">{new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2 }).format(detailItem.total)} {detailItem.moneda}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Total USD</span>
                  <p className="font-medium">{detailItem.total_usd ? `$${new Intl.NumberFormat('en-US').format(detailItem.total_usd)}` : '—'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Fecha Emisión</span>
                  <p className="font-medium">{new Date(detailItem.fecha_emision).toLocaleDateString('es-CO')}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Fecha Vencimiento</span>
                  <p className="font-medium">{new Date(detailItem.fecha_vencimiento).toLocaleDateString('es-CO')}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Vendedor/KAM</span>
                  <p className="font-medium">{detailItem.vendedor_nombre || '—'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Solicitante</span>
                  <p className="font-medium">{detailItem.solicitante_nombre}</p>
                </div>
                {detailItem.alegra_invoice_id && (
                  <div>
                    <span className="text-muted-foreground"># Factura Alegra</span>
                    <p className="font-medium">{detailItem.alegra_invoice_id}</p>
                  </div>
                )}
                {detailItem.oc_numero && (
                  <div>
                    <span className="text-muted-foreground">OC</span>
                    <p className="font-medium">
                      {detailItem.oc_url ? (
                        <a href={detailItem.oc_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          {detailItem.oc_numero}
                        </a>
                      ) : detailItem.oc_numero}
                    </p>
                  </div>
                )}
              </div>

              {/* Observaciones */}
              {detailItem.observaciones && (
                <>
                  <Separator />
                  <div>
                    <span className="text-sm text-muted-foreground">Observaciones</span>
                    <p className="text-sm whitespace-pre-wrap mt-1">{detailItem.observaciones}</p>
                  </div>
                </>
              )}

              {/* Anotaciones */}
              {detailItem.anotaciones && (
                <div>
                  <span className="text-sm text-muted-foreground">Anotaciones (PDF)</span>
                  <p className="text-sm whitespace-pre-wrap mt-1">{detailItem.anotaciones}</p>
                </div>
              )}

              {/* PDF link */}
              {detailItem.alegra_pdf_url && (
                <>
                  <Separator />
                  <Button variant="outline" onClick={() => window.open(detailItem.alegra_pdf_url!, '_blank')}>
                    <FileText className="h-4 w-4 mr-2" />
                    Ver PDF de Alegra
                  </Button>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
