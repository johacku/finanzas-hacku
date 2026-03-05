// @ts-nocheck
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { payrollSchema, type PayrollFormData } from '@/lib/validations/payroll.schema'
import { Plus, Pencil, Trash2, Loader2, ArrowUpDown } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { MoreHorizontal } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { createPayrollEntry, updatePayrollEntry, deletePayrollEntry } from '@/actions/payroll.actions'
import { useToast } from '@/hooks/use-toast'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { SociedadBadge } from '@/components/shared/sociedad-badge'
import { formatCurrency } from '@/lib/currency'
import { SOCIEDADES, MONEDAS, EXPENSE_AREAS, COST_SGA, type Sociedad } from '@/lib/constants'
import type { Database } from '@/types/database.types'
import { format, addMonths } from 'date-fns'

type PayrollEntry = Database['public']['Tables']['payroll']['Row']
type PayrollInsert = Database['public']['Tables']['payroll']['Insert']
type MonthlyAmounts = Record<string, number>

interface PayrollPageClientProps {
  initialData: PayrollEntry[]
}

// Generate current month + next 11 months (12 months forward for projection)
function getProjectionMonths(): string[] {
  const months: string[] = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    months.push(format(addMonths(now, i), 'yyyy-MM'))
  }
  return months
}

const PROJECTION_MONTHS = getProjectionMonths()

export function PayrollPageClient({ initialData }: PayrollPageClientProps) {
  const [data, setData] = useState(initialData)
  const [search, setSearch] = useState('')
  const [filterSociedad, setFilterSociedad] = useState<string>('all')
  const [filterActive, setFilterActive] = useState<string>('active')
  const [showForm, setShowForm] = useState(false)
  const [editEntry, setEditEntry] = useState<PayrollEntry | null>(null)
  const [deleteEntry, setDeleteEntry] = useState<PayrollEntry | null>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const { toast } = useToast()

  const form = useForm<PayrollFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(payrollSchema) as any,
    defaultValues: { active: true, cost_sga: 'Cost', ultimo_pago: 0, monthly_amounts: {} },
  })

  const filtered = data.filter((r) => {
    if (filterSociedad !== 'all' && r.sociedad !== filterSociedad) return false
    if (filterActive === 'active' && !r.active) return false
    if (filterActive === 'inactive' && r.active) return false
    if (search && !r.nombre.toLowerCase().includes(search.toLowerCase()) && !r.rol.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const columns: ColumnDef<PayrollEntry>[] = [
    {
      accessorKey: 'nombre',
      header: ({ column }) => (
        <Button variant="ghost" size="sm" className="-ml-3 h-8" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Nombre <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
    },
    { accessorKey: 'rol', header: 'Rol' },
    {
      accessorKey: 'sociedad',
      header: 'Sociedad',
      cell: ({ row }) => <SociedadBadge sociedad={row.original.sociedad as Sociedad} />,
    },
    { accessorKey: 'area', header: 'Área', cell: ({ getValue }) => <span className="text-xs text-slate-600">{getValue() as string}</span> },
    { accessorKey: 'pais', header: 'País' },
    {
      accessorKey: 'cost_sga',
      header: 'Cost/SGA',
      cell: ({ getValue }) => (
        <Badge variant="outline" className={getValue() === 'Cost' ? 'border-blue-300 text-blue-700' : 'border-orange-300 text-orange-700'}>
          {getValue() as string}
        </Badge>
      ),
    },
    {
      accessorKey: 'moneda_pago',
      header: 'Moneda',
      cell: ({ getValue }) => <Badge variant="outline" className="text-xs">{getValue() as string}</Badge>,
    },
    {
      id: 'ultimo_pago',
      header: 'Último Pago',
      cell: ({ row }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const up = (row.original as Record<string, any>).ultimo_pago as number | undefined
        return up ? formatCurrency(up, row.original.moneda_pago) : '—'
      },
    },
    {
      id: 'quincena',
      header: 'Quincena',
      cell: ({ row }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const up = (row.original as Record<string, any>).ultimo_pago as number | undefined
        return up ? formatCurrency(up / 2, row.original.moneda_pago) : '—'
      },
    },
    {
      accessorKey: 'active',
      header: 'Activo',
      cell: ({ getValue }) => getValue() ? <Badge className="bg-green-100 text-green-800 text-xs">Activo</Badge> : <Badge variant="secondary" className="text-xs">Inactivo</Badge>,
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
              setEditEntry(row.original)
              const amounts = row.original.monthly_amounts as MonthlyAmounts
              form.reset({
                nombre: row.original.nombre,
                rol: row.original.rol,
                pais: row.original.pais,
                area: row.original.area,
                moneda_pago: row.original.moneda_pago,
                sociedad: row.original.sociedad,
                cost_sga: row.original.cost_sga,
                active: row.original.active,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ultimo_pago: (row.original as Record<string, any>).ultimo_pago ?? 0,
                monthly_amounts: amounts ?? {},
              })
              setShowForm(true)
            }}>
              <Pencil className="mr-2 h-4 w-4" /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setDeleteEntry(row.original)} className="text-red-600">
              <Trash2 className="mr-2 h-4 w-4" /> Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  async function handleSubmit(formData: PayrollFormData) {
    setFormLoading(true)
    try {
      // Auto-project monthly_amounts from ultimo_pago if no amounts set
      if (formData.ultimo_pago > 0 && Object.keys(formData.monthly_amounts).length === 0) {
        const projected: MonthlyAmounts = {}
        for (const month of PROJECTION_MONTHS) {
          projected[month] = formData.ultimo_pago
        }
        formData.monthly_amounts = projected
      }
      const payload = formData as PayrollInsert
      if (editEntry) {
        await updatePayrollEntry(editEntry.id, payload)
        setData((prev) => prev.map((e) => e.id === editEntry.id ? { ...e, ...payload } : e))
        toast({ title: 'Empleado actualizado' })
      } else {
        await createPayrollEntry(payload)
        toast({ title: 'Empleado creado' })
        window.location.reload()
        return
      }
      setShowForm(false)
      setEditEntry(null)
    } catch (e) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setFormLoading(false)
    }
  }

  async function handleDelete() {
    if (!deleteEntry) return
    setDeleteLoading(true)
    try {
      await deletePayrollEntry(deleteEntry.id)
      setData((prev) => prev.filter((e) => e.id !== deleteEntry.id))
      toast({ title: 'Empleado eliminado' })
    } catch (e) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setDeleteLoading(false)
      setDeleteEntry(null)
    }
  }

  const watchedAmounts = form.watch('monthly_amounts') as MonthlyAmounts

  return (
    <div>
      <PageHeader
        title="Nómina"
        description={`${filtered.length} personas`}
        actions={
          <Button onClick={() => {
            setEditEntry(null)
            form.reset({ active: true, cost_sga: 'Cost', ultimo_pago: 0, monthly_amounts: {} })
            setShowForm(true)
          }}>
            <Plus className="mr-2 h-4 w-4" /> Agregar Persona
          </Button>
        }
      />

      <div className="flex flex-wrap gap-3 mb-4">
        <Input placeholder="Buscar nombre o rol..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Select value={filterSociedad} onValueChange={setFilterSociedad}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Sociedad" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {SOCIEDADES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterActive} onValueChange={setFilterActive}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Activos</SelectItem>
            <SelectItem value="inactive">Inactivos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable columns={columns} data={filtered} />

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editEntry ? 'Editar Empleado' : 'Nuevo Empleado'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="nombre" render={({ field }) => (
                  <FormItem><FormLabel>Nombre *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="rol" render={({ field }) => (
                  <FormItem><FormLabel>Rol *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="sociedad" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sociedad *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{SOCIEDADES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="pais" render={({ field }) => (
                  <FormItem><FormLabel>País *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="area" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Área *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{EXPENSE_AREAS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="moneda_pago" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Moneda Pago *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{MONEDAS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="cost_sga" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cost / SGA *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{COST_SGA.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="active" render={({ field }) => (
                  <FormItem className="flex items-center gap-3 pt-6">
                    <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    <FormLabel className="!mt-0">Activo</FormLabel>
                  </FormItem>
                )} />
              </div>

              <Separator />

              {/* Último Pago + Auto Projection */}
              <div className="space-y-3">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <FormField control={form.control} name="ultimo_pago" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-blue-900 font-semibold">Último Pago Mensual *</FormLabel>
                      <p className="text-xs text-blue-700 mb-2">
                        Este valor se divide entre 2 para proyectar quincenas (15 y último día del mes) por 12 meses.
                      </p>
                      <div className="flex items-center gap-3">
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            className="max-w-xs"
                            value={field.value || ''}
                            onChange={(e) => {
                              const val = e.target.value ? parseFloat(e.target.value) : 0
                              field.onChange(val)
                            }}
                          />
                        </FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const ultimoPago = form.getValues('ultimo_pago')
                            if (!ultimoPago || ultimoPago <= 0) return
                            const projected: MonthlyAmounts = {}
                            for (const month of PROJECTION_MONTHS) {
                              projected[month] = ultimoPago
                            }
                            form.setValue('monthly_amounts', projected)
                          }}
                        >
                          Proyectar 12 meses
                        </Button>
                      </div>
                      {field.value > 0 && (
                        <p className="text-xs text-blue-600 mt-1">
                          Quincena: {formatCurrency(field.value / 2, form.getValues('moneda_pago') || 'USD')} × 2 pagos/mes
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                {/* Monthly Amounts Grid (projected or manual overrides) */}
                <div>
                  <p className="text-sm font-medium text-slate-700 mb-2">Montos Mensuales Proyectados</p>
                  <p className="text-xs text-slate-500 mb-3">
                    Se proyectan desde el último pago. Puedes editar meses individuales si es necesario.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {PROJECTION_MONTHS.map((month) => (
                      <div key={month} className="flex items-center gap-2">
                        <label className="text-xs text-slate-500 w-20 shrink-0">{month}</label>
                        <Input
                          type="number"
                          step="0.01"
                          className="h-7 text-xs"
                          value={watchedAmounts?.[month] ?? ''}
                          onChange={(e) => {
                            const val = e.target.value ? parseFloat(e.target.value) : undefined
                            const current = form.getValues('monthly_amounts') as MonthlyAmounts
                            if (val !== undefined) {
                              form.setValue('monthly_amounts', { ...current, [month]: val })
                            } else {
                              // eslint-disable-next-line @typescript-eslint/no-unused-vars
                              const { [month]: _removed, ...rest } = current
                              form.setValue('monthly_amounts', rest)
                            }
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button type="submit" disabled={formLoading}>
                  {formLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editEntry ? 'Guardar' : 'Crear'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteEntry}
        onClose={() => setDeleteEntry(null)}
        onConfirm={handleDelete}
        title="Eliminar Empleado"
        description={`¿Eliminar a "${deleteEntry?.nombre}"? Esta acción no se puede deshacer.`}
        loading={deleteLoading}
      />
    </div>
  )
}
