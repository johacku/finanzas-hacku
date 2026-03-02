// @ts-nocheck
'use client'

import { useState } from 'react'
import { DataTable } from '@/components/shared/data-table'
import { getExpenseInvoiceColumns } from './expense-invoice-columns'
import { ExpenseInvoiceForm } from './expense-invoice-form'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { CsvImportModal } from '@/components/shared/csv-import-modal'
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
import { Plus, Upload } from 'lucide-react'
import {
  createExpenseInvoice,
  updateExpenseInvoice,
  deleteExpenseInvoice,
  bulkCreateExpenseInvoices,
} from '@/actions/expense-invoices.actions'
import { useToast } from '@/hooks/use-toast'
import type { Database } from '@/types/database.types'
import {
  SOCIEDADES,
  EXPENSE_TIPOS,
  EXPENSE_AREAS,
  EXPENSE_CATEGORIAS,
} from '@/lib/constants'
import type { ExpenseInvoiceFormData } from '@/lib/validations/expense-invoice.schema'
import type { Sociedad, ExpenseTipo, ExpenseArea, ExpenseCategoria, Moneda } from '@/lib/constants'

type ExpenseInvoice = Database['public']['Tables']['expense_invoices']['Row']
type ExpenseInvoiceInsert = Database['public']['Tables']['expense_invoices']['Insert']

interface ExpenseInvoicesTableProps {
  initialData: ExpenseInvoice[]
}

export function ExpenseInvoicesTable({ initialData }: ExpenseInvoicesTableProps) {
  const [data, setData] = useState(initialData)
  const [search, setSearch] = useState('')
  const [filterSociedad, setFilterSociedad] = useState<string>('')
  const [filterTipo, setFilterTipo] = useState<string>('')
  const [filterArea, setFilterArea] = useState<string>('')
  const [filterCategoria, setFilterCategoria] = useState<string>('')
  const [showForm, setShowForm] = useState(false)
  const [editInvoice, setEditInvoice] = useState<ExpenseInvoice | null>(null)
  const [deleteInvoice, setDeleteInvoice] = useState<ExpenseInvoice | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [formLoading, setFormLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const { toast } = useToast()

  const filtered = data.filter((row) => {
    if (filterSociedad && filterSociedad !== 'all' && row.sociedad !== filterSociedad) return false
    if (filterTipo && filterTipo !== 'all' && row.tipo !== filterTipo) return false
    if (filterArea && filterArea !== 'all' && row.area !== filterArea) return false
    if (filterCategoria && filterCategoria !== 'all' && row.categoria !== filterCategoria) return false
    if (search && !row.nombre_proveedor_concepto.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const columns = getExpenseInvoiceColumns({
    onEdit: (invoice) => {
      setEditInvoice(invoice)
      setShowForm(true)
    },
    onDelete: (invoice) => setDeleteInvoice(invoice),
  })

  async function handleSubmit(formData: ExpenseInvoiceFormData) {
    setFormLoading(true)
    try {
      const payload = formData as ExpenseInvoiceInsert
      if (editInvoice) {
        await updateExpenseInvoice(editInvoice.id, payload)
        setData((prev) => prev.map((i) => (i.id === editInvoice.id ? { ...i, ...payload } : i)))
        toast({ title: 'Gasto actualizado' })
      } else {
        await createExpenseInvoice(payload)
        toast({ title: 'Gasto creado' })
        window.location.reload()
        return
      }
      setShowForm(false)
      setEditInvoice(null)
    } catch (e) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setFormLoading(false)
    }
  }

  async function handleDelete() {
    if (!deleteInvoice) return
    setDeleteLoading(true)
    try {
      await deleteExpenseInvoice(deleteInvoice.id)
      setData((prev) => prev.filter((i) => i.id !== deleteInvoice.id))
      toast({ title: 'Gasto eliminado' })
    } catch (e) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setDeleteLoading(false)
      setDeleteInvoice(null)
    }
  }

  function transformCsvRow(raw: Record<string, string>): ExpenseInvoiceInsert | null {
    try {
      if (!raw.sociedad || !raw.nombre_proveedor_concepto || !raw.moneda) return null
      return {
        sociedad: raw.sociedad as Sociedad,
        tipo: (raw.tipo as ExpenseTipo) || 'Cost',
        area: (raw.area as ExpenseArea) || 'Global',
        fecha_emision: raw.fecha_emision || new Date().toISOString().split('T')[0],
        nombre_proveedor_concepto: raw.nombre_proveedor_concepto,
        moneda: raw.moneda as Moneda,
        monto_sin_impuestos: parseFloat(raw.monto_sin_impuestos) || 0,
        categoria: (raw.categoria as ExpenseCategoria) || 'Other',
        recurrente: raw.recurrente?.toLowerCase() === 'true',
        como_se_pagara: raw.como_se_pagara || null,
        prioridad_pago: raw.prioridad_pago ? parseInt(raw.prioridad_pago) : null,
        expectativa_pago: raw.expectativa_pago || null,
      }
    } catch {
      return null
    }
  }

  return (
    <div>
      <PageHeader
        title="Facturas de Gasto"
        description={`${filtered.length} gastos`}
        actions={
          <>
            <Button variant="outline" onClick={() => setShowImport(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Importar CSV
            </Button>
            <Button onClick={() => { setEditInvoice(null); setShowForm(true) }}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Gasto
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap gap-3 mb-4">
        <Input
          placeholder="Buscar proveedor..."
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
            {SOCIEDADES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="w-28">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {EXPENSE_TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterArea} onValueChange={setFilterArea}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Área" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {EXPENSE_AREAS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterCategoria} onValueChange={setFilterCategoria}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {EXPENSE_CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <DataTable columns={columns} data={filtered} />

      <ExpenseInvoiceForm
        open={showForm}
        onClose={() => { setShowForm(false); setEditInvoice(null) }}
        onSubmit={handleSubmit}
        invoice={editInvoice}
        loading={formLoading}
      />

      <ConfirmDialog
        open={!!deleteInvoice}
        onClose={() => setDeleteInvoice(null)}
        onConfirm={handleDelete}
        title="Eliminar Gasto"
        description={`¿Eliminar "${deleteInvoice?.nombre_proveedor_concepto}"?`}
        loading={deleteLoading}
      />

      <CsvImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onImport={bulkCreateExpenseInvoices}
        transformRow={transformCsvRow}
        entityName="Facturas de Gasto"
      />
    </div>
  )
}
