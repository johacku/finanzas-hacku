'use client'

import { useState } from 'react'
import { DataTable } from '@/components/shared/data-table'
import { ColumnDef } from '@tanstack/react-table'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { customerSchema, type CustomerFormData } from '@/lib/validations/customer.schema'
import { Plus, Pencil, Trash2, Loader2, ArrowUpDown } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { MoreHorizontal } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { createCustomer, updateCustomer, deleteCustomer } from '@/actions/customers.actions'
import { useToast } from '@/hooks/use-toast'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import type { Database } from '@/types/database.types'

type Customer = Database['public']['Tables']['customers']['Row']
type CustomerInsert = Database['public']['Tables']['customers']['Insert']

interface CustomersPageClientProps {
  initialData: Customer[]
}

export function CustomersPageClient({ initialData }: CustomersPageClientProps) {
  const [data, setData] = useState(initialData)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null)
  const [deleteCustomerItem, setDeleteCustomerItem] = useState<Customer | null>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const { toast } = useToast()

  const form = useForm<CustomerFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(customerSchema) as any,
    defaultValues: { tiene_factoraje: false },
  })

  const filtered = data.filter((c) =>
    search
      ? c.nombre_cliente.toLowerCase().includes(search.toLowerCase()) ||
        (c.kam_responsable ?? '').toLowerCase().includes(search.toLowerCase())
      : true
  )

  const columns: ColumnDef<Customer>[] = [
    {
      accessorKey: 'nombre_cliente',
      header: ({ column }) => (
        <Button variant="ghost" size="sm" className="-ml-3 h-8" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Cliente <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
    },
    { accessorKey: 'sociedad_cliente', header: 'Sociedad', cell: ({ getValue }) => getValue() ?? '—' },
    { accessorKey: 'pais', header: 'País', cell: ({ getValue }) => getValue() ?? '—' },
    { accessorKey: 'industria', header: 'Industria', cell: ({ getValue }) => getValue() ?? '—' },
    { accessorKey: 'kam_responsable', header: 'KAM', cell: ({ getValue }) => getValue() ?? '—' },
    { accessorKey: 'plan_actual', header: 'Plan', cell: ({ getValue }) => getValue() ? <Badge variant="outline">{getValue() as string}</Badge> : null },
    {
      accessorKey: 'tiene_factoraje',
      header: 'Factoraje',
      cell: ({ getValue }) => getValue() ? <Badge className="bg-purple-100 text-purple-800 text-xs">Sí</Badge> : null,
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => {
              setEditCustomer(row.original)
              form.reset({
                nombre_cliente: row.original.nombre_cliente,
                sociedad_cliente: row.original.sociedad_cliente ?? undefined,
                pais: row.original.pais ?? undefined,
                ciudad: row.original.ciudad ?? undefined,
                industria: row.original.industria ?? undefined,
                kam_responsable: row.original.kam_responsable ?? undefined,
                plan_actual: row.original.plan_actual ?? undefined,
                tiene_factoraje: row.original.tiene_factoraje,
                comentarios_factoraje: row.original.comentarios_factoraje ?? undefined,
              })
              setShowForm(true)
            }}>
              <Pencil className="mr-2 h-4 w-4" /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setDeleteCustomerItem(row.original)} className="text-red-600">
              <Trash2 className="mr-2 h-4 w-4" /> Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  async function handleSubmit(formData: CustomerFormData) {
    setFormLoading(true)
    try {
      if (editCustomer) {
        await updateCustomer(editCustomer.id, formData as CustomerInsert)
        setData((prev) => prev.map((c) => c.id === editCustomer.id ? { ...c, ...formData } : c))
        toast({ title: 'Cliente actualizado' })
      } else {
        await createCustomer(formData as CustomerInsert)
        toast({ title: 'Cliente creado' })
        window.location.reload()
        return
      }
      setShowForm(false)
      setEditCustomer(null)
    } catch (e) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setFormLoading(false)
    }
  }

  async function handleDelete() {
    if (!deleteCustomerItem) return
    setDeleteLoading(true)
    try {
      await deleteCustomer(deleteCustomerItem.id)
      setData((prev) => prev.filter((c) => c.id !== deleteCustomerItem.id))
      toast({ title: 'Cliente eliminado' })
    } catch (e) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setDeleteLoading(false)
      setDeleteCustomerItem(null)
    }
  }

  const tieneFactoraje = form.watch('tiene_factoraje')

  return (
    <div>
      <PageHeader
        title="Clientes"
        description={`${filtered.length} clientes`}
        actions={
          <Button onClick={() => { setEditCustomer(null); form.reset({ tiene_factoraje: false }); setShowForm(true) }}>
            <Plus className="mr-2 h-4 w-4" /> Nuevo Cliente
          </Button>
        }
      />

      <div className="mb-4">
        <Input placeholder="Buscar cliente o KAM..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
      </div>

      <DataTable columns={columns} data={filtered} />

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editCustomer ? 'Editar Cliente' : 'Nuevo Cliente'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="nombre_cliente" render={({ field }) => (
                  <FormItem><FormLabel>Nombre *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="sociedad_cliente" render={({ field }) => (
                  <FormItem><FormLabel>Sociedad</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="pais" render={({ field }) => (
                  <FormItem><FormLabel>País</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="ciudad" render={({ field }) => (
                  <FormItem><FormLabel>Ciudad</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="industria" render={({ field }) => (
                  <FormItem><FormLabel>Industria</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="kam_responsable" render={({ field }) => (
                  <FormItem><FormLabel>KAM Responsable</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="plan_actual" render={({ field }) => (
                  <FormItem><FormLabel>Plan Actual</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="tiene_factoraje" render={({ field }) => (
                <FormItem className="flex items-center gap-3">
                  <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  <FormLabel className="!mt-0">¿Tiene Factoraje?</FormLabel>
                </FormItem>
              )} />
              {tieneFactoraje && (
                <FormField control={form.control} name="comentarios_factoraje" render={({ field }) => (
                  <FormItem><FormLabel>Comentarios Factoraje</FormLabel><FormControl><Input {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                )} />
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button type="submit" disabled={formLoading}>
                  {formLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editCustomer ? 'Guardar' : 'Crear'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteCustomerItem}
        onClose={() => setDeleteCustomerItem(null)}
        onConfirm={handleDelete}
        title="Eliminar Cliente"
        description={`¿Eliminar "${deleteCustomerItem?.nombre_cliente}"?`}
        loading={deleteLoading}
      />
    </div>
  )
}
