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
import { getCustomers } from '@/actions/customers.actions'
import { fileToBase64 } from '@/lib/file-utils'
import { convertToUSDClient, formatExchangeRate } from '@/lib/currency-client'
import { getHackuClientes, createHackuCliente, type HackuCliente } from '@/actions/hacku-clientes.actions'
import { getTiposDocumento, type TipoDocumento } from '@/actions/tipos-documento.actions'

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
  const [processingPDF, setProcessingPDF] = useState(false)
  const [pdfWarnings, setPdfWarnings] = useState<string[]>([])
  const [pdfError, setPdfError] = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [customers, setCustomers] = useState<any[]>([])
  const [planes, setPlanes] = useState<MasterListItem[]>([])
  const [aliados, setAliados] = useState<MasterListItem[]>([])
  const [vendedores, setVendedores] = useState<MasterListItem[]>([])
  const [, setLoadingLists] = useState(true)
  const [exchangeRateInfo, setExchangeRateInfo] = useState<string>('')
  const [hackuClientes, setHackuClientes] = useState<HackuCliente[]>([])
  const [showNewHackuCliente, setShowNewHackuCliente] = useState(false)
  const [newHackuClienteName, setNewHackuClienteName] = useState('')
  const [creatingHackuCliente, setCreatingHackuCliente] = useState(false)
  const [tiposDocumento, setTiposDocumento] = useState<TipoDocumento[]>([])

  // Load master lists and customers on component mount
  useEffect(() => {
    const loadMasterLists = async () => {
      try {
        const [planesData, aliadosData, vendedoresData, customersData, hackuClientesData, tiposDocData] = await Promise.all([
          getPlanes(),
          getAliados(),
          getVendedores(),
          getCustomers(),
          getHackuClientes(),
          getTiposDocumento(),
        ])
        setPlanes(planesData || [])
        setAliados(aliadosData || [])
        setVendedores(vendedoresData || [])
        setCustomers(customersData || [])
        setHackuClientes(hackuClientesData || [])
        setTiposDocumento(tiposDocData || [])
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    defaultValues: invoice
      ? {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          customer_id: (invoice as any)?.customer_id ?? undefined,
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          fecha_factoraje: (invoice as any)?.fecha_factoraje ?? undefined,
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

  // Watch fields for auto-calculations
  const watchedMoneda = form.watch('moneda')
  const watchedFechaCreacion = form.watch('fecha_creacion')
  const watchedFechaVencimiento = form.watch('fecha_vencimiento')
  const watchedMontoRecurrente = form.watch('monto_recurrente')
  const watchedMontoNoRecurrente = form.watch('monto_no_recurrente')
  const watchedMontoCreacionContenido = form.watch('monto_creacion_contenido')
  const watchedVendedorId = form.watch('vendedor_id')
  const watchedFechaFactoraje = form.watch('fecha_factoraje')

  // 1.1 Auto-calculate días de pago from fecha_creacion and fecha_vencimiento
  useEffect(() => {
    if (watchedFechaCreacion && watchedFechaVencimiento) {
      const start = new Date(watchedFechaCreacion + 'T00:00:00')
      const end = new Date(watchedFechaVencimiento + 'T00:00:00')
      const diffTime = end.getTime() - start.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      if (diffDays >= 0) {
        form.setValue('dia_pago_cliente', diffDays)
      }
    }
  }, [watchedFechaCreacion, watchedFechaVencimiento, form])

  // 1.2 Auto-convert total to USD based on moneda and montos
  useEffect(() => {
    const calculateUSD = async () => {
      const total =
        (watchedMontoRecurrente || 0) +
        (watchedMontoNoRecurrente || 0) +
        (watchedMontoCreacionContenido || 0)

      if (total <= 0) {
        form.setValue('total_usd', null)
        setExchangeRateInfo('')
        return
      }

      if (watchedMoneda === 'USD') {
        form.setValue('total_usd', Math.round(total * 100) / 100)
        setExchangeRateInfo('')
        return
      }

      if (!watchedMoneda) return

      try {
        const result = await convertToUSDClient(total, watchedMoneda, watchedFechaCreacion)
        form.setValue('total_usd', result.amountUSD)
        setExchangeRateInfo(formatExchangeRate(result.rate, watchedMoneda))
      } catch (err) {
        console.error('Error converting to USD:', err)
      }
    }

    calculateUSD()
  }, [watchedMoneda, watchedMontoRecurrente, watchedMontoNoRecurrente, watchedMontoCreacionContenido, watchedFechaCreacion, form])

  // 3. Auto-calculate dia_adelanto_factoraje from fecha_factoraje and fecha_vencimiento
  useEffect(() => {
    if (tieneFactoraje && watchedFechaFactoraje && watchedFechaVencimiento) {
      const factoraje = new Date(watchedFechaFactoraje + 'T00:00:00')
      const vencimiento = new Date(watchedFechaVencimiento + 'T00:00:00')
      const diffTime = vencimiento.getTime() - factoraje.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      if (diffDays >= 0) {
        form.setValue('dia_adelanto_factoraje', diffDays)
      }
    }
  }, [tieneFactoraje, watchedFechaFactoraje, watchedFechaVencimiento, form])

  // 1.3 Auto-populate vendedor legacy name from vendedor_id selection
  useEffect(() => {
    if (watchedVendedorId && vendedores.length > 0) {
      const selected = vendedores.find(v => v.id === watchedVendedorId)
      if (selected) {
        form.setValue('vendedor', selected.nombre)
      }
    }
  }, [watchedVendedorId, vendedores, form])

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
      const result = await processInvoiceWithAI(base64, 'income')

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
      if (extracted.tipo_documento) {
        form.setValue('tipo_documento', extracted.tipo_documento)
      }
      if (extracted.numero_documento) {
        form.setValue('numero_documento', extracted.numero_documento)
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
            <div className="space-y-4">
              {/* Customer Selector */}
              <FormField
                control={form.control}
                name="customer_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cliente (Existente)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value ?? '__none__'}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar cliente existente (opcional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">Sin cliente asignado</SelectItem>
                        {customers.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nombre_cliente} {c.sociedad_cliente ? `(${c.sociedad_cliente})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Razón Social + Sociedad Cliente */}
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
                      {!showNewHackuCliente ? (
                        <>
                          <Select
                            onValueChange={(val) => {
                              if (val === '__new__') {
                                setShowNewHackuCliente(true)
                                return
                              }
                              if (val === '__none__') {
                                field.onChange('')
                                return
                              }
                              field.onChange(val)
                            }}
                            defaultValue={field.value || '__none__'}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccionar hackÜ Cliente" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="__none__">Sin hackÜ Cliente</SelectItem>
                              {hackuClientes.map((hc) => (
                                <SelectItem key={hc.id} value={hc.nombre}>
                                  {hc.nombre}
                                </SelectItem>
                              ))}
                              <SelectItem value="__new__" className="text-blue-600 font-semibold">
                                + Crear nuevo...
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </>
                      ) : (
                        <div className="flex gap-2">
                          <FormControl>
                            <Input
                              placeholder="Nombre del nuevo hackÜ Cliente"
                              value={newHackuClienteName}
                              onChange={(e) => setNewHackuClienteName(e.target.value)}
                              autoFocus
                            />
                          </FormControl>
                          <Button
                            type="button"
                            size="sm"
                            disabled={!newHackuClienteName.trim() || creatingHackuCliente}
                            onClick={async () => {
                              setCreatingHackuCliente(true)
                              try {
                                const created = await createHackuCliente(newHackuClienteName.trim())
                                if (created) {
                                  setHackuClientes(prev => [...prev, created].sort((a, b) => a.nombre.localeCompare(b.nombre)))
                                  field.onChange(created.nombre)
                                }
                              } catch (err) {
                                console.error('Error creating hackU cliente:', err)
                              } finally {
                                setCreatingHackuCliente(false)
                                setShowNewHackuCliente(false)
                                setNewHackuClienteName('')
                              }
                            }}
                          >
                            {creatingHackuCliente ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Crear'}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setShowNewHackuCliente(false)
                              setNewHackuClienteName('')
                            }}
                          >
                            Cancelar
                          </Button>
                        </div>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Documento */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tipo_documento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo Documento</FormLabel>
                    <Select
                      onValueChange={(val) => field.onChange(val === '__none__' ? '' : val)}
                      defaultValue={field.value || '__none__'}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">Sin tipo</SelectItem>
                        {tiposDocumento.map((td) => (
                          <SelectItem key={td.id} value={td.nombre}>
                            {td.nombre}
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
                        readOnly
                        className="bg-gray-50"
                      />
                    </FormControl>
                    {exchangeRateInfo && (
                      <p className="text-xs text-muted-foreground">{exchangeRateInfo}</p>
                    )}
                    {!exchangeRateInfo && watchedMoneda === 'USD' && (
                      <p className="text-xs text-muted-foreground">Moneda USD - sin conversión</p>
                    )}
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
                      <Input
                        type="number"
                        {...field}
                        readOnly
                        className="bg-gray-50"
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">Calculado automáticamente</p>
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
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="fecha_factoraje"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha Tentativa Factoraje</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} value={field.value ?? ''} />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">Fecha en que se espera el adelanto</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                          readOnly
                          className="bg-gray-50"
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">Calculado automáticamente</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
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
                      <Input {...field} value={field.value ?? ''} placeholder="Se auto-llena al seleccionar vendedor" />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">Auto-llenado desde Vendedor o editable</p>
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
