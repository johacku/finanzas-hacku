"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  createProveedorSchema,
  type CreateProveedorInput,
} from "@/lib/validations/proveedor.schema"
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
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertCircle } from "lucide-react"
import { createProveedor, updateProveedor } from "@/actions/proveedores.actions"
import type { Database } from "@/types/database.types"

type Proveedor = Database["public"]["Tables"]["proveedores"]["Row"]

interface ProveedorModalProps {
  open: boolean
  onClose: () => void
  proveedor?: Proveedor | null
  onSuccess?: () => void
}

const TIPOS_PROVEEDOR = [
  "Software",
  "Payroll",
  "Oficina",
  "Infraestructura",
  "Marketing",
  "Legal",
  "Consultoría",
  "Otro",
]

export function ProveedorModal({
  open,
  onClose,
  proveedor,
  onSuccess,
}: ProveedorModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const form = useForm<CreateProveedorInput>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(createProveedorSchema) as any,
    defaultValues: proveedor
      ? {
          nombre_proveedor: proveedor.nombre_proveedor,
          sociedad_proveedor: proveedor.sociedad_proveedor ?? undefined,
          pais: proveedor.pais ?? undefined,
          ciudad: proveedor.ciudad ?? undefined,
          tipo_proveedor: proveedor.tipo_proveedor ?? undefined,
          contacto_principal: proveedor.contacto_principal ?? undefined,
          email: proveedor.email ?? undefined,
          telefono: proveedor.telefono ?? undefined,
          banco_pago: proveedor.banco_pago ?? undefined,
          cuenta_pago: proveedor.cuenta_pago ?? undefined,
        }
      : {},
  })

  const handleSubmit = async (data: CreateProveedorInput) => {
    setLoading(true)
    setError(null)

    try {
      if (proveedor) {
        await updateProveedor(proveedor.id, data)
      } else {
        await createProveedor(data)
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
            {proveedor ? "Editar Proveedor" : "Nuevo Proveedor"}
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

            {/* Nombre & Tipo */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="nombre_proveedor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre del Proveedor *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g., Acme Corp"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tipo_proveedor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        value={field.value ?? ""}
                        className="w-full px-3 py-2 border rounded-md text-sm"
                      >
                        <option value="">Seleccionar</option>
                        {TIPOS_PROVEEDOR.map((tipo) => (
                          <option key={tipo} value={tipo}>
                            {tipo}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* País & Ciudad */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="pais"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>País</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ciudad"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ciudad</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Contacto & Email */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="contacto_principal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contacto Principal</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        type="email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Teléfono & Sociedad */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="telefono"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sociedad_proveedor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sociedad</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Banco & Cuenta */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="banco_pago"
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
              <FormField
                control={form.control}
                name="cuenta_pago"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cuenta</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {proveedor ? "Guardar Cambios" : "Crear Proveedor"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
