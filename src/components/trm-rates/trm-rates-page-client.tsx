// @ts-nocheck
'use client'

import { useState } from 'react'
import { DataTable } from '@/components/shared/data-table'
import { ColumnDef } from '@tanstack/react-table'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { trmRateSchema, type TrmRateFormData } from '@/lib/validations/trm-rate.schema'
import { Plus, Pencil, Trash2, ArrowUpDown, Loader2 } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { MoreHorizontal } from 'lucide-react'
import { upsertTrmRate, deleteTrmRate } from '@/actions/trm-rates.actions'
import { useToast } from '@/hooks/use-toast'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { formatDateDisplay } from '@/lib/date'
import { CURRENCY_PAIRS } from '@/lib/constants'
import type { Database } from '@/types/database.types'

type TrmRate = Database['public']['Tables']['trm_rates']['Row']

interface TrmRatesPageClientProps {
  initialData: TrmRate[]
}

export function TrmRatesPageClient({ initialData }: TrmRatesPageClientProps) {
  const [data, setData] = useState(initialData)
  const [showForm, setShowForm] = useState(false)
  const [editRate, setEditRate] = useState<TrmRate | null>(null)
  const [deleteRate, setDeleteRate] = useState<TrmRate | null>(null)
  const [filterPar, setFilterPar] = useState<string>('all')
  const [formLoading, setFormLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const { toast } = useToast()

  const form = useForm<TrmRateFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(trmRateSchema) as any,
    defaultValues: {
      fecha: new Date().toISOString().split('T')[0],
      tasa_cierre: 0,
    },
  })

  const filtered = data.filter((r) =>
    filterPar === 'all' ? true : r.par === filterPar
  )

  const columns: ColumnDef<TrmRate>[] = [
    {
      accessorKey: 'par',
      header: ({ column }) => (
        <Button variant="ghost" size="sm" className="-ml-3 h-8" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Par <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
    },
    {
      accessorKey: 'fecha',
      header: ({ column }) => (
        <Button variant="ghost" size="sm" className="-ml-3 h-8" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Fecha <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
      cell: ({ getValue }) => formatDateDisplay(getValue() as string),
    },
    {
      accessorKey: 'tasa_cierre',
      header: 'Tasa Cierre',
      cell: ({ getValue }) => (getValue() as number).toLocaleString('en-US', { maximumFractionDigits: 4 }),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => { setEditRate(row.original); form.reset({ par: row.original.par, fecha: row.original.fecha, tasa_cierre: row.original.tasa_cierre }); setShowForm(true) }}>
              <Pencil className="mr-2 h-4 w-4" /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setDeleteRate(row.original)} className="text-red-600">
              <Trash2 className="mr-2 h-4 w-4" /> Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  async function handleSubmit(formData: TrmRateFormData) {
    setFormLoading(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await upsertTrmRate(formData as any)
      toast({ title: 'Tasa guardada' })
      setShowForm(false)
      setEditRate(null)
      form.reset()
      window.location.reload()
    } catch (e) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setFormLoading(false)
    }
  }

  async function handleDelete() {
    if (!deleteRate) return
    setDeleteLoading(true)
    try {
      await deleteTrmRate(deleteRate.id)
      setData((prev) => prev.filter((r) => r.id !== deleteRate.id))
      toast({ title: 'Tasa eliminada' })
    } catch (e) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setDeleteLoading(false)
      setDeleteRate(null)
    }
  }

  return (
    <div>
      <PageHeader
        title="TRM / Tasas de Cambio"
        description="Tasas diarias USD → moneda local"
        actions={
          <Button onClick={() => { setEditRate(null); form.reset({ fecha: new Date().toISOString().split('T')[0], tasa_cierre: 0 }); setShowForm(true) }}>
            <Plus className="mr-2 h-4 w-4" /> Nueva Tasa
          </Button>
        }
      />

      <div className="mb-4">
        <Select value={filterPar} onValueChange={setFilterPar}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Par" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {CURRENCY_PAIRS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <DataTable columns={columns} data={filtered} />

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editRate ? 'Editar Tasa' : 'Nueva Tasa'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="par"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Par *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {CURRENCY_PAIRS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="fecha"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha *</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tasa_cierre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tasa Cierre *</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.0001" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button type="submit" disabled={formLoading}>
                  {formLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Guardar
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteRate}
        onClose={() => setDeleteRate(null)}
        onConfirm={handleDelete}
        title="Eliminar Tasa"
        description={`¿Eliminar tasa ${deleteRate?.par} del ${deleteRate?.fecha}?`}
        loading={deleteLoading}
      />
    </div>
  )
}
