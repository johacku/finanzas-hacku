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
import { Plus, MoreHorizontal, Eye, FileText, CheckCircle, XCircle, ExternalLink } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { updateAlegraRequestStatus } from '@/actions/alegra.actions'
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

export function AlegraInvoicesTable({ initialData, userEmail, userName }: AlegraInvoicesTableProps) {
  const [data, setData] = useState(initialData)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [showForm, setShowForm] = useState(false)
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
              <DropdownMenuItem>
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
              {request.status === 'pendiente_aprobacion' && (
                <>
                  <DropdownMenuItem
                    onClick={() => handleStatusUpdate(request.id, 'aprobada')}
                  >
                    <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                    Aprobar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleStatusUpdate(request.id, 'rechazada')}
                  >
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
          <Button onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Solicitar Factura
          </Button>
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

      <DataTable columns={columns} data={filtered} />

      {showForm && (
        <AlegraInvoiceRequestForm
          open={showForm}
          onOpenChange={setShowForm}
          onSuccess={() => window.location.reload()}
          userEmail={userEmail}
          userName={userName}
        />
      )}
    </div>
  )
}
