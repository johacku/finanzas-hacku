"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Loader2, AlertCircle, Upload } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { getProveedores, bulkCreateProveedores } from "@/actions/proveedores.actions"
import { useToast } from "@/hooks/use-toast"
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
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkText, setBulkText] = useState("")
  const [bulkLoading, setBulkLoading] = useState(false)
  const [selectedProveedor, setSelectedProveedor] = useState<Proveedor | null>(
    null
  )
  const [refreshKey, setRefreshKey] = useState(0)
  const { toast } = useToast()

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
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setBulkOpen(true)} className="gap-2">
            <Upload className="h-4 w-4" />
            Carga Masiva
          </Button>
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Agregar Proveedor
          </Button>
        </div>
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

      {/* Bulk Upload Modal */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Carga Masiva de Proveedores</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Pega los nombres de proveedores, uno por línea. Los duplicados se omiten automáticamente.
            </p>
            <Textarea
              placeholder={"Google - Workspace\nSlack\nSalesforce, Inc.\nAdobe\n..."}
              rows={12}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {bulkText.split("\n").filter((l) => l.trim()).length} proveedores detectados
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={bulkLoading || !bulkText.trim()}
              onClick={async () => {
                setBulkLoading(true)
                try {
                  const names = bulkText.split("\n")
                  const result = await bulkCreateProveedores(names)
                  toast({
                    title: "Carga completada",
                    description: `${result.created} creados, ${result.skipped} omitidos (duplicados)`,
                  })
                  setBulkText("")
                  setBulkOpen(false)
                  handleRefresh()
                } catch (err) {
                  toast({
                    title: "Error",
                    description: err instanceof Error ? err.message : "Error al cargar",
                    variant: "destructive",
                  })
                } finally {
                  setBulkLoading(false)
                }
              }}
            >
              {bulkLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Cargar {bulkText.split("\n").filter((l) => l.trim()).length} Proveedores
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
