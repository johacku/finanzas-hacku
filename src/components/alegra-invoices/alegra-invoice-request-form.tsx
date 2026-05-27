// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  alegraInvoiceRequestSchema,
  type AlegraInvoiceRequestFormData,
  type AlegraInvoiceItem,
} from '@/lib/validations/alegra-invoice.schema'
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
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, Plus, Trash2, Search } from 'lucide-react'
import { SOCIEDADES, MONEDAS } from '@/lib/constants'
import { convertToUSDClient } from '@/lib/currency-client'
import { useToast } from '@/hooks/use-toast'
import {
  getAlegraContacts,
  getAlegraItems,
  createAlegraInvoiceDraft,
  createAlegraInvoiceRequest,
  uploadOCFile,
  sendDiferidoToSheets,
  sendSlackNewRequestNotification,
} from '@/actions/alegra.actions'
import { getVendedores } from '@/actions/master-lists.actions'

interface AlegraInvoiceRequestFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  userEmail: string
  userName: string
}

export function AlegraInvoiceRequestForm({
  open,
  onOpenChange,
  onSuccess,
  userEmail,
  userName,
}: AlegraInvoiceRequestFormProps) {
  const { toast } = useToast()
  const [submitting, setSubmitting] = useState(false)

  // Client search state
  const [clientSearch, setClientSearch] = useState('')
  const [clients, setClients] = useState<any[]>([])
  const [clientsLoading, setClientsLoading] = useState(false)
  const [showClientResults, setShowClientResults] = useState(false)

  // Item search state (per row)
  const [itemSearches, setItemSearches] = useState<Record<number, string>>({})
  const [itemResults, setItemResults] = useState<Record<number, any[]>>({})
  const [itemsLoading, setItemsLoading] = useState<Record<number, boolean>>({})
  const [showItemResults, setShowItemResults] = useState<Record<number, boolean>>({})

  // Exchange rate
  const [exchangeRateInfo, setExchangeRateInfo] = useState<string>('')
  const [totalUSD, setTotalUSD] = useState<number | null>(null)

  // Vendedores
  const [vendedores, setVendedores] = useState<any[]>([])
  const [selectedVendedorNombre, setSelectedVendedorNombre] = useState('')

  // OC file
  const [ocFile, setOcFile] = useState<File | null>(null)

  // Flag to suppress search after selection
  const [clientJustSelected, setClientJustSelected] = useState(false)
  const [itemJustSelected, setItemJustSelected] = useState<Record<number, boolean>>({})

  // Cliente nuevo state
  const [esClienteNuevo, setEsClienteNuevo] = useState(false)
  const [nombreClienteNuevo, setNombreClienteNuevo] = useState('')

  // Comisión state
  const [porcentajeComision, setPorcentajeComision] = useState<number>(5)

  // Diferido (installment) state - local only, not sent to Alegra
  const [esDiferido, setEsDiferido] = useState(false)
  const [numeroCuotas, setNumeroCuotas] = useState<number>(1)
  const [cuotas, setCuotas] = useState<Array<{ mes: string; monto: number }>>([])

  // Load vendedores on mount
  useEffect(() => {
    getVendedores().then((data) => setVendedores(data || [])).catch(console.error)
  }, [])

  const form = useForm<AlegraInvoiceRequestFormData>({
    resolver: zodResolver(alegraInvoiceRequestSchema),
    defaultValues: {
      alegra_client_id: '',
      alegra_client_name: '',
      sociedad: SOCIEDADES[0],
      moneda: 'COP',
      fecha_emision: new Date().toISOString().split('T')[0],
      fecha_vencimiento: '',
      observaciones: '',
      anotaciones: 'Por favor pagar a la cuenta de ahorros Bancolombia N°24599671591',
      items: [],
      solicitante_email: userEmail,
      solicitante_nombre: userName,
      oc_numero: '',
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  })

  const watchedItems = form.watch('items')
  const watchedMoneda = form.watch('moneda')
  const watchedFechaEmision = form.watch('fecha_emision')

  // Debounced client search
  useEffect(() => {
    if (clientJustSelected) {
      setClientJustSelected(false)
      return
    }
    const timer = setTimeout(async () => {
      if (clientSearch.length >= 2) {
        setClientsLoading(true)
        try {
          const result = await getAlegraContacts(clientSearch)
          setClients(result.data || result || [])
          setShowClientResults(true)
        } catch (e) {
          console.error(e)
        } finally {
          setClientsLoading(false)
        }
      } else {
        setClients([])
        setShowClientResults(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [clientSearch])

  // Debounced item search per row
  useEffect(() => {
    const timers: Record<number, NodeJS.Timeout> = {}
    Object.entries(itemSearches).forEach(([indexStr, query]) => {
      const index = parseInt(indexStr)
      if (itemJustSelected[index]) {
        setItemJustSelected((prev) => ({ ...prev, [index]: false }))
        return
      }
      if (query.length >= 2) {
        timers[index] = setTimeout(async () => {
          setItemsLoading((prev) => ({ ...prev, [index]: true }))
          try {
            const result = await getAlegraItems(query)
            setItemResults((prev) => ({ ...prev, [index]: result.data || result || [] }))
            setShowItemResults((prev) => ({ ...prev, [index]: true }))
          } catch (e) {
            console.error(e)
          } finally {
            setItemsLoading((prev) => ({ ...prev, [index]: false }))
          }
        }, 300)
      }
    })
    return () => Object.values(timers).forEach(clearTimeout)
  }, [itemSearches])

  // Calculate totals
  const calculateSubtotal = (item: AlegraInvoiceItem) => {
    const base = (item.quantity || 0) * (item.price || 0)
    const discount = item.discount || 0
    return base * (1 - discount / 100)
  }

  const grandTotal = (watchedItems || []).reduce(
    (acc, item) => acc + calculateSubtotal(item),
    0
  )

  // Convert to USD when moneda or total changes
  useEffect(() => {
    async function convert() {
      if (watchedMoneda && watchedMoneda !== 'USD' && grandTotal > 0) {
        try {
          const result = await convertToUSDClient(
            grandTotal,
            watchedMoneda,
            watchedFechaEmision || undefined
          )
          setTotalUSD(result.amountUSD)
          setExchangeRateInfo(`Tasa: 1 USD = ${result.rate} ${watchedMoneda} (${result.source})`)
        } catch {
          setTotalUSD(null)
          setExchangeRateInfo('')
        }
      } else if (watchedMoneda === 'USD') {
        setTotalUSD(grandTotal)
        setExchangeRateInfo('')
      }
    }
    convert()
  }, [grandTotal, watchedMoneda, watchedFechaEmision])

  // Auto-calculate installments when diferido params change
  useEffect(() => {
    if (!esDiferido || numeroCuotas <= 0 || grandTotal <= 0) {
      setCuotas([])
      return
    }
    const montoPorCuota = Math.round((grandTotal / numeroCuotas) * 100) / 100
    const fechaBase = form.getValues('fecha_emision')
      ? new Date(form.getValues('fecha_emision') + 'T00:00:00')
      : new Date()

    const nuevasCuotas = Array.from({ length: numeroCuotas }, (_, i) => {
      const fecha = new Date(fechaBase)
      fecha.setMonth(fecha.getMonth() + i)
      const mesNombre = fecha.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
      return {
        mes: mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1),
        monto: i === numeroCuotas - 1
          ? Math.round((grandTotal - montoPorCuota * (numeroCuotas - 1)) * 100) / 100
          : montoPorCuota,
      }
    })
    setCuotas(nuevasCuotas)
  }, [esDiferido, numeroCuotas, grandTotal])

  function handleSelectClient(client: any) {
    form.setValue('alegra_client_id', String(client.id))
    form.setValue('alegra_client_name', client.name)
    setClientJustSelected(true)
    setClientSearch(client.name)
    setShowClientResults(false)
    setClients([])
  }

  function handleSelectItem(index: number, item: any) {
    form.setValue(`items.${index}.alegra_item_id`, String(item.id))
    form.setValue(`items.${index}.name`, item.name)
    form.setValue(`items.${index}.description`, item.description || '')
    form.setValue(`items.${index}.price`, item.price?.[0]?.price || item.price || 0)
    setItemJustSelected((prev) => ({ ...prev, [index]: true }))
    setItemSearches((prev) => ({ ...prev, [index]: item.name }))
    setShowItemResults((prev) => ({ ...prev, [index]: false }))
    setItemResults((prev) => ({ ...prev, [index]: [] }))
  }

  function handleAddItem() {
    append({
      alegra_item_id: '',
      name: '',
      description: '',
      quantity: 1,
      price: 0,
      discount: 0,
      tax: [],
    })
  }

  async function handleSubmit(data: AlegraInvoiceRequestFormData) {
    setSubmitting(true)
    try {
      // 1. Upload OC file if present
      let ocUrl: string | undefined
      if (ocFile) {
        const fd = new FormData()
        fd.append('file', ocFile)
        const uploadResult = await uploadOCFile(fd)
        // uploadOCFile returns the public URL string directly
        ocUrl = typeof uploadResult === 'string' ? uploadResult : uploadResult?.publicUrl || uploadResult?.url || undefined
      }

      // 2. Only create draft in Alegra for hackÜ SAS and non-new clients
      let alegraInvoiceId: string | null = null
      const isHackuSAS = data.sociedad === 'hackÜ SAS'
      const shouldSendToAlegra = isHackuSAS && !esClienteNuevo

      if (shouldSendToAlegra) {
        // If currency is not COP, fetch the TRM for the emission date to send to Alegra
        let currencyPayload: { code: string; exchangeRate: string } | undefined
        if (data.moneda !== 'COP') {
          const { rate } = await convertToUSDClient(1, 'COP', data.fecha_emision)
          currencyPayload = { code: data.moneda, exchangeRate: String(rate) }
        }

        // Alegra items only need: id, price, quantity, description (optional), discount (optional), tax (optional)
        const alegraItems = data.items.map((item) => ({
          id: item.alegra_item_id,
          price: item.price,
          quantity: item.quantity,
          description: item.description || undefined,
          discount: item.discount || 0,
        }))

        const draftResult = await createAlegraInvoiceDraft({
          clientId: data.alegra_client_id,
          date: data.fecha_emision,
          dueDate: data.fecha_vencimiento,
          items: alegraItems,
          currency: currencyPayload,
          observations: data.observaciones || undefined,
          anotation: data.anotaciones || undefined,
          purchaseOrderNumber: data.oc_numero || undefined,
        })
        alegraInvoiceId = String(draftResult?.id ?? '')  || null
      }

      // Append diferido info to observaciones if applicable
      let finalObservaciones = data.observaciones || ''
      if (esDiferido && cuotas.length > 0) {
        const cuotasText = cuotas.map(c => `${c.mes}: ${new Intl.NumberFormat('es-CO').format(c.monto)}`).join(' | ')
        finalObservaciones += `\n\nPago diferido en ${numeroCuotas} cuotas: ${cuotasText}`
      }

      // Append commission info to observaciones (local only, not sent to Alegra)
      const comisionMonto = grandTotal * (porcentajeComision / 100)
      if (porcentajeComision > 0 && grandTotal > 0) {
        finalObservaciones += `\n\nComisión: ${porcentajeComision}% = ${new Intl.NumberFormat('es-CO').format(comisionMonto)} ${data.moneda}`
      }

      // 3. Save in our DB
      await createAlegraInvoiceRequest({
        alegra_invoice_id: alegraInvoiceId,
        alegra_client_id: data.alegra_client_id,
        alegra_client_name: data.alegra_client_name,
        sociedad: data.sociedad,
        moneda: data.moneda,
        fecha_emision: data.fecha_emision,
        fecha_vencimiento: data.fecha_vencimiento,
        observaciones: finalObservaciones || null,
        anotaciones: data.anotaciones || null,
        items: data.items as any,
        subtotal: grandTotal,
        impuestos: 0,
        total: grandTotal,
        total_usd: totalUSD ?? undefined,
        solicitante_email: data.solicitante_email,
        solicitante_nombre: data.solicitante_nombre,
        oc_numero: data.oc_numero || null,
        oc_url: ocUrl || null,
        vendedor_nombre: selectedVendedorNombre || null,
        status: shouldSendToAlegra ? 'borrador' : 'pendiente_aprobacion',
      })

      // 4. Send diferido data to Google Sheets if applicable
      if (esDiferido && cuotas.length > 0) {
        const cuotasWithUSD = cuotas.map((c) => ({
          mes: c.mes,
          monto: c.monto,
          monto_usd: watchedMoneda !== 'USD' && totalUSD && grandTotal > 0
            ? Math.round((c.monto / grandTotal) * totalUSD * 100) / 100
            : c.monto,
        }))

        // Fire and forget - don't block the form submission
        sendDiferidoToSheets({
          client_name: data.alegra_client_name,
          sociedad: data.sociedad,
          vendedor: selectedVendedorNombre || data.solicitante_nombre,
          fecha_emision: data.fecha_emision,
          cuotas: cuotasWithUSD,
        }).catch(console.error)
      }

      // 5. Send Slack notification (fire and forget)
      sendSlackNewRequestNotification({
        client_name: data.alegra_client_name,
        sociedad: data.sociedad,
        moneda: data.moneda,
        total: grandTotal,
        total_usd: totalUSD,
        vendedor: selectedVendedorNombre || '',
        solicitante: data.solicitante_nombre,
        fecha_emision: data.fecha_emision,
        es_cliente_nuevo: esClienteNuevo,
        es_diferido: esDiferido,
        num_cuotas: esDiferido ? numeroCuotas : undefined,
      }).catch(console.error)

      toast({
        title: 'Solicitud creada',
        description: shouldSendToAlegra
          ? 'Borrador enviado a Alegra y solicitud registrada.'
          : esClienteNuevo
            ? 'Solicitud registrada con cliente nuevo (pendiente de aprobación).'
            : 'Solicitud registrada (pendiente de facturación).',
      })
      form.reset()
      setClientSearch('')
      setOcFile(null)
      setEsClienteNuevo(false)
      setNombreClienteNuevo('')
      onOpenChange(false)
      onSuccess?.()
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Error al crear la solicitud',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Solicitar Factura</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Cliente Nuevo Checkbox */}
            <div className="flex items-center gap-3">
              <Checkbox
                id="cliente_nuevo"
                checked={esClienteNuevo}
                onCheckedChange={(checked) => {
                  setEsClienteNuevo(checked === true)
                  if (checked) {
                    form.setValue('alegra_client_id', 'nuevo')
                    form.setValue('alegra_client_name', '')
                    setClientSearch('')
                  }
                }}
              />
              <label htmlFor="cliente_nuevo" className="text-sm font-medium cursor-pointer">
                ¿Es cliente nuevo? (no se envía a Alegra)
              </label>
            </div>

            {/* Client Search or New Client Input */}
            {esClienteNuevo ? (
              <div>
                <label className="text-sm font-medium">Nombre del cliente nuevo *</label>
                <Input
                  placeholder="Nombre del nuevo cliente..."
                  value={nombreClienteNuevo}
                  onChange={(e) => {
                    setNombreClienteNuevo(e.target.value)
                    form.setValue('alegra_client_name', e.target.value)
                    form.setValue('alegra_client_id', 'nuevo')
                  }}
                  className="mt-1"
                />
              </div>
            ) : (
              <div className="relative">
                <FormField
                  control={form.control}
                  name="alegra_client_id"
                  render={() => (
                    <FormItem>
                      <FormLabel>Cliente Alegra *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Buscar cliente..."
                            value={clientSearch}
                            onChange={(e) => setClientSearch(e.target.value)}
                            className="pl-9"
                          />
                          {clientsLoading && (
                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />
                          )}
                        </div>
                      </FormControl>
                      {showClientResults && clients.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                          {clients.map((client) => (
                            <button
                              key={client.id}
                              type="button"
                              className="w-full text-left px-3 py-2 hover:bg-slate-100 text-sm"
                              onClick={() => handleSelectClient(client)}
                            >
                              {client.name} {client.identification ? `- ${client.identification}` : ''}
                            </button>
                          ))}
                        </div>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Sociedad & Moneda */}
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
                          <SelectValue placeholder="Seleccionar sociedad" />
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
            </div>

            {/* Fechas */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="fecha_emision"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha Emisión *</FormLabel>
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

            {/* Vendedor */}
            <div>
              <label className="text-sm font-medium">Vendedor / KAM</label>
              <Select
                value={selectedVendedorNombre}
                onValueChange={(val) => setSelectedVendedorNombre(val)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Seleccionar vendedor" />
                </SelectTrigger>
                <SelectContent>
                  {vendedores.map((v) => (
                    <SelectItem key={v.id} value={v.nombre}>
                      {v.nombre} ({v.rol || 'KAM'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Items Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Items de Factura</h3>
                <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                  <Plus className="mr-1 h-4 w-4" />
                  Agregar Item
                </Button>
              </div>

              {fields.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay items. Haz clic en &quot;Agregar Item&quot; para comenzar.
                </p>
              )}

              {fields.map((field, index) => (
                <div key={field.id} className="border rounded-lg p-4 mb-3 space-y-3">
                  {/* Item search */}
                  <div className="relative">
                    <label className="text-xs font-medium">Buscar Item Alegra</label>
                    <div className="relative mt-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar item..."
                        value={itemSearches[index] || ''}
                        onChange={(e) =>
                          setItemSearches((prev) => ({ ...prev, [index]: e.target.value }))
                        }
                        className="pl-9"
                      />
                      {itemsLoading[index] && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />
                      )}
                    </div>
                    {showItemResults[index] && (itemResults[index] || []).length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                        {itemResults[index].map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className="w-full text-left px-3 py-2 hover:bg-slate-100 text-sm"
                            onClick={() => handleSelectItem(index, item)}
                          >
                            {item.name} {item.reference ? `(${item.reference})` : ''}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-5 gap-3 items-end">
                    <FormField
                      control={form.control}
                      name={`items.${index}.quantity`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Cantidad</FormLabel>
                          <FormControl>
                            <Input type="number" min="1" step="1" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`items.${index}.price`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Precio</FormLabel>
                          <FormControl>
                            <Input type="number" min="0" step="0.01" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`items.${index}.discount`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Descuento %</FormLabel>
                          <FormControl>
                            <Input type="number" min="0" max="100" step="0.01" {...field} value={field.value ?? 0} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Subtotal</p>
                      <p className="text-sm font-medium h-10 flex items-center">
                        {new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2 }).format(
                          calculateSubtotal(watchedItems?.[index] || { quantity: 0, price: 0 })
                        )}
                      </p>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-700"
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}

              {fields.length > 0 && (
                <FormField
                  control={form.control}
                  name="items"
                  render={() => (
                    <FormItem>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Totals */}
            {fields.length > 0 && (
              <div className="bg-slate-50 rounded-lg p-4 space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Total ({watchedMoneda})</span>
                  <span className="font-semibold">
                    {new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2 }).format(grandTotal)}
                  </span>
                </div>
                {totalUSD !== null && watchedMoneda !== 'USD' && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Total USD (estimado)</span>
                    <span>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalUSD)}</span>
                  </div>
                )}
                {exchangeRateInfo && (
                  <p className="text-xs text-muted-foreground">{exchangeRateInfo}</p>
                )}
              </div>
            )}

            {/* Comisión - no viaja a Alegra */}
            {fields.length > 0 && (
              <div className="bg-blue-50 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium">Comisión</label>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={porcentajeComision}
                        onChange={(e) => setPorcentajeComision(parseFloat(e.target.value) || 0)}
                        className="w-20 h-8 text-right text-sm"
                      />
                      <span className="text-sm text-muted-foreground">%</span>
                    </div>
                    <span className="text-xs text-muted-foreground">(no viaja a Alegra)</span>
                  </div>
                  <span className="text-sm font-semibold">
                    {new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2 }).format(grandTotal * (porcentajeComision / 100))} {watchedMoneda}
                  </span>
                </div>
                {totalUSD !== null && watchedMoneda !== 'USD' && (
                  <div className="flex justify-end">
                    <span className="text-sm text-muted-foreground">
                      ≈ {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalUSD * (porcentajeComision / 100))}
                    </span>
                  </div>
                )}
              </div>
            )}

            <Separator />

            {/* OC Section */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="oc_numero"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>N° Orden de Compra</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: OC-2024-001" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div>
                <label className="text-sm font-medium">Archivo OC</label>
                <Input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  className="mt-2"
                  onChange={(e) => setOcFile(e.target.files?.[0] || null)}
                />
                {ocFile && (
                  <p className="text-xs text-muted-foreground mt-1">{ocFile.name}</p>
                )}
              </div>
            </div>

            {/* Observaciones & Anotaciones */}
            <FormField
              control={form.control}
              name="observaciones"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observaciones</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Observaciones internas..."
                      rows={2}
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="anotaciones"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Anotaciones (para el PDF)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Notas que aparecerán en la factura..."
                      rows={2}
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            {/* Diferido Section - NO viaja a Alegra, solo queda en la app */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="es_diferido"
                  checked={esDiferido}
                  onCheckedChange={(checked) => setEsDiferido(checked === true)}
                />
                <label htmlFor="es_diferido" className="text-sm font-medium cursor-pointer">
                  ¿Es diferido? (pago en cuotas)
                </label>
                <span className="text-xs text-muted-foreground">(no viaja a Alegra)</span>
              </div>

              {esDiferido && (
                <div className="space-y-3 pl-7">
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium whitespace-nowrap">N° de cuotas (meses)</label>
                    <Input
                      type="number"
                      min="1"
                      max="36"
                      value={numeroCuotas}
                      onChange={(e) => setNumeroCuotas(parseInt(e.target.value) || 1)}
                      className="w-24"
                    />
                  </div>

                  {cuotas.length > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="grid grid-cols-3 gap-0 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">
                        <span>Mes</span>
                        <span className="text-right">Monto ({watchedMoneda})</span>
                        {watchedMoneda !== 'USD' && totalUSD !== null && (
                          <span className="text-right">Monto USD</span>
                        )}
                      </div>
                      {cuotas.map((cuota, i) => {
                        const cuotaUSD = watchedMoneda !== 'USD' && totalUSD !== null && grandTotal > 0
                          ? Math.round((cuota.monto / grandTotal) * totalUSD * 100) / 100
                          : null
                        return (
                          <div key={i} className={`grid ${watchedMoneda !== 'USD' && totalUSD !== null ? 'grid-cols-3' : 'grid-cols-2'} gap-0 px-3 py-2 border-t items-center`}>
                            <span className="text-sm">{cuota.mes}</span>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={cuota.monto}
                              onChange={(e) => {
                                const newCuotas = [...cuotas]
                                newCuotas[i] = { ...newCuotas[i], monto: parseFloat(e.target.value) || 0 }
                                setCuotas(newCuotas)
                              }}
                              className="h-8 text-right text-sm"
                            />
                            {cuotaUSD !== null && (
                              <span className="text-sm text-muted-foreground text-right">
                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cuotaUSD)}
                              </span>
                            )}
                          </div>
                        )
                      })}
                      <div className={`grid ${watchedMoneda !== 'USD' && totalUSD !== null ? 'grid-cols-3' : 'grid-cols-2'} gap-0 px-3 py-2 border-t bg-slate-50`}>
                        <span className="text-sm font-semibold">Total cuotas</span>
                        <span className="text-sm font-semibold text-right">
                          {new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2 }).format(
                            cuotas.reduce((sum, c) => sum + c.monto, 0)
                          )}
                        </span>
                        {watchedMoneda !== 'USD' && totalUSD !== null && (
                          <span className="text-sm font-semibold text-right">
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalUSD)}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Crear Solicitud
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
