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
import { MoreVertical, Edit2, Trash2, Mail, Phone } from "lucide-react"
import { deleteProveedor } from "@/actions/proveedores.actions"
import type { Database } from "@/types/database.types"

type Proveedor = Database["public"]["Tables"]["proveedores"]["Row"]

interface ProveedoresTableProps {
  proveedores: Proveedor[]
  onEdit: (proveedor: Proveedor) => void
  onRefresh: () => void
}

export function ProveedoresTable({
  proveedores,
  onEdit,
  onRefresh,
}: ProveedoresTableProps) {
  const handleDelete = async (id: string) => {
    if (confirm("¿Estás seguro de que quieres eliminar este proveedor?")) {
      try {
        await deleteProveedor(id)
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
            <TableHead>País / Ciudad</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead>Banco</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {proveedores.map((proveedor) => (
            <TableRow key={proveedor.id} className="hover:bg-gray-50">
              <TableCell className="font-semibold">
                {proveedor.nombre_proveedor}
              </TableCell>
              <TableCell className="text-sm">
                {proveedor.tipo_proveedor || "-"}
              </TableCell>
              <TableCell className="text-sm">
                {proveedor.pais && proveedor.ciudad
                  ? `${proveedor.pais} / ${proveedor.ciudad}`
                  : proveedor.pais || proveedor.ciudad || "-"}
              </TableCell>
              <TableCell>
                {proveedor.email ? (
                  <a
                    href={`mailto:${proveedor.email}`}
                    className="text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <Mail className="h-3 w-3" />
                    {proveedor.email}
                  </a>
                ) : (
                  <span className="text-gray-500">-</span>
                )}
              </TableCell>
              <TableCell>
                {proveedor.telefono ? (
                  <a
                    href={`tel:${proveedor.telefono}`}
                    className="text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <Phone className="h-3 w-3" />
                    {proveedor.telefono}
                  </a>
                ) : (
                  <span className="text-gray-500">-</span>
                )}
              </TableCell>
              <TableCell className="text-sm">
                {proveedor.banco_pago || "-"}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(proveedor)}>
                      <Edit2 className="h-4 w-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDelete(proveedor.id)}
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
