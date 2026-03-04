// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  expenseInvoiceSchema,
  type ExpenseInvoiceFormData,
} from '@/lib/validations/expense-invoice.schema'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Loader2, AlertCircle } from 'lucide-react'
import {
  SOCIEDADES,
  MONEDAS,
  EXPENSE_TIPOS,
  EXPENSE_AREAS,
  EXPENSE_CATEGORIAS,
  FRECUENCIAS,
} from '@/lib/constants'
import type { Database } from '@/types/database.types'
import { Separator } from '@/components/ui/separator'
import { PDFUploadField } from '@/components/shared/pdf-upload-field'
import { processInvoiceWithAI } from '@/actions/invoice-processor.actions'
import { getConceptosGasto, getTiposPago, getPrioridades } from '@/actions/master-lists.actions'
import { getProveedores } from '@/actions/proveedores.actions'
import { fileToBase64 } from '@/lib/file-utils'

type ExpenseInvoice = Database['public']['Tables']['expense_invoices']['Row']

interface ExpenseInvoiceFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: ExpenseInvoiceFormData) => Promise<void>
  invoice?: ExpenseInvoice | null
  loading?: boolean
}

interface MasterListItem {
  id: string
  nombre: string
  nivel?: number
  descripcion?: string
}

export function ExpenseInvoiceForm({
  open,
  onClose,
  onSubmit,
  invoice,
  loading = false,
}: ExpenseInvoiceFormProps) {
  const [selectedPDFFile, setSelectedPDFFile] = useState<File | null>(null)
  const [processingPDF, setProcessingPDF] = useState(false)
  const [pdfWarnings, setPdfWarnings] = useState<string[]>([])
  const [pdfError, setPdfError] = useState<string | null>(null)
  const [conceptos, setConceptos] = useState<MasterListItem[]>([])
  const [tiposPago, setTiposPago] = useState<MasterListItem[]>([])
  const [prioridades, setPrioridades] = useState<MasterListItem[]>([])
  const [proveedores, setProveedores] = useState<{ id: string; nombre_proveedor: string }[]>([])

  // Load master lists on component mount
  useEffect(() => {
    const loadMasterLists = async () => {
      try {
        const [conceptosData, tiposPagoData, prioridadesData, proveedoresData] = await Promise.all([
          getConceptosGasto(),
          getTiposPago(),
          getPrioridades(),
          getProveedores(),
        ])
        setConceptos(conceptosData || [])
        setTiposPago(tiposPagoData || [])
        setPrioridades(prioridadesData || [])
        setProveedores(proveedoresData || [])
      } catch (error) {
        console.error('Error loading master lists:', error)
      } finally {
        setLoadingLists(false)
      }
    }

    if (open) {
      loadMasterLists()
    }
  }, [open])

  const form = useForm<ExpenseInvoiceFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(expenseInvoiceSchema) as any,
    defaultValues: invoice
      ? {
          sociedad: invoice.sociedad,
          tipo: invoice.tipo,
          area: invoice.area,
          fecha_emision: invoice.fecha_emision,
          nombre_proveedor_concepto: invoice.nombre_proveedor_concepto,
          moneda: invoice.moneda,
          monto_sin_impuestos: invoice.monto_sin_impuestos,
          categoria: invoice.categoria,
          recurrente: invoice.recurrente,
          frecuencia_recurrencia: invoice.frecuencia_recurrencia ?? undefined,
          como_se_pagara: invoice.como_se_pagara ?? undefined,
          fecha_pago_o_cobro: invoice.fecha_pago_o_cobro ?? undefined,
          moneda_pago: invoice.moneda_pago ?? undefined,
          monto_pago: invoice.monto_pago ?? undefined,
          prioridad_pago: invoice.prioridad_pago ?? undefined,
          logica_prioridad: invoice.logica_prioridad ?? undefined,
          expectativa_pago: invoice.expectativa_pago ?? undefined,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          concepto_id: (invoice as any)?.concepto_id ?? undefined,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tipo_pago_id: (invoice as any)?.tipo_pago_id ?? undefined,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          prioridad_id: (invoice as any)?.prioridad_id ?? undefined,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          proveedor_id: (invoice as any)?.proveedor_id ?? undefined,
        }
      : {
          recurrente: false,
          fecha_emision: new Date().toISOString().split('T')[0],
        },
  })

  const recurrente = form.watch('recurrente')

  const handleProcessPDF = async () => {
    if (!selectedPDFFile) {
      setPdfError('Por favor selecciona un PDF')
      return
    }

    setProcessingPDF(true)
    setPdfError(null)
    setPdfWarnings([])

    try {
      // Convert file to base64 for processing
      const base64 = await fileToBase64(selectedPDFFile)

      // Process the PDF with OpenAI Vision (uses server API key automatically)
      const result = await processInvoiceWithAI(base64, 'expense')

      if (!result.success) {
        setPdfError('No se pudo procesar el PDF correctamente')
        setPdfWarnings(result.warnings)
        return
      }

      // Populate form fields with extracted data
      const extracted = result.extracted_data

      if (extracted.nombre_cliente_proveedor) {
        form.setValue('nombre_proveedor_concepto', extracted.nombre_cliente_proveedor)
      }
      if (extracted.monto) {
        form.setValue('monto_sin_impuestos', extracted.monto)
      }
      if (extracted.fecha) {
        form.setValue('fecha_emision', extracted.fecha)
      }
      if (extracted.moneda) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        form.setValue('moneda', extracted.moneda as any)
      }
      if (extracted.concepto) {
        form.setValue('nombre_proveedor_concepto', extracted.concepto)
      }
      if (extracted.fecha_vencimiento) {
        form.setValue('fecha_pago_o_cobro', extracted.fecha_vencimiento)
      }

      setPdfWarnings(result.warnings)
      setSelectedPDFFile(null)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido'
      setPdfError(errorMessage)
    } finally {
      setProcessingPDF(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {invoice ? 'Editar Factura de Gasto' : 'Nueva Factura de Gasto'}
          </DialogTitle>
        </DialogHeader>

        {/* PDF Upload Section */}
        {!invoice && (
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 space-y-3">
            <p className="text-sm font-semibold text-blue-900">
              Cargar PDF de Factura (Opcional)
            </p>
            <PDFUploadField
              onFileSelect={setSelectedPDFFile}
              invoiceType="expense"
            />

            {selectedPDFFile && (
              <Button
                type="button"
                onClick={handleProcessPDF}
                disabled={processingPDF}
                className="w-full"
              >
                {processingPDF && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Procesar PDF con IA
              </Button>
            )}

            {pdfError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{pdfError}</AlertDescription>
              </Alert>
            )}

            {pdfWarnings.length > 0 && (
              <Alert variant="default" className="border-yellow-300 bg-yellow-50">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Advertencias</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-5 mt-1 space-y-1">
                    {pdfWarnings.map((warning, idx) => (
                      <li key={idx} className="text-sm">{warning}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Row 1: Sociedad, Tipo, Área */}
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="sociedad"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sociedad *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {SOCIEDADES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {EXPENSE_TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="area"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Área *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {EXPENSE_AREAS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Concepto & Categoría */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="concepto_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Concepto de Gasto *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar concepto" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {conceptos.map((concepto) => (
                          <SelectItem key={concepto.id} value={concepto.id}>
                            {concepto.nombre}
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
                name="categoria"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoría *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {EXPENSE_CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Proveedor selector */}
            <FormField
              control={form.control}
              name="proveedor_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Proveedor</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value ?? '__none__'}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar proveedor (opcional)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">Sin proveedor</SelectItem>
                      {proveedores.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nombre_proveedor}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Legacy: nombre_proveedor_concepto (hidden) */}
            <FormField
              control={form.control}
              name="nombre_proveedor_concepto"
              render={({ field }) => (
                <FormItem className="hidden">
                  <FormControl><Input {...field} /></FormControl>
                </FormItem>
              )}
            />

            {/* Monto */}
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="moneda"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Moneda *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {MONEDAS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="monto_sin_impuestos"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monto (sin impuestos) *</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="fecha_emision"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha Emisión *</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Recurrencia */}
            <FormField
              control={form.control}
              name="recurrente"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="!mt-0">¿Es recurrente?</FormLabel>
                </FormItem>
              )}
            />
            {recurrente && (
              <FormField
                control={form.control}
                name="frecuencia_recurrencia"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Frecuencia</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value ?? undefined}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {FRECUENCIAS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <Separator />

            {/* Pago */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tipo_pago_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Pago</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar tipo de pago" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {tiposPago.map((tipo) => (
                          <SelectItem key={tipo.id} value={tipo.id}>
                            {tipo.nombre}
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
                name="fecha_pago_o_cobro"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha Pago / Cobro</FormLabel>
                    <FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Legacy: como_se_pagara (hidden) */}
            <FormField
              control={form.control}
              name="como_se_pagara"
              render={({ field }) => (
                <FormItem className="hidden">
                  <FormControl><Input {...field} value={field.value ?? ''} /></FormControl>
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="moneda_pago"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Moneda Pago</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value ?? undefined}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {MONEDAS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="monto_pago"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monto Pago</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : null)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Prioridad */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="prioridad_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prioridad de Pago</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar prioridad" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {prioridades.map((prioridad) => (
                          <SelectItem key={prioridad.id} value={prioridad.id}>
                            {prioridad.nombre}
                            {prioridad.descripcion && ` — ${prioridad.descripcion}`}
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
                name="expectativa_pago"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expectativa Pago</FormLabel>
                    <FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Legacy: prioridad_pago & logica_prioridad (hidden) */}
            <div className="hidden">
              <FormField
                control={form.control}
                name="prioridad_pago"
                render={({ field }) => (
                  <FormItem>
                    <FormControl><Input {...field} /></FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="logica_prioridad"
                render={({ field }) => (
                  <FormItem>
                    <FormControl><Input {...field} /></FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {invoice ? 'Guardar Cambios' : 'Crear Gasto'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
