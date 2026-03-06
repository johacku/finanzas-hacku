// @ts-nocheck
'use client'

import { ColumnDef } from '@tanstack/react-table'
import type { Database } from '@/types/database.types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Pencil, Trash2, ArrowUpDown, CreditCard } from 'lucide-react'
import { SociedadBadge } from '@/components/shared/sociedad-badge'
import { PRIORIDAD_COLOR_MAP, PRIORIDAD_LABEL_MAP, ESTADO_COLOR_MAP } from '@/lib/constants'
import { formatDateDisplay } from '@/lib/date'
import { formatCurrency } from '@/lib/currency'
import type { Sociedad } from '@/lib/constants'

type ExpenseInvoice = Database['public']['Tables']['expense_invoices']['Row']

interface ColumnActions {
  onEdit: (invoice: ExpenseInvoice) => void
  onDelete: (invoice: ExpenseInvoice) => void
  onPay: (invoice: ExpenseInvoice) => void
}

export function getExpenseInvoiceColumns(actions: ColumnActions): ColumnDef<ExpenseInvoice>[] {
  return [
    {
      accessorKey: 'sociedad',
      header: 'Sociedad',
      cell: ({ row }) => <SociedadBadge sociedad={row.original.sociedad as Sociedad} />,
    },
    {
      accessorKey: 'nombre_proveedor_concepto',
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3 h-8"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Proveedor / Concepto
          <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
    },
    {
      accessorKey: 'tipo',
      header: 'Tipo',
      cell: ({ getValue }) => {
        const tipo = getValue() as string
        return (
          <Badge
            variant="outline"
            className={tipo === 'Cost' ? 'border-blue-300 text-blue-700' : 'border-orange-300 text-orange-700'}
          >
            {tipo}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'area',
      header: 'Área',
      cell: ({ getValue }) => (
        <span className="text-xs text-slate-600">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: 'categoria',
      header: 'Categoría',
      cell: ({ getValue }) => (
        <Badge variant="secondary" className="text-xs">
          {getValue() as string}
        </Badge>
      ),
    },
    {
      accessorKey: 'estado',
      header: 'Estado',
      cell: ({ getValue }) => {
        const estado = (getValue() as string) ?? 'Pendiente'
        const colorClass = ESTADO_COLOR_MAP[estado as keyof typeof ESTADO_COLOR_MAP] ?? 'bg-slate-100 text-slate-700'
        return (
          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
            {estado}
          </span>
        )
      },
    },
    {
      accessorKey: 'moneda',
      header: 'Moneda',
      cell: ({ getValue }) => (
        <Badge variant="outline" className="text-xs">
          {getValue() as string}
        </Badge>
      ),
    },
    {
      accessorKey: 'monto_sin_impuestos',
      header: 'Monto',
      cell: ({ row }) =>
        formatCurrency(row.original.monto_sin_impuestos, row.original.moneda),
    },
    {
      accessorKey: 'fecha_emision',
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3 h-8"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Fecha Emisión
          <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
      cell: ({ getValue }) => formatDateDisplay(getValue() as string),
    },
    {
      accessorKey: 'prioridad_pago',
      header: 'Prioridad',
      cell: ({ getValue }) => {
        const p = getValue() as number | null
        if (!p) return null
        return (
          <span
            className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${PRIORIDAD_COLOR_MAP[p]}`}
          >
            {PRIORIDAD_LABEL_MAP[p]}
          </span>
        )
      },
    },
    {
      accessorKey: 'expectativa_pago',
      header: 'Expectativa Pago',
      cell: ({ getValue }) => {
        const v = getValue() as string | null
        return v ? formatDateDisplay(v) : '—'
      },
    },
    {
      accessorKey: 'fecha_pago_o_cobro',
      header: 'Fecha Pago',
      cell: ({ getValue }) => {
        const v = getValue() as string | null
        return v ? (
          <span className="text-xs font-medium text-green-700">{formatDateDisplay(v)}</span>
        ) : '—'
      },
    },
    {
      accessorKey: 'recurrente',
      header: 'Recurrente',
      cell: ({ row }) =>
        row.original.recurrente ? (
          <Badge className="bg-blue-100 text-blue-800 text-xs">
            {row.original.frecuencia_recurrencia ?? 'Sí'}
          </Badge>
        ) : null,
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
            {row.original.estado !== 'Pagada' && row.original.estado !== 'Anulada' && (
              <DropdownMenuItem onClick={() => actions.onPay(row.original)}>
                <CreditCard className="mr-2 h-4 w-4 text-green-600" />
                Registrar Pago
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => actions.onEdit(row.original)}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => actions.onDelete(row.original)}
              className="text-red-600"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]
}
