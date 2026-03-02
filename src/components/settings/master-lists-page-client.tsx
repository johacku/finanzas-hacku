"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Plus, Trash2 } from "lucide-react"
import {
  getPlanes,
  getAliados,
  getVendedores,
  getTiposPago,
  getConceptosGasto,
  createPlan,
  createAliado,
  createVendedor,
  createTipoPago,
  createConceptoGasto,
  deletePlan,
  deleteAliado,
  deleteVendedor,
  deleteTipoPago,
  deleteConcepto,
} from "@/actions/master-lists.actions"

export function MasterListsPageClient() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [planes, setPlanes] = useState<any[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [aliados, setAliados] = useState<any[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [vendedores, setVendedores] = useState<any[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [tiposPago, setTiposPago] = useState<any[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [conceptos, setConceptos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Form states
  const [newPlan, setNewPlan] = useState("")
  const [newAliado, setNewAliado] = useState({ nombre: "", porcentaje_comision: "" })
  const [newVendedor, setNewVendedor] = useState({ nombre: "", rol: "KAM" as "KAM" | "Hunter" })
  const [newTipoPago, setNewTipoPago] = useState("")
  const [newConcepto, setNewConcepto] = useState("")

  useEffect(() => {
    loadLists()
  }, [])

  const loadLists = async () => {
    setLoading(true)
    try {
      const [planesData, aliadosData, vendedoresData, tiposPagoData, conceptosData] =
        await Promise.all([
          getPlanes(),
          getAliados(),
          getVendedores(),
          getTiposPago(),
          getConceptosGasto(),
        ])

      setPlanes(planesData || [])
      setAliados(aliadosData || [])
      setVendedores(vendedoresData || [])
      setTiposPago(tiposPagoData || [])
      setConceptos(conceptosData || [])
    } catch (error) {
      console.error("Failed to load lists:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddPlan = async () => {
    if (!newPlan) return
    try {
      await createPlan(newPlan)
      setNewPlan("")
      await loadLists()
    } catch (error) {
      console.error("Failed to add plan:", error)
    }
  }

  const handleDeletePlan = async (id: string) => {
    if (!confirm("¿Estás seguro que quieres eliminar este plan?")) return
    try {
      await deletePlan(id)
      await loadLists()
    } catch (error) {
      console.error("Failed to delete plan:", error)
      alert(`Error al eliminar plan: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  const handleDeleteAliado = async (id: string) => {
    if (!confirm("¿Estás seguro que quieres eliminar este aliado?")) return
    try {
      await deleteAliado(id)
      await loadLists()
    } catch (error) {
      console.error("Failed to delete aliado:", error)
      alert(`Error al eliminar aliado: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  const handleDeleteVendedor = async (id: string) => {
    if (!confirm("¿Estás seguro que quieres eliminar este vendedor?")) return
    try {
      await deleteVendedor(id)
      await loadLists()
    } catch (error) {
      console.error("Failed to delete vendedor:", error)
      alert(`Error al eliminar vendedor: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  const handleDeleteTipoPago = async (id: string) => {
    if (!confirm("¿Estás seguro que quieres eliminar este tipo de pago?")) return
    try {
      await deleteTipoPago(id)
      await loadLists()
    } catch (error) {
      console.error("Failed to delete tipo pago:", error)
      alert(`Error al eliminar tipo de pago: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  const handleDeleteConcepto = async (id: string) => {
    if (!confirm("¿Estás seguro que quieres eliminar este concepto?")) return
    try {
      await deleteConcepto(id)
      await loadLists()
    } catch (error) {
      console.error("Failed to delete concepto:", error)
      alert(`Error al eliminar concepto: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  const handleAddAliado = async () => {
    if (!newAliado.nombre) return
    try {
      await createAliado({
        nombre: newAliado.nombre,
        porcentaje_comision: newAliado.porcentaje_comision
          ? parseFloat(newAliado.porcentaje_comision)
          : undefined,
      })
      setNewAliado({ nombre: "", porcentaje_comision: "" })
      await loadLists()
    } catch (error) {
      console.error("Failed to add aliado:", error)
    }
  }

  const handleAddVendedor = async () => {
    if (!newVendedor.nombre) return
    try {
      await createVendedor({
        nombre: newVendedor.nombre,
        rol: newVendedor.rol,
      })
      setNewVendedor({ nombre: "", rol: "KAM" })
      await loadLists()
    } catch (error) {
      console.error("Failed to add vendedor:", error)
    }
  }

  const handleAddTipoPago = async () => {
    if (!newTipoPago) return
    try {
      await createTipoPago(newTipoPago)
      setNewTipoPago("")
      await loadLists()
    } catch (error) {
      console.error("Failed to add tipo pago:", error)
    }
  }

  const handleAddConcepto = async () => {
    if (!newConcepto) return
    try {
      await createConceptoGasto({ nombre: newConcepto })
      setNewConcepto("")
      await loadLists()
    } catch (error) {
      console.error("Failed to add concepto:", error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <Tabs defaultValue="planes" className="w-full">
      <TabsList className="grid w-full grid-cols-5">
        <TabsTrigger value="planes">Planes ({planes.length})</TabsTrigger>
        <TabsTrigger value="aliados">Aliados ({aliados.length})</TabsTrigger>
        <TabsTrigger value="vendedores">Vendedores ({vendedores.length})</TabsTrigger>
        <TabsTrigger value="tipos-pago">Tipos Pago ({tiposPago.length})</TabsTrigger>
        <TabsTrigger value="conceptos">Conceptos ({conceptos.length})</TabsTrigger>
      </TabsList>

      {/* PLANES */}
      <TabsContent value="planes">
        <Card>
          <CardHeader>
            <CardTitle>Planes de Servicio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Nombre del plan"
                value={newPlan}
                onChange={(e) => setNewPlan(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleAddPlan()}
              />
              <Button onClick={handleAddPlan} className="gap-2">
                <Plus className="h-4 w-4" />
                Agregar
              </Button>
            </div>

            <div className="space-y-2">
              {planes.map((plan) => (
                <div key={plan.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <span>{plan.nombre}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600"
                    onClick={() => handleDeletePlan(plan.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* ALIADOS */}
      <TabsContent value="aliados">
        <Card>
          <CardHeader>
            <CardTitle>Aliados / Resellers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Nombre"
                value={newAliado.nombre}
                onChange={(e) => setNewAliado({ ...newAliado, nombre: e.target.value })}
              />
              <Input
                placeholder="Comisión %"
                type="number"
                value={newAliado.porcentaje_comision}
                onChange={(e) => setNewAliado({ ...newAliado, porcentaje_comision: e.target.value })}
              />
              <Button onClick={handleAddAliado} className="gap-2">
                <Plus className="h-4 w-4" />
                Agregar
              </Button>
            </div>

            <div className="space-y-2">
              {aliados.map((aliado) => (
                <div key={aliado.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                  <div>
                    <p className="font-semibold">{aliado.nombre}</p>
                    {aliado.porcentaje_comision && (
                      <p className="text-sm text-gray-600">Comisión: {aliado.porcentaje_comision}%</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600"
                    onClick={() => handleDeleteAliado(aliado.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* VENDEDORES */}
      <TabsContent value="vendedores">
        <Card>
          <CardHeader>
            <CardTitle>KAMs / Hunters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Nombre"
                value={newVendedor.nombre}
                onChange={(e) => setNewVendedor({ ...newVendedor, nombre: e.target.value })}
              />
              <select
                value={newVendedor.rol}
                onChange={(e) =>
                  setNewVendedor({ ...newVendedor, rol: e.target.value as "KAM" | "Hunter" })
                }
                className="px-3 py-2 border rounded-md"
              >
                <option value="KAM">KAM</option>
                <option value="Hunter">Hunter</option>
              </select>
              <Button onClick={handleAddVendedor} className="gap-2">
                <Plus className="h-4 w-4" />
                Agregar
              </Button>
            </div>

            <div className="space-y-2">
              {vendedores.map((vendedor) => (
                <div key={vendedor.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                  <div>
                    <p className="font-semibold">{vendedor.nombre}</p>
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {vendedor.rol}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600"
                    onClick={() => handleDeleteVendedor(vendedor.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* TIPOS DE PAGO */}
      <TabsContent value="tipos-pago">
        <Card>
          <CardHeader>
            <CardTitle>Métodos de Pago</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Tipo de pago"
                value={newTipoPago}
                onChange={(e) => setNewTipoPago(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleAddTipoPago()}
              />
              <Button onClick={handleAddTipoPago} className="gap-2">
                <Plus className="h-4 w-4" />
                Agregar
              </Button>
            </div>

            <div className="space-y-2">
              {tiposPago.map((tipo) => (
                <div key={tipo.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <span>{tipo.nombre}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600"
                    onClick={() => handleDeleteTipoPago(tipo.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* CONCEPTOS */}
      <TabsContent value="conceptos">
        <Card>
          <CardHeader>
            <CardTitle>Conceptos de Gasto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Concepto de gasto"
                value={newConcepto}
                onChange={(e) => setNewConcepto(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleAddConcepto()}
              />
              <Button onClick={handleAddConcepto} className="gap-2">
                <Plus className="h-4 w-4" />
                Agregar
              </Button>
            </div>

            <div className="space-y-2">
              {conceptos.map((concepto) => (
                <div key={concepto.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <span>{concepto.nombre}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600"
                    onClick={() => handleDeleteConcepto(concepto.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
