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
} from '@/actions/alegra.actions'

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

  // OC file
  const [ocFile, setOcFile] = useState<File | null>(null)

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
      anotaciones: '',
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

  function handleSelectClient(client: any) {
    form.setValue('alegra_client_id', String(client.id))
    form.setValue('alegra_client_name', client.name)
    setClientSearch(client.name)
    setShowClientResults(false)
  }

  function handleSelectItem(index: number, item: any) {
    form.setValue(`items.${index}.alegra_item_id`, String(item.id))
    form.setValue(`items.${index}.name`, item.name)
    form.setValue(`items.${index}.description`, item.description || '')
    form.setValue(`items.${index}.price`, item.price?.[0]?.price || item.price || 0)
    setItemSearches((prev) => ({ ...prev, [index]: item.name }))
    setShowItemResults((prev) => ({ ...prev, [index]: false }))
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
        const formData = new FormData()
        formData.append('file', ocFile)
        formData.append('oc_numero', data.oc_numero || '')
        const uploadResult = await uploadOCFile(formData)
        ocUrl = uploadResult.url
      }

      // 2. Only create draft in Alegra for hackÜ SAS
      let alegraInvoiceId: string | null = null
      const isHackuSAS = data.sociedad === 'hackÜ SAS'

      if (isHackuSAS) {
        const draftResult = await createAlegraInvoiceDraft({
          client_id: data.alegra_client_id,
          date: data.fecha_emision,
          dueDate: data.fecha_vencimiento,
          items: data.items.map((item) => ({
            id: item.alegra_item_id,
            name: item.name,
            description: item.description || '',
            quantity: item.quantity,
            price: item.price,
            discount: item.discount || 0,
            tax: item.tax || [],
          })),
          observations: data.observaciones || '',
          anotations: data.anotaciones || '',
        })
        alegraInvoiceId = draftResult.id || draftResult.invoiceId || null
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
        observaciones: data.observaciones || '',
        anotaciones: data.anotaciones || '',
        items: data.items,
        total: grandTotal,
        total_usd: totalUSD,
        solicitante_email: data.solicitante_email,
        solicitante_nombre: data.solicitante_nombre,
        oc_numero: data.oc_numero || null,
        oc_url: ocUrl || null,
        status: isHackuSAS ? 'borrador' : 'pendiente_aprobacion',
      })

      toast({
        title: 'Solicitud creada',
        description: isHackuSAS
          ? 'Borrador enviado a Alegra y solicitud registrada.'
          : 'Solicitud registrada (pendiente de facturación).',
      })
      form.reset()
      setClientSearch('')
      setOcFile(null)
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
          <DialogTitle>Solicitar Factura (Alegra)</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Client Search */}
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
