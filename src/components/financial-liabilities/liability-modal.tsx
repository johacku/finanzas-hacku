// @ts-nocheck
"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  createFinancialLiabilitySchema,
  type CreateFinancialLiabilityInput,
} from "@/lib/validations/financial-liability.schema"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertCircle } from "lucide-react"
import { createLiability, updateLiability } from "@/actions/financial-liabilities.actions"
import { SOCIEDADES } from "@/lib/constants"
import type { Database } from "@/types/database.types"

type Liability = Database["public"]["Tables"]["financial_liabilities"]["Row"]

interface LiabilityModalProps {
  open: boolean
  onClose: () => void
  liability?: Liability | null
  onSuccess?: () => void
}

const MONEDAS = ["USD", "COP", "MXN", "VEF"]
const LIABILITY_TYPES = [
  { value: "line_of_credit", label: "Línea de Crédito" },
  { value: "rotating_card", label: "TDC (Tarjeta Rotativa)" },
  { value: "loan", label: "Préstamo" },
  { value: "other", label: "Otro" },
]
const LIABILITY_STATUS = [
  { value: "active", label: "Activo" },
  { value: "paid_off", label: "Pagado" },
  { value: "suspended", label: "Suspendido" },
  { value: "defaulted", label: "En Mora" },
]

export function LiabilityModal({
  open,
  onClose,
  liability,
  onSuccess,
}: LiabilityModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const form = useForm<CreateFinancialLiabilityInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(createFinancialLiabilitySchema) as any,
    defaultValues: liability
      ? {
          sociedad: liability.sociedad,
          nombre: liability.nombre,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tipo: liability.tipo as any,
          banco: liability.banco ?? undefined,
          moneda: liability.moneda,
          monto_total: liability.monto_total ?? undefined,
          monto_disponible: liability.monto_disponible ?? undefined,
          tasa_interes: liability.tasa_interes ?? undefined,
          fecha_inicio: liability.fecha_inicio ?? undefined,
          fecha_vencimiento: liability.fecha_vencimiento ?? undefined,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          status: liability.status as any,
          notas: liability.notas ?? undefined,
        }
      : {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          status: "active" as any,
          moneda: "USD",
        },
  })

  const handleSubmit = async (data: CreateFinancialLiabilityInput) => {
    setLoading(true)
    setError(null)

    try {
      if (liability) {
        await updateLiability(liability.id, data)
      } else {
        await createLiability(data)
      }

      form.reset()
      onClose()
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {liability ? "Editar Pasivo" : "Agregar Pasivo Financiero"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Sociedad & Nombre */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="sociedad"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sociedad *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SOCIEDADES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="nombre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g., Línea Bancolombia"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Tipo & Banco */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {LIABILITY_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="banco"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Banco</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Moneda & Monto Total */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="moneda"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Moneda *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {MONEDAS.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="monto_total"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monto Total (Límite de Crédito)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value ? parseFloat(e.target.value) : null
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Monto Disponible & Tasa de Interés */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="monto_disponible"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monto Disponible</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value ? parseFloat(e.target.value) : null
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tasa_interes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tasa de Interés Mensual (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value ? parseFloat(e.target.value) : null
                          )
                        }
                        placeholder="e.g., 1.5"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Fechas */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="fecha_inicio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha Inicio</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="fecha_vencimiento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha Vencimiento</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Status & Notas */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {LIABILITY_STATUS.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notas"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas</FormLabel>
                  <FormControl>
                    <textarea
                      {...field}
                      value={field.value ?? ""}
                      className="w-full px-3 py-2 border rounded-md text-sm"
                      rows={3}
                      placeholder="Notas adicionales..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Buttons */}
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {liability ? "Guardar Cambios" : "Crear Pasivo"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
