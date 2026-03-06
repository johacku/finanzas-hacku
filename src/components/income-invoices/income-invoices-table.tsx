// @ts-nocheck
'use client'

import { useState } from 'react'
import { DataTable } from '@/components/shared/data-table'
import { getIncomeInvoiceColumns } from './income-invoice-columns'
import { IncomeInvoiceForm } from './income-invoice-form'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { CsvImportModal } from '@/components/shared/csv-import-modal'
import { BulkPDFUploadModal } from '@/components/shared/bulk-pdf-upload-modal'
import { QuickPayModal } from '@/components/shared/quick-pay-modal'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Upload, FileUp, CreditCard } from 'lucide-react'
import {
  createIncomeInvoice,
  updateIncomeInvoice,
  deleteIncomeInvoice,
  bulkCreateIncomeInvoices,
} from '@/actions/income-invoices.actions'
import { useToast } from '@/hooks/use-toast'
import type { Database } from '@/types/database.types'
import { SOCIEDADES, MONEDAS, INVOICE_ESTADOS } from '@/lib/constants'
import type { IncomeInvoiceFormData } from '@/lib/validations/income-invoice.schema'
import type { Sociedad, Moneda, InvoiceEstado } from '@/lib/constants'

type IncomeInvoice = Database['public']['Tables']['income_invoices']['Row']
type IncomeInvoiceInsert = Database['public']['Tables']['income_invoices']['Insert']

interface IncomeInvoicesTableProps {
  initialData: IncomeInvoice[]
}

export function IncomeInvoicesTable({ initialData }: IncomeInvoicesTableProps) {
  const [data, setData] = useState(initialData)
  const [search, setSearch] = useState('')
  const [filterSociedad, setFilterSociedad] = useState<string>('')
  const [filterEstado, setFilterEstado] = useState<string>('')
  const [filterMoneda, setFilterMoneda] = useState<string>('')
  const [showForm, setShowForm] = useState(false)
  const [editInvoice, setEditInvoice] = useState<IncomeInvoice | null>(null)
  const [deleteInvoice, setDeleteInvoice] = useState<IncomeInvoice | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [showBulkUpload, setShowBulkUpload] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [payInvoice, setPayInvoice] = useState<IncomeInvoice | null>(null)
  const [showPayModal, setShowPayModal] = useState(false)
  const { toast } = useToast()

  // Client-side filtering
  const filtered = data.filter((row) => {
    if (filterSociedad && filterSociedad !== 'all' && row.sociedad !== filterSociedad) return false
    if (filterEstado && filterEstado !== 'all' && row.estado !== filterEstado) return false
    if (filterMoneda && filterMoneda !== 'all' && row.moneda !== filterMoneda) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        row.razon_social_cliente.toLowerCase().includes(q) ||
        (row.numero_documento ?? '').toLowerCase().includes(q) ||
        (row.vendedor ?? '').toLowerCase().includes(q)
      )
    }
    return true
  })

  const columns = getIncomeInvoiceColumns({
    onEdit: (invoice) => {
      setEditInvoice(invoice)
      setShowForm(true)
    },
    onDelete: (invoice) => setDeleteInvoice(invoice),
    onPay: (invoice) => {
      setPayInvoice(invoice)
      setShowPayModal(true)
    },
  })

  async function handleSubmit(formData: IncomeInvoiceFormData) {
    setFormLoading(true)
    try {
      const payload = formData as IncomeInvoiceInsert
      if (editInvoice) {
        await updateIncomeInvoice(editInvoice.id, payload)
        setData((prev) =>
          prev.map((i) => (i.id === editInvoice.id ? { ...i, ...payload } : i))
        )
        toast({ title: 'Factura actualizada' })
      } else {
        await createIncomeInvoice(payload)
        toast({ title: 'Factura creada' })
        // Refresh to get server-computed total_moneda_local
        window.location.reload()
        return
      }
      setShowForm(false)
      setEditInvoice(null)
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Error inesperado',
        variant: 'destructive',
      })
    } finally {
      setFormLoading(false)
    }
  }

  async function handleDelete() {
    if (!deleteInvoice) return
    setDeleteLoading(true)
    try {
      await deleteIncomeInvoice(deleteInvoice.id)
      setData((prev) => prev.filter((i) => i.id !== deleteInvoice.id))
      toast({ title: 'Factura eliminada' })
    } catch (e) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setDeleteLoading(false)
      setDeleteInvoice(null)
    }
  }

  function transformCsvRow(raw: Record<string, string>): IncomeInvoiceInsert | null {
    try {
      if (!raw.sociedad || !raw.razon_social_cliente || !raw.moneda) return null
      return {
        sociedad: raw.sociedad as Sociedad,
        razon_social_cliente: raw.razon_social_cliente,
        hacku_cliente: raw.hacku_cliente || null,
        tipo_documento: raw.tipo_documento || null,
        numero_documento: raw.numero_documento || null,
        estado: (raw.estado as InvoiceEstado) || 'Pendiente',
        moneda: raw.moneda as Moneda,
        fecha_creacion: raw.fecha_creacion || new Date().toISOString().split('T')[0],
        fecha_vencimiento: raw.fecha_vencimiento || new Date().toISOString().split('T')[0],
        dia_pago_cliente: parseInt(raw.dia_pago_cliente) || 0,
        dia_adelanto_factoraje: raw.dia_adelanto_factoraje ? parseInt(raw.dia_adelanto_factoraje) : null,
        tiene_factoraje: raw.tiene_factoraje?.toLowerCase() === 'true',
        monto_no_recurrente: parseFloat(raw.monto_no_recurrente) || 0,
        monto_creacion_contenido: parseFloat(raw.monto_creacion_contenido) || 0,
        monto_recurrente: parseFloat(raw.monto_recurrente) || 0,
        total_usd: raw.total_usd ? parseFloat(raw.total_usd) : null,
        vendedor: raw.vendedor || null,
        porcentaje_comision: raw.porcentaje_comision ? parseFloat(raw.porcentaje_comision) : null,
        comision_aliado: raw.comision_aliado?.toLowerCase() === 'true',
        porcentaje_comision_aliado: raw.porcentaje_comision_aliado
          ? parseFloat(raw.porcentaje_comision_aliado)
          : null,
      }
    } catch {
      return null
    }
  }

  return (
    <div>
      <PageHeader
        title="Facturas de Ingreso"
        description={`${filtered.length} facturas`}
        actions={
          <>
            <Button variant="outline" onClick={() => setShowBulkUpload(true)}>
              <FileUp className="mr-2 h-4 w-4" />
              Carga Masiva PDF
            </Button>
            <Button variant="outline" onClick={() => setShowImport(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Importar CSV
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowPayModal(true)}
              className="border-green-300 text-green-700 hover:bg-green-50"
            >
              <CreditCard className="mr-2 h-4 w-4" />
              Registrar Cobro
            </Button>
            <Button
              onClick={() => {
                setEditInvoice(null)
                setShowForm(true)
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Nueva Factura
            </Button>
          </>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <Input
          placeholder="Buscar cliente, doc., KAM..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={filterSociedad} onValueChange={setFilterSociedad}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Sociedad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {SOCIEDADES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterEstado} onValueChange={setFilterEstado}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {INVOICE_ESTADOS.map((e) => (
              <SelectItem key={e} value={e}>{e}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterMoneda} onValueChange={setFilterMoneda}>
          <SelectTrigger className="w-28">
            <SelectValue placeholder="Moneda" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {MONEDAS.map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable columns={columns} data={filtered} />

      <IncomeInvoiceForm
        open={showForm}
        onClose={() => {
          setShowForm(false)
          setEditInvoice(null)
        }}
        onSubmit={handleSubmit}
        invoice={editInvoice}
        loading={formLoading}
      />

      <ConfirmDialog
        open={!!deleteInvoice}
        onClose={() => setDeleteInvoice(null)}
        onConfirm={handleDelete}
        title="Eliminar Factura"
        description={`¿Eliminar factura de ${deleteInvoice?.razon_social_cliente}? Esta acción no se puede deshacer.`}
        loading={deleteLoading}
      />

      <CsvImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onImport={bulkCreateIncomeInvoices}
        transformRow={transformCsvRow}
        entityName="Facturas de Ingreso"
      />

      <BulkPDFUploadModal
        open={showBulkUpload}
        onClose={() => {
          setShowBulkUpload(false)
          window.location.reload()
        }}
        invoiceType="income"
        onSaveInvoice={async (data) => {
          const payload = data as IncomeInvoiceInsert
          await createIncomeInvoice(payload)
        }}
      />

      <QuickPayModal
        type="income"
        invoices={data}
        preselectedId={payInvoice?.id ?? null}
        open={showPayModal}
        onClose={() => {
          setShowPayModal(false)
          setPayInvoice(null)
        }}
      />
    </div>
  )
}
