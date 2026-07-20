/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Plus, Trash2, Pencil, RefreshCw, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
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
  addPlanCommissionRange,
  removePlanCommissionRange,
  deleteAliado,
  deleteVendedor,
  deleteTipoPago,
  deleteConcepto,
} from "@/actions/master-lists.actions"
import {
  getBankAccounts,
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
} from "@/actions/bank-accounts.actions"
import {
  getItemConfigs,
  syncAlegraItems,
  toggleItemActive,
  addCommissionRange,
  removeCommissionRange,
} from "@/actions/item-commission-config.actions"
import {
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from "@/actions/customers.actions"
import { Checkbox } from "@/components/ui/checkbox"
import { SOCIEDADES, MONEDAS } from "@/lib/constants"

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [bankAccounts, setBankAccounts] = useState<any[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [itemConfigs, setItemConfigs] = useState<any[]>([])
  const [itemSearch, setItemSearch] = useState('')
  const [syncingItems, setSyncingItems] = useState(false)
  // Customers
  const [customers, setCustomers] = useState<any[]>([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<any>(null)
  const [customerForm, setCustomerForm] = useState({
    nombre_cliente: '',
    sociedad_cliente: '',
    pais: '',
    email: '',
    kam_responsable: '',
    tiene_factoraje: false,
    pronto_pago: false,
    dias_pago: '',
    razones_sociales: '',
    sociedades_hacku: [] as string[],
    moneda_default: 'COP',
    notas: '',
  })
  const [addingRangeFor, setAddingRangeFor] = useState<string | null>(null)
  const [newRange, setNewRange] = useState({ precio_desde: "", precio_hasta: "", porcentaje_comision: "", moneda: "COP" })
  const [loading, setLoading] = useState(true)

  // Plan ranges
  const [addingPlanRangeFor, setAddingPlanRangeFor] = useState<string | null>(null)
  const [newPlanRange, setNewPlanRange] = useState({ precio_desde: "", precio_hasta: "", porcentaje_comision: "", moneda: "COP" })

  // Form states
  const [newPlan, setNewPlan] = useState("")
  const [newAliado, setNewAliado] = useState({ nombre: "", porcentaje_comision: "" })
  const [newVendedor, setNewVendedor] = useState({ nombre: "", rol: "KAM" as "KAM" | "Hunter" })
  const [newTipoPago, setNewTipoPago] = useState("")
  const [newConcepto, setNewConcepto] = useState("")

  // Bank accounts state
  const [bankDialogOpen, setBankDialogOpen] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [editingAccount, setEditingAccount] = useState<any | null>(null)
  const [bankForm, setBankForm] = useState({
    nombre: "",
    banco: "",
    tipo: "ahorros" as "ahorros" | "corriente" | "tdc",
    numero: "",
    sociedad: SOCIEDADES[0],
    moneda: "COP",
    titular: "",
    notas: "",
  })

  const resetBankForm = () => {
    setBankForm({
      nombre: "",
      banco: "",
      tipo: "ahorros",
      numero: "",
      sociedad: SOCIEDADES[0],
      moneda: "COP",
      titular: "",
      notas: "",
    })
    setEditingAccount(null)
  }

  useEffect(() => {
    loadLists()
  }, [])

  const loadLists = async () => {
    setLoading(true)
    try {
      const [planesData, aliadosData, vendedoresData, tiposPagoData, conceptosData, bankAccountsData, itemConfigsData, customersData] =
        await Promise.all([
          getPlanes(),
          getAliados(),
          getVendedores(),
          getTiposPago(),
          getConceptosGasto(),
          getBankAccounts(),
          getItemConfigs(),
          getCustomers(),
        ])

      setPlanes(planesData || [])
      setAliados(aliadosData || [])
      setVendedores(vendedoresData || [])
      setTiposPago(tiposPagoData || [])
      setConceptos(conceptosData || [])
      setBankAccounts(bankAccountsData || [])
      setItemConfigs(itemConfigsData || [])
      setCustomers(customersData || [])
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
      alert(`Error al crear plan: ${error instanceof Error ? error.message : "Error desconocido"}`)
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

  const handleOpenBankDialog = (account?: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (account) {
      setEditingAccount(account)
      setBankForm({
        nombre: account.nombre || "",
        banco: account.banco || "",
        tipo: account.tipo || "ahorros",
        numero: account.numero || "",
        sociedad: account.sociedad || SOCIEDADES[0],
        moneda: account.moneda || "COP",
        titular: account.titular || "",
        notas: account.notas || "",
      })
    } else {
      resetBankForm()
    }
    setBankDialogOpen(true)
  }

  const handleSaveBankAccount = async () => {
    if (!bankForm.nombre || !bankForm.banco || !bankForm.numero || !bankForm.sociedad) return
    try {
      const payload = {
        nombre: bankForm.nombre,
        banco: bankForm.banco,
        tipo: bankForm.tipo,
        numero: bankForm.numero,
        sociedad: bankForm.sociedad,
        moneda: bankForm.moneda,
        titular: bankForm.titular || undefined,
        notas: bankForm.notas || undefined,
      }
      if (editingAccount) {
        await updateBankAccount(editingAccount.id, payload)
      } else {
        await createBankAccount(payload)
      }
      setBankDialogOpen(false)
      resetBankForm()
      await loadLists()
    } catch (error) {
      console.error("Failed to save bank account:", error)
      alert(`Error: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  const handleDeleteBankAccount = async (id: string) => {
    if (!confirm("¿Estás seguro que quieres eliminar esta cuenta?")) return
    try {
      await deleteBankAccount(id)
      await loadLists()
    } catch (error) {
      console.error("Failed to delete bank account:", error)
      alert(`Error al eliminar: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  const handleToggleActivo = async (id: string, currentValue: boolean) => {
    try {
      await updateBankAccount(id, { activo: !currentValue })
      await loadLists()
    } catch (error) {
      console.error("Failed to toggle activo:", error)
    }
  }

  const handleSyncItems = async () => {
    setSyncingItems(true)
    try {
      await syncAlegraItems()
      await loadLists()
    } catch (error) {
      console.error("Failed to sync items:", error)
      alert(`Error al sincronizar: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setSyncingItems(false)
    }
  }

  const handleToggleItem = async (id: string, activo: boolean) => {
    try {
      await toggleItemActive(id, activo)
      await loadLists()
    } catch (error) {
      console.error("Failed to toggle item:", error)
    }
  }

  const handleAddRange = async (itemConfigId: string) => {
    if (!newRange.porcentaje_comision) return
    try {
      await addCommissionRange({
        item_config_id: itemConfigId,
        precio_desde: parseFloat(newRange.precio_desde) || 0,
        precio_hasta: newRange.precio_hasta ? parseFloat(newRange.precio_hasta) : null,
        porcentaje_comision: parseFloat(newRange.porcentaje_comision),
        moneda: newRange.moneda || 'COP',
      })
      setNewRange({ precio_desde: "", precio_hasta: "", porcentaje_comision: "", moneda: "COP" })
      setAddingRangeFor(null)
      await loadLists()
    } catch (error) {
      console.error("Failed to add range:", error)
      alert(`Error: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  const handleRemoveRange = async (id: string) => {
    try {
      await removeCommissionRange(id)
      await loadLists()
    } catch (error) {
      console.error("Failed to remove range:", error)
    }
  }

  const TIPO_LABELS: Record<string, string> = {
    ahorros: "Ahorros",
    corriente: "Corriente",
    tdc: "TDC",
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
      <TabsList className="flex w-full">
        <TabsTrigger value="planes">Planes ({planes.length})</TabsTrigger>
        <TabsTrigger value="aliados">Aliados ({aliados.length})</TabsTrigger>
        <TabsTrigger value="vendedores">Vendedores ({vendedores.length})</TabsTrigger>
        <TabsTrigger value="tipos-pago">Tipos Pago ({tiposPago.length})</TabsTrigger>
        <TabsTrigger value="conceptos">Conceptos ({conceptos.length})</TabsTrigger>
        <TabsTrigger value="cuentas">Cuentas ({bankAccounts.length})</TabsTrigger>
        <TabsTrigger value="items">Items ({itemConfigs.length})</TabsTrigger>
        <TabsTrigger value="clientes">Clientes ({customers.length})</TabsTrigger>
        <TabsTrigger value="nomina">Nómina</TabsTrigger>
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

            <div className="space-y-4">
              {planes.map((plan: any) => {
                const planRanges = (plan.plan_commission_ranges || []).sort(
                  (a: any, b: any) => (a.precio_desde || 0) - (b.precio_desde || 0)
                )
                return (
                  <div key={plan.id} className="border rounded-lg p-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-semibold">{plan.nombre}</span>
                        {plan.descripcion && <span className="text-sm text-muted-foreground ml-2">{plan.descripcion}</span>}
                      </div>
                      <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDeletePlan(plan.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Commission ranges */}
                    <div className="ml-4 mt-2 space-y-1">
                      {planRanges.length === 0 ? (
                        <p className="text-sm text-gray-400">Sin rangos de comision configurados</p>
                      ) : (
                        planRanges.map((range: any) => (
                          <div key={range.id} className="flex items-center gap-2 text-sm">
                            <Badge variant="outline" className="text-[10px]">{range.moneda || 'COP'}</Badge>
                            <span className="font-mono">
                              {range.precio_desde ?? 0}
                              {range.precio_hasta != null ? ` - ${range.precio_hasta}` : "+"}
                            </span>
                            <span className="text-gray-400">&rarr;</span>
                            <span className="font-semibold">{range.porcentaje_comision}%</span>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                              onClick={async () => {
                                await removePlanCommissionRange(range.id)
                                await loadLists()
                              }}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))
                      )}

                      {/* Add range form */}
                      {addingPlanRangeFor === plan.id ? (
                        <div className="flex items-end gap-2 mt-2 flex-wrap">
                          <div className="space-y-1">
                            <Label className="text-xs">Moneda</Label>
                            <Select value={newPlanRange.moneda} onValueChange={(v) => setNewPlanRange({ ...newPlanRange, moneda: v })}>
                              <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {MONEDAS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Desde</Label>
                            <Input type="number" placeholder="0" className="h-8 w-24" value={newPlanRange.precio_desde}
                              onChange={(e) => setNewPlanRange({ ...newPlanRange, precio_desde: e.target.value })} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Hasta</Label>
                            <Input type="number" placeholder="Ilimitado" className="h-8 w-24" value={newPlanRange.precio_hasta}
                              onChange={(e) => setNewPlanRange({ ...newPlanRange, precio_hasta: e.target.value })} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Comision %</Label>
                            <Input type="number" placeholder="5" className="h-8 w-20" value={newPlanRange.porcentaje_comision}
                              onChange={(e) => setNewPlanRange({ ...newPlanRange, porcentaje_comision: e.target.value })} />
                          </div>
                          <Button size="sm" className="h-8" onClick={async () => {
                            if (!newPlanRange.porcentaje_comision) return
                            try {
                              await addPlanCommissionRange({
                                plan_id: plan.id,
                                moneda: newPlanRange.moneda || 'COP',
                                precio_desde: parseFloat(newPlanRange.precio_desde) || 0,
                                precio_hasta: newPlanRange.precio_hasta ? parseFloat(newPlanRange.precio_hasta) : null,
                                porcentaje_comision: parseFloat(newPlanRange.porcentaje_comision),
                              })
                              setNewPlanRange({ precio_desde: "", precio_hasta: "", porcentaje_comision: "", moneda: "COP" })
                              setAddingPlanRangeFor(null)
                              await loadLists()
                            } catch (err) {
                              alert(err instanceof Error ? err.message : "Error")
                            }
                          }}>Guardar</Button>
                          <Button size="sm" variant="ghost" className="h-8" onClick={() => {
                            setAddingPlanRangeFor(null)
                            setNewPlanRange({ precio_desde: "", precio_hasta: "", porcentaje_comision: "", moneda: "COP" })
                          }}>Cancelar</Button>
                        </div>
                      ) : (
                        <Button variant="ghost" size="sm" className="text-blue-600 mt-1 h-7 px-2"
                          onClick={() => {
                            setAddingPlanRangeFor(plan.id)
                            setNewPlanRange({ precio_desde: "", precio_hasta: "", porcentaje_comision: "", moneda: "COP" })
                          }}>
                          <Plus className="h-3 w-3 mr-1" /> Agregar rango
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
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
      {/* CUENTAS BANCARIAS Y TDC */}
      <TabsContent value="cuentas">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Cuentas Bancarias y TDC</CardTitle>
            <Button onClick={() => handleOpenBankDialog()} className="gap-2">
              <Plus className="h-4 w-4" />
              Agregar Cuenta
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Banco</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Numero</TableHead>
                  <TableHead>Sociedad</TableHead>
                  <TableHead>Moneda</TableHead>
                  <TableHead>Titular</TableHead>
                  <TableHead>Activo</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bankAccounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-gray-500 py-8">
                      No hay cuentas registradas
                    </TableCell>
                  </TableRow>
                ) : (
                  bankAccounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell className="font-medium">{account.nombre}</TableCell>
                      <TableCell>{account.banco}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {TIPO_LABELS[account.tipo] || account.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{account.numero}</TableCell>
                      <TableCell>{account.sociedad}</TableCell>
                      <TableCell>{account.moneda}</TableCell>
                      <TableCell>{account.titular || "-"}</TableCell>
                      <TableCell>
                        <Switch
                          checked={account.activo}
                          onCheckedChange={() => handleToggleActivo(account.id, account.activo)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenBankDialog(account)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600"
                            onClick={() => handleDeleteBankAccount(account.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      {/* DIALOG: Agregar / Editar Cuenta */}
      <Dialog open={bankDialogOpen} onOpenChange={(open) => { if (!open) { resetBankForm(); } setBankDialogOpen(open); }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>
              {editingAccount ? "Editar Cuenta" : "Agregar Cuenta"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bank-nombre">Nombre *</Label>
                <Input
                  id="bank-nombre"
                  placeholder="Cuenta principal hackU"
                  value={bankForm.nombre}
                  onChange={(e) => setBankForm({ ...bankForm, nombre: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bank-banco">Banco *</Label>
                <Input
                  id="bank-banco"
                  placeholder="Bancolombia"
                  value={bankForm.banco}
                  onChange={(e) => setBankForm({ ...bankForm, banco: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo *</Label>
                <Select
                  value={bankForm.tipo}
                  onValueChange={(val) => setBankForm({ ...bankForm, tipo: val as "ahorros" | "corriente" | "tdc" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ahorros">Ahorros</SelectItem>
                    <SelectItem value="corriente">Corriente</SelectItem>
                    <SelectItem value="tdc">TDC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="bank-numero">Numero *</Label>
                <Input
                  id="bank-numero"
                  placeholder="1234567890"
                  value={bankForm.numero}
                  onChange={(e) => setBankForm({ ...bankForm, numero: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sociedad *</Label>
                <Select
                  value={bankForm.sociedad}
                  onValueChange={(val) => setBankForm({ ...bankForm, sociedad: val as typeof bankForm.sociedad })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOCIEDADES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Moneda</Label>
                <Select
                  value={bankForm.moneda}
                  onValueChange={(val) => setBankForm({ ...bankForm, moneda: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONEDAS.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bank-titular">Titular</Label>
              <Input
                id="bank-titular"
                placeholder="Nombre del titular"
                value={bankForm.titular}
                onChange={(e) => setBankForm({ ...bankForm, titular: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bank-notas">Notas</Label>
              <Textarea
                id="bank-notas"
                placeholder="Notas adicionales..."
                value={bankForm.notas}
                onChange={(e) => setBankForm({ ...bankForm, notas: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBankDialogOpen(false); resetBankForm(); }}>
              Cancelar
            </Button>
            <Button onClick={handleSaveBankAccount}>
              {editingAccount ? "Guardar Cambios" : "Agregar Cuenta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* ITEMS & COMISIONES */}
      <TabsContent value="items">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Items & Comisiones</CardTitle>
            <Button onClick={handleSyncItems} disabled={syncingItems} className="gap-2">
              {syncingItems ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Sincronizar Items Alegra
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Buscar item..."
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              className="max-w-sm mb-4"
            />
            {itemConfigs.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                No hay items configurados. Haz clic en &quot;Sincronizar Items Alegra&quot; para importarlos.
              </p>
            ) : (
              <div className="space-y-3">
                {itemConfigs.filter((item: any) =>
                  !itemSearch || item.nombre.toLowerCase().includes(itemSearch.toLowerCase())
                ).map((item) => {
                  const ranges = item.item_commission_ranges || []
                  const sortedRanges = [...ranges].sort(
                    (a: any, b: any) => (a.precio_desde || 0) - (b.precio_desde || 0) // eslint-disable-line @typescript-eslint/no-explicit-any
                  )
                  return (
                    <div
                      key={item.id}
                      className={`border rounded-lg p-4 ${!item.activo ? "opacity-60 bg-gray-50" : "bg-white"}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={item.activo}
                            onCheckedChange={(checked) => handleToggleItem(item.id, checked)}
                          />
                          <span className="font-medium">{item.nombre}</span>
                          <span className="text-xs text-muted-foreground ml-2">{item.moneda || 'COP'}</span>
                          {!item.activo && (
                            <Badge variant="secondary" className="text-xs">inactivo</Badge>
                          )}
                        </div>
                      </div>

                      {/* Commission ranges */}
                      <div className="ml-10 space-y-1">
                        {sortedRanges.length === 0 ? (
                          <p className="text-sm text-gray-400">Sin rangos configurados</p>
                        ) : (
                          sortedRanges.map((range: any) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
                            <div key={range.id} className="flex items-center gap-2 text-sm">
                              <Badge variant="outline" className="text-[10px]">{range.moneda || 'COP'}</Badge>
                              <span className="font-mono">
                                {range.precio_desde ?? 0}
                                {range.precio_hasta != null ? ` - ${range.precio_hasta}` : "+"}
                              </span>
                              <span className="text-gray-400">&rarr;</span>
                              <span className="font-semibold">{range.porcentaje_comision}%</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                onClick={() => handleRemoveRange(range.id)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))
                        )}

                        {/* Inline add range form */}
                        {addingRangeFor === item.id ? (
                          <div className="flex items-end gap-2 mt-2 flex-wrap">
                            <div className="space-y-1">
                              <Label className="text-xs">Moneda</Label>
                              <Select value={newRange.moneda} onValueChange={(v) => setNewRange({ ...newRange, moneda: v })}>
                                <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {MONEDAS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Desde</Label>
                              <Input
                                type="number"
                                placeholder="0"
                                className="h-8 w-24"
                                value={newRange.precio_desde}
                                onChange={(e) => setNewRange({ ...newRange, precio_desde: e.target.value })}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Hasta</Label>
                              <Input
                                type="number"
                                placeholder="Ilimitado"
                                className="h-8 w-24"
                                value={newRange.precio_hasta}
                                onChange={(e) => setNewRange({ ...newRange, precio_hasta: e.target.value })}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Comision %</Label>
                              <Input
                                type="number"
                                placeholder="5"
                                className="h-8 w-20"
                                value={newRange.porcentaje_comision}
                                onChange={(e) => setNewRange({ ...newRange, porcentaje_comision: e.target.value })}
                              />
                            </div>
                            <Button size="sm" className="h-8" onClick={() => handleAddRange(item.id)}>
                              Guardar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8"
                              onClick={() => {
                                setAddingRangeFor(null)
                                setNewRange({ precio_desde: "", precio_hasta: "", porcentaje_comision: "", moneda: "COP" })
                              }}
                            >
                              Cancelar
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-blue-600 mt-1 h-7 px-2"
                            onClick={() => {
                              setAddingRangeFor(item.id)
                              setNewRange({ precio_desde: "", precio_hasta: "", porcentaje_comision: "", moneda: item.moneda || "COP" })
                            }}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Agregar rango
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* CLIENTES */}
      <TabsContent value="clientes">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Gestión de Clientes</CardTitle>
              <Button size="sm" onClick={() => {
                setEditingCustomer(null)
                setCustomerForm({ nombre_cliente: '', sociedad_cliente: '', pais: '', email: '', kam_responsable: '', tiene_factoraje: false, pronto_pago: false, dias_pago: '', razones_sociales: '', sociedades_hacku: [], moneda_default: 'COP', notas: '' })
                setCustomerDialogOpen(true)
              }}>
                <Plus className="mr-1 h-4 w-4" /> Nuevo Cliente
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Input placeholder="Buscar cliente, email, KAM..." value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} className="mb-4 max-w-md" />
            <div className="overflow-x-auto max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre Cliente</TableHead>
                    <TableHead>Razones Sociales</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>País</TableHead>
                    <TableHead>Sociedades hackÜ</TableHead>
                    <TableHead>KAM</TableHead>
                    <TableHead>Factoraje</TableHead>
                    <TableHead>Pronto Pago</TableHead>
                    <TableHead>Moneda</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers
                    .filter(c => {
                      if (!customerSearch) return true
                      const q = customerSearch.toLowerCase()
                      return (c.nombre_cliente || '').toLowerCase().includes(q) ||
                        (c.email || '').toLowerCase().includes(q) ||
                        (c.kam_responsable || '').toLowerCase().includes(q) ||
                        (c.razones_sociales || []).some((r: string) => r.toLowerCase().includes(q))
                    })
                    .map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium text-xs">{c.nombre_cliente}</TableCell>
                      <TableCell className="text-xs max-w-[200px]">
                        {(c.razones_sociales || []).length > 0
                          ? (c.razones_sociales || []).map((r: string, i: number) => <Badge key={i} variant="outline" className="text-[9px] mr-1 mb-0.5">{r}</Badge>)
                          : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-xs">{c.email || '—'}</TableCell>
                      <TableCell className="text-xs">{c.pais || '—'}</TableCell>
                      <TableCell className="text-xs">
                        {(c.sociedades_hacku || []).length > 0
                          ? (c.sociedades_hacku || []).map((s: string, i: number) => <Badge key={i} variant="outline" className="text-[9px] mr-1">{s}</Badge>)
                          : c.sociedad_cliente || '—'}
                      </TableCell>
                      <TableCell className="text-xs">{c.kam_responsable || '—'}</TableCell>
                      <TableCell className="text-xs">{c.tiene_factoraje ? <Badge className="bg-indigo-100 text-indigo-800 text-[9px]">Sí</Badge> : '—'}</TableCell>
                      <TableCell className="text-xs">{c.pronto_pago ? <Badge className="bg-green-100 text-green-800 text-[9px]">Sí</Badge> : '—'}</TableCell>
                      <TableCell className="text-xs">{c.moneda_default || 'COP'}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => {
                            setEditingCustomer(c)
                            setCustomerForm({
                              nombre_cliente: c.nombre_cliente || '',
                              sociedad_cliente: c.sociedad_cliente || '',
                              pais: c.pais || '',
                              email: c.email || '',
                              kam_responsable: c.kam_responsable || '',
                              tiene_factoraje: c.tiene_factoraje || false,
                              pronto_pago: c.pronto_pago || false,
                              dias_pago: c.dias_pago ? String(c.dias_pago) : '',
                              razones_sociales: (c.razones_sociales || []).join(', '),
                              sociedades_hacku: c.sociedades_hacku || [],
                              moneda_default: c.moneda_default || 'COP',
                              notas: c.notas || '',
                            })
                            setCustomerDialogOpen(true)
                          }}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={async () => {
                            if (!confirm('¿Eliminar este cliente?')) return
                            await deleteCustomer(c.id)
                            setCustomers(prev => prev.filter(x => x.id !== c.id))
                          }}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Customer Dialog */}
        <Dialog open={customerDialogOpen} onOpenChange={setCustomerDialogOpen}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingCustomer ? 'Editar Cliente' : 'Nuevo Cliente'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nombre hackÜ Cliente *</Label>
                <Input value={customerForm.nombre_cliente} onChange={(e) => setCustomerForm(f => ({ ...f, nombre_cliente: e.target.value }))} placeholder="Ej: Grupo XYZ" className="mt-1" />
              </div>
              <div>
                <Label>Razones Sociales (separadas por coma)</Label>
                <Input value={customerForm.razones_sociales} onChange={(e) => setCustomerForm(f => ({ ...f, razones_sociales: e.target.value }))} placeholder="Ej: GRUPO XYZ SAS, XYZ COLOMBIA SA" className="mt-1" />
                <p className="text-[10px] text-muted-foreground mt-1">Todas las razones sociales con las que facturan</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Email principal</Label>
                  <Input value={customerForm.email} onChange={(e) => setCustomerForm(f => ({ ...f, email: e.target.value }))} placeholder="email@empresa.com" className="mt-1" />
                </div>
                <div>
                  <Label>País</Label>
                  <Input value={customerForm.pais} onChange={(e) => setCustomerForm(f => ({ ...f, pais: e.target.value }))} placeholder="Colombia" className="mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>KAM Responsable</Label>
                  <Input value={customerForm.kam_responsable} onChange={(e) => setCustomerForm(f => ({ ...f, kam_responsable: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <Label>Moneda Default</Label>
                  <Select value={customerForm.moneda_default} onValueChange={(v) => setCustomerForm(f => ({ ...f, moneda_default: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MONEDAS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Sociedades hackÜ</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {SOCIEDADES.map(s => (
                    <label key={s} className="flex items-center gap-1 text-xs cursor-pointer">
                      <Checkbox
                        checked={customerForm.sociedades_hacku.includes(s)}
                        onCheckedChange={(checked) => {
                          setCustomerForm(f => ({
                            ...f,
                            sociedades_hacku: checked
                              ? [...f.sociedades_hacku, s]
                              : f.sociedades_hacku.filter(x => x !== s)
                          }))
                        }}
                      />
                      {s}
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={customerForm.tiene_factoraje} onCheckedChange={(v) => setCustomerForm(f => ({ ...f, tiene_factoraje: v === true }))} />
                  Factoraje
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={customerForm.pronto_pago} onCheckedChange={(v) => setCustomerForm(f => ({ ...f, pronto_pago: v === true }))} />
                  Pronto Pago
                </label>
                <div>
                  <Label>Días de pago</Label>
                  <Input type="number" value={customerForm.dias_pago} onChange={(e) => setCustomerForm(f => ({ ...f, dias_pago: e.target.value }))} className="mt-1 h-8" />
                </div>
              </div>
              <div>
                <Label>Notas</Label>
                <Textarea value={customerForm.notas} onChange={(e) => setCustomerForm(f => ({ ...f, notas: e.target.value }))} rows={2} className="mt-1" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCustomerDialogOpen(false)}>Cancelar</Button>
              <Button disabled={!customerForm.nombre_cliente.trim()} onClick={async () => {
                const payload: any = {
                  nombre_cliente: customerForm.nombre_cliente.trim(),
                  sociedad_cliente: customerForm.sociedad_cliente || null,
                  pais: customerForm.pais || null,
                  email: customerForm.email || null,
                  kam_responsable: customerForm.kam_responsable || null,
                  tiene_factoraje: customerForm.tiene_factoraje,
                  pronto_pago: customerForm.pronto_pago,
                  dias_pago: customerForm.dias_pago ? parseInt(customerForm.dias_pago) : null,
                  razones_sociales: customerForm.razones_sociales ? customerForm.razones_sociales.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
                  sociedades_hacku: customerForm.sociedades_hacku,
                  moneda_default: customerForm.moneda_default,
                  notas: customerForm.notas || null,
                }
                try {
                  if (editingCustomer) {
                    await updateCustomer(editingCustomer.id, payload)
                    setCustomers(prev => prev.map(c => c.id === editingCustomer.id ? { ...c, ...payload } : c))
                  } else {
                    await createCustomer(payload)
                    const refreshed = await getCustomers()
                    setCustomers(refreshed || [])
                  }
                  setCustomerDialogOpen(false)
                } catch (e) {
                  alert(e instanceof Error ? e.message : 'Error')
                }
              }}>
                {editingCustomer ? 'Guardar' : 'Crear'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </TabsContent>

      <TabsContent value="nomina">
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground mb-4">Gestión de nómina: agregar personas, modificar montos, etc.</p>
          <a href="/payroll">
            <Button>Ir a Nómina</Button>
          </a>
        </div>
      </TabsContent>
    </Tabs>
  )
}
