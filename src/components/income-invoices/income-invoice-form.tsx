// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { incomeInvoiceSchema, type IncomeInvoiceFormData } from '@/lib/validations/income-invoice.schema'
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
import { SOCIEDADES, MONEDAS, INVOICE_ESTADOS } from '@/lib/constants'
import type { Database } from '@/types/database.types'
import { Separator } from '@/components/ui/separator'
import { PDFUploadField } from '@/components/shared/pdf-upload-field'
import { processInvoiceWithAI } from '@/actions/invoice-processor.actions'
import { getPlanes, getAliados, getVendedores } from '@/actions/master-lists.actions'
import { fileToBase64 } from '@/lib/file-utils'

type IncomeInvoice = Database['public']['Tables']['income_invoices']['Row']

interface IncomeInvoiceFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: IncomeInvoiceFormData) => Promise<void>
  invoice?: IncomeInvoice | null
  loading?: boolean
}

interface MasterListItem {
  id: string
  nombre: string
  porcentaje_comision?: number
  rol?: string
}

export function IncomeInvoiceForm({
  open,
  onClose,
  onSubmit,
  invoice,
  loading = false,
}: IncomeInvoiceFormProps) {
  const [selectedPDFFile, setSelectedPDFFile] = useState<File | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [processingPDF, setProcessingPDF] = useState(false)
  const [pdfWarnings, setPdfWarnings] = useState<string[]>([])
  const [pdfError, setPdfError] = useState<string | null>(null)
  const [planes, setPlanes] = useState<MasterListItem[]>([])
  const [aliados, setAliados] = useState<MasterListItem[]>([])
  const [vendedores, setVendedores] = useState<MasterListItem[]>([])
  const [, setLoadingLists] = useState(true)

  // Load master lists on component mount
  useEffect(() => {
    const loadMasterLists = async () => {
      try {
        const [planesData, aliadosData, vendedoresData] = await Promise.all([
          getPlanes(),
          getAliados(),
          getVendedores(),
        ])
        setPlanes(planesData || [])
        setAliados(aliadosData || [])
        setVendedores(vendedoresData || [])
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

  const form = useForm<IncomeInvoiceFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(incomeInvoiceSchema) as any,
    defaultValues: invoice
      ? {
          sociedad: invoice.sociedad,
          razon_social_cliente: invoice.razon_social_cliente,
          hacku_cliente: invoice.hacku_cliente ?? undefined,
          tipo_documento: invoice.tipo_documento ?? undefined,
          numero_documento: invoice.numero_documento ?? undefined,
          estado: invoice.estado,
          moneda: invoice.moneda,
          fecha_creacion: invoice.fecha_creacion,
          fecha_vencimiento: invoice.fecha_vencimiento,
          dia_pago_cliente: invoice.dia_pago_cliente,
          dia_adelanto_factoraje: invoice.dia_adelanto_factoraje ?? undefined,
          tiene_factoraje: invoice.tiene_factoraje,
          monto_no_recurrente: invoice.monto_no_recurrente,
          monto_creacion_contenido: invoice.monto_creacion_contenido,
          monto_recurrente: invoice.monto_recurrente,
          total_usd: invoice.total_usd ?? undefined,
          meses_causados: invoice.meses_causados ?? undefined,
          fecha_inicio_causacion: invoice.fecha_inicio_causacion ?? undefined,
          fecha_fin_causacion: invoice.fecha_fin_causacion ?? undefined,
          vendedor: invoice.vendedor ?? undefined,
          porcentaje_comision: invoice.porcentaje_comision ?? undefined,
          comision_aliado: invoice.comision_aliado,
          porcentaje_comision_aliado: invoice.porcentaje_comision_aliado ?? undefined,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          plan_id: (invoice as any)?.plan_id ?? undefined,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          aliado_id: (invoice as any)?.aliado_id ?? undefined,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          vendedor_id: (invoice as any)?.vendedor_id ?? undefined,
        }
      : {
          estado: 'Pendiente',
          tiene_factoraje: false,
          comision_aliado: false,
          dia_pago_cliente: 0,
          monto_no_recurrente: 0,
          monto_creacion_contenido: 0,
          monto_recurrente: 0,
          fecha_creacion: new Date().toISOString().split('T')[0],
        },
  })

  const tieneFactoraje = form.watch('tiene_factoraje')
  const comisionAliado = form.watch('comision_aliado')

  const handleProcessPDF = async () => {
    if (!selectedPDFFile || !apiKey) {
      setPdfError('Por favor selecciona un PDF y proporciona tu API Key de OpenAI')
      return
    }

    setProcessingPDF(true)
    setPdfError(null)
    setPdfWarnings([])

    try {
      // Convert file to base64 for processing
      const base64 = await fileToBase64(selectedPDFFile)

      // Process the PDF with OpenAI Vision
      const result = await processInvoiceWithAI(base64, 'income', apiKey)

      if (!result.success) {
        setPdfError('No se pudo procesar el PDF correctamente')
        setPdfWarnings(result.warnings)
        return
      }

      // Populate form fields with extracted data
      const extracted = result.extracted_data

      if (extracted.nombre_cliente_proveedor) {
        form.setValue('razon_social_cliente', extracted.nombre_cliente_proveedor)
      }
      if (extracted.monto) {
        form.setValue('monto_recurrente', extracted.monto)
      }
      if (extracted.fecha) {
        form.setValue('fecha_creacion', extracted.fecha)
      }
      if (extracted.moneda) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        form.setValue('moneda', extracted.moneda as any)
      }
      if (extracted.concepto) {
        form.setValue('tipo_documento', extracted.concepto)
      }
      if (extracted.fecha_vencimiento) {
        form.setValue('fecha_vencimiento', extracted.fecha_vencimiento)
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
            {invoice ? 'Editar Factura de Ingreso' : 'Nueva Factura de Ingreso'}
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
              invoiceType="income"
            />

            {selectedPDFFile && (
              <div className="space-y-3">
                <div className="text-sm space-y-2">
                  <label className="block font-semibold">
                    OpenAI API Key (para procesar PDF)
                  </label>
                  <Input
                    type="password"
                    placeholder="sk-proj-..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="text-sm"
                  />
                  <p className="text-xs text-gray-500">
                    Tu API key se usa solo para procesar este PDF y no se almacena.
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={handleProcessPDF}
                  disabled={processingPDF}
                  className="w-full"
                >
                  {processingPDF && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Procesar PDF con IA
                </Button>
              </div>
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
            {/* Sociedad & Estado */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="sociedad"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sociedad *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SOCIEDADES.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="estado"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {INVOICE_ESTADOS.map((e) => (
                          <SelectItem key={e} value={e}>{e}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Cliente */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="razon_social_cliente"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Razón Social Cliente *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Nombre del cliente" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="hacku_cliente"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>hackÜ Cliente</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Documento */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tipo_documento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo Documento</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ''} placeholder="Factura, Nota, etc." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="numero_documento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>N° Documento</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Moneda & Fechas */}
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="moneda"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Moneda *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Moneda" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {MONEDAS.map((m) => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="fecha_creacion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha Creación *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
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
                    <FormLabel>Fecha Vencimiento *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Montos */}
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="monto_recurrente"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monto Recurrente</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="monto_no_recurrente"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monto No Recurrente</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="monto_creacion_contenido"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Creación Contenido</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* USD & Días pago */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="total_usd"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total USD</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        value={field.value ?? ''}
                        onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dia_pago_cliente"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Días Pago Cliente</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value) || 0)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Factoraje */}
            <FormField
              control={form.control}
              name="tiene_factoraje"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="!mt-0">¿Tiene Factoraje?</FormLabel>
                </FormItem>
              )}
            />
            {tieneFactoraje && (
              <FormField
                control={form.control}
                name="dia_adelanto_factoraje"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Días Adelanto Factoraje</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        value={field.value ?? ''}
                        onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <Separator />

            {/* Causación */}
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="meses_causados"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Meses Causados</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        value={field.value ?? ''}
                        onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="fecha_inicio_causacion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Inicio Causación</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="fecha_fin_causacion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fin Causación</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Plan, Vendedor, Aliado - Master Lists */}
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="plan_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Plan de Servicio</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar plan" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {planes.map((plan) => (
                          <SelectItem key={plan.id} value={plan.id}>
                            {plan.nombre}
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
                name="vendedor_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vendedor (KAM/Hunter)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar vendedor" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {vendedores.map((vendedor) => (
                          <SelectItem key={vendedor.id} value={vendedor.id}>
                            {vendedor.nombre} ({vendedor.rol})
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
                name="aliado_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Aliado / Reseller</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar aliado (opcional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">Sin aliado</SelectItem>
                        {aliados.map((aliado) => (
                          <SelectItem key={aliado.id} value={aliado.id}>
                            {aliado.nombre} ({aliado.porcentaje_comision}%)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Legacy fields (kept for backward compatibility) */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="vendedor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre Vendedor (Legacy)</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ''} placeholder="Automático desde Vendedor" disabled />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="porcentaje_comision"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>% Comisión (Legacy)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        value={field.value ?? ''}
                        onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="comision_aliado"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="!mt-0">¿Tiene Comisión Aliado? (Legacy)</FormLabel>
                </FormItem>
              )}
            />
            {comisionAliado && (
              <FormField
                control={form.control}
                name="porcentaje_comision_aliado"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>% Comisión Aliado (Legacy)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        value={field.value ?? ''}
                        onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {invoice ? 'Guardar Cambios' : 'Crear Factura'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
