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
import { MoreHorizontal, Pencil, Trash2, CreditCard } from 'lucide-react'
import { SociedadBadge } from '@/components/shared/sociedad-badge'
import { ESTADO_COLOR_MAP } from '@/lib/constants'
import { formatDateDisplay } from '@/lib/date'
import { formatCurrency } from '@/lib/currency'
import type { Sociedad, InvoiceEstado } from '@/lib/constants'
import { ArrowUpDown } from 'lucide-react'

type IncomeInvoice = Database['public']['Tables']['income_invoices']['Row']

interface ColumnActions {
  onEdit: (invoice: IncomeInvoice) => void
  onDelete: (invoice: IncomeInvoice) => void
  onPay: (invoice: IncomeInvoice) => void
}

export function getIncomeInvoiceColumns(actions: ColumnActions): ColumnDef<IncomeInvoice>[] {
  return [
    {
      accessorKey: 'sociedad',
      header: 'Sociedad',
      cell: ({ row }) => (
        <SociedadBadge sociedad={row.original.sociedad as Sociedad} className="text-[11px] px-1.5 py-0.5" />
      ),
      size: 120,
    },
    {
      accessorKey: 'razon_social_cliente',
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3 h-8 text-xs"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Cliente
          <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
      cell: ({ getValue }) => (
        <span className="truncate max-w-[200px] block text-xs" title={getValue() as string}>
          {getValue() as string}
        </span>
      ),
    },
    {
      accessorKey: 'numero_documento',
      header: 'N° Doc.',
      cell: ({ getValue }) => (
        <span className="text-xs whitespace-nowrap">{getValue() ?? '—'}</span>
      ),
      size: 90,
    },
    {
      accessorKey: 'estado',
      header: 'Estado',
      cell: ({ row }) => {
        const estado = row.original.estado as InvoiceEstado
        return (
          <span
            className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${ESTADO_COLOR_MAP[estado]}`}
          >
            {estado}
          </span>
        )
      },
      size: 100,
    },
    {
      accessorKey: 'fecha_creacion',
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3 h-8 text-xs"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Emisión
          <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
      cell: ({ getValue }) => (
        <span className="text-xs whitespace-nowrap">{formatDateDisplay(getValue() as string)}</span>
      ),
      size: 100,
    },
    {
      accessorKey: 'moneda',
      header: 'Moneda',
      cell: ({ getValue }) => (
        <Badge variant="outline" className="text-[11px] px-1.5">
          {getValue() as string}
        </Badge>
      ),
      size: 70,
    },
    {
      accessorKey: 'total_moneda_local',
      header: () => <span className="text-xs">Total Local</span>,
      cell: ({ row }) => (
        <span className="text-xs whitespace-nowrap text-right block">
          {formatCurrency(row.original.total_moneda_local, row.original.moneda)}
        </span>
      ),
      size: 110,
    },
    {
      accessorKey: 'total_usd',
      header: () => <span className="text-xs">Total USD</span>,
      cell: ({ row }) => (
        <span className="text-xs whitespace-nowrap text-right block">
          {row.original.total_usd
            ? formatCurrency(row.original.total_usd, 'USD')
            : '—'}
        </span>
      ),
      size: 110,
    },
    {
      accessorKey: 'fecha_vencimiento',
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3 h-8 text-xs"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Vencimiento
          <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
      cell: ({ getValue }) => (
        <span className="text-xs whitespace-nowrap">{formatDateDisplay(getValue() as string)}</span>
      ),
      size: 100,
    },
    {
      accessorKey: 'fecha_pago_o_cobro',
      header: 'Fecha Cobro',
      cell: ({ getValue }) => {
        const v = getValue() as string | null
        return v ? (
          <span className="text-xs font-medium text-green-700 whitespace-nowrap">{formatDateDisplay(v)}</span>
        ) : <span className="text-xs">—</span>
      },
      size: 100,
    },
    {
      accessorKey: 'tiene_factoraje',
      header: 'Factoraje',
      cell: ({ getValue }) =>
        getValue() ? (
          <Badge className="bg-purple-100 text-purple-800 text-[11px] px-1.5">Sí</Badge>
        ) : null,
      size: 80,
    },
    {
      accessorKey: 'vendedor',
      header: 'KAM',
      cell: ({ getValue }) => (
        <span className="truncate max-w-[100px] block text-xs" title={getValue() as string ?? ''}>
          {getValue() ?? '—'}
        </span>
      ),
      size: 100,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {row.original.estado !== 'Pagada' && row.original.estado !== 'Anulada' && (
              <DropdownMenuItem onClick={() => actions.onPay(row.original)}>
                <CreditCard className="mr-2 h-4 w-4 text-green-600" />
                Registrar Cobro
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
      size: 50,
    },
  ]
}
