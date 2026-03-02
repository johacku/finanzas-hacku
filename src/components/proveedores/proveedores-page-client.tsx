"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Plus, Loader2, AlertCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { getProveedores } from "@/actions/proveedores.actions"
import type { Database } from "@/types/database.types"
import { ProveedorModal } from "./proveedor-modal"
import { ProveedoresTable } from "./proveedores-table"

type Proveedor = Database["public"]["Tables"]["proveedores"]["Row"]

interface ProveedoresPageClientProps {
  sociedad?: string
}

export function ProveedoresPageClient({
  sociedad,
}: ProveedoresPageClientProps) {
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedProveedor, setSelectedProveedor] = useState<Proveedor | null>(
    null
  )
  const [refreshKey, setRefreshKey] = useState(0)

  // Fetch proveedores
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await getProveedores(
          sociedad ? { sociedad } : undefined
        )
        setProveedores(data)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Error fetching vendors"
        )
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [sociedad, refreshKey])

  const handleCreate = () => {
    setSelectedProveedor(null)
    setModalOpen(true)
  }

  const handleEdit = (proveedor: Proveedor) => {
    setSelectedProveedor(proveedor)
    setModalOpen(true)
  }

  const handleModalClose = () => {
    setModalOpen(false)
    setSelectedProveedor(null)
  }

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Proveedores</h1>
        <Button onClick={handleCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Agregar Proveedor
        </Button>
      </div>

      {/* Errors */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : proveedores.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No hay proveedores registrados</p>
        </div>
      ) : (
        <ProveedoresTable
          proveedores={proveedores}
          onEdit={handleEdit}
          onRefresh={handleRefresh}
        />
      )}

      {/* Modal */}
      <ProveedorModal
        open={modalOpen}
        onClose={handleModalClose}
        proveedor={selectedProveedor}
        onSuccess={handleRefresh}
      />
    </div>
  )
}
