"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreVertical, Edit2, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { deleteLiability } from "@/actions/financial-liabilities.actions"
import type { Database } from "@/types/database.types"

type Liability = Database["public"]["Tables"]["financial_liabilities"]["Row"]

interface LiabilityTableProps {
  liabilities: Liability[]
  onEdit: (liability: Liability) => void
  onRefresh: () => void
}

const statusColors = {
  active: "bg-green-100 text-green-800",
  paid_off: "bg-gray-100 text-gray-800",
  suspended: "bg-yellow-100 text-yellow-800",
  defaulted: "bg-red-100 text-red-800",
}

const typeLabels = {
  line_of_credit: "Línea de Crédito",
  rotating_card: "TDC",
  loan: "Préstamo",
  other: "Otro",
}

export function LiabilityTable({
  liabilities,
  onEdit,
  onRefresh,
}: LiabilityTableProps) {
  const handleDelete = async (id: string) => {
    if (confirm("¿Estás seguro de que quieres eliminar este pasivo?")) {
      try {
        await deleteLiability(id)
        onRefresh()
      } catch (error) {
        alert(
          `Error al eliminar: ${error instanceof Error ? error.message : "Error desconocido"}`
        )
      }
    }
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead>Nombre</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Banco</TableHead>
            <TableHead>Moneda</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Disponible</TableHead>
            <TableHead className="text-right">Tasa %</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {liabilities.map((liability) => (
            <TableRow key={liability.id} className="hover:bg-gray-50">
              <TableCell className="font-semibold">
                {liability.nombre}
              </TableCell>
              <TableCell className="text-sm">
                {
                  typeLabels[
                    liability.tipo as keyof typeof typeLabels
                  ]
                }
              </TableCell>
              <TableCell className="text-sm">{liability.banco}</TableCell>
              <TableCell className="text-sm">{liability.moneda}</TableCell>
              <TableCell className="text-right font-mono text-sm">
                {liability.monto_total !== null && liability.monto_total !== undefined
                  ? `$${liability.monto_total.toLocaleString("es-ES", {
                      maximumFractionDigits: 0,
                    })}`
                  : "-"}
              </TableCell>
              <TableCell className="text-right font-mono text-sm">
                {liability.monto_disponible !== null && liability.monto_disponible !== undefined
                  ? `$${liability.monto_disponible.toLocaleString("es-ES", {
                      maximumFractionDigits: 0,
                    })}`
                  : "-"}
              </TableCell>
              <TableCell className="text-right text-sm">
                {liability.tasa_interes !== null && liability.tasa_interes !== undefined
                  ? `${liability.tasa_interes}%`
                  : "-"}
              </TableCell>
              <TableCell>
                <Badge
                  className={`${statusColors[liability.status as keyof typeof statusColors]} border-0`}
                >
                  {liability.status}
                </Badge>
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(liability)}>
                      <Edit2 className="h-4 w-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDelete(liability.id)}
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
