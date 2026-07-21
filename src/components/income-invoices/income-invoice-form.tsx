// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
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
import { Separator } from '@/components/ui/separator'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { SOCIEDADES, MONEDAS, INVOICE_ESTADOS, SOCIEDAD_CURRENCY_MAP } from '@/lib/constants'
import { convertToUSDClient } from '@/lib/currency-client'
import { getPlanes, getAliados, getVendedores } from '@/actions/master-lists.actions'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { getActiveItems } from '@/actions/item-commission-config.actions'
import { getHackuClientes, createHackuCliente } from '@/actions/hacku-clientes.actions'
import { calculateItemCommissions } from '@/actions/item-commissions.actions'
import { CommissionParticipantsEditor } from '@/components/comisiones/commission-participants-editor'
import { ItemSearchSelect } from '@/components/shared/item-search-select'
import type { Database } from '@/types/database.types'

type IncomeInvoice = Database['public']['Tables']['income_invoices']['Row']

interface IncomeInvoiceFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: IncomeInvoiceFormData) => Promise<void>
  invoice?: IncomeInvoice | null
  loading?: boolean
}

export function IncomeInvoiceForm({
  open,
  onClose,
  onSubmit,
  invoice,
  loading = false,
}: IncomeInvoiceFormProps) {
  // Master lists
  const [vendedores, setVendedores] = useState<any[]>([])
  const [aliados, setAliados] = useState<any[]>([])
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [planes, setPlanes] = useState<any[]>([])
  const [hackuClientes, setHackuClientes] = useState<any[]>([])
  const [availableItems, setAvailableItems] = useState<any[]>([])
  const [itemsLoaded, setItemsLoaded] = useState(false)

  // hackÜ cliente creation
  const [showNewHackuCliente, setShowNewHackuCliente] = useState(false)
  const [newHackuClienteName, setNewHackuClienteName] = useState('')
  const [creatingHackuCliente, setCreatingHackuCliente] = useState(false)

  // Exchange rate
  const [exchangeRateInfo, setExchangeRateInfo] = useState('')
  const [totalUSD, setTotalUSD] = useState<number | null>(null)

  // Commission participants
  const [commissionParticipants, setCommissionParticipants] = useState<Array<{ beneficiario_nombre: string; rol: string; porcentaje: number }>>([])
  const [itemCommissionPreview, setItemCommissionPreview] = useState<any[]>([])

  // Vendedor name tracking
  const [selectedVendedorNombre, setSelectedVendedorNombre] = useState('')

  // Load master lists
  useEffect(() => {
    if (!open) return
    Promise.all([
      getVendedores(),
      getAliados(),
      getPlanes(),
      getHackuClientes(),
    ]).then(([v, a, p, hc]) => {
      setVendedores(v || [])
      setAliados(a || [])
      setPlanes(p || [])
      setHackuClientes(hc || [])
      const mappedPlanes = (p || []).map((pl: any) => ({
        id: `plan_${pl.id}`,
        name: pl.nombre,
        moneda: '',
        precio_default: 0,
        commission_ranges: (pl.plan_commission_ranges || []).map((r: any) => ({
          precio_desde: r.precio_desde,
          precio_hasta: r.precio_hasta,
          porcentaje_comision: r.porcentaje_comision,
          moneda: r.moneda || 'COP',
        })),
        _type: 'plan',
      }))
      setAvailableItems([
        { id: '__nuevo__', name: '+ Item nuevo', moneda: '', precio_default: 0, commission_ranges: [], _type: 'special' },
        ...mappedPlanes,
      ])
      setItemsLoaded(true)
    }).catch(console.error)
  }, [open])

  const form = useForm<IncomeInvoiceFormData>({
    resolver: zodResolver(incomeInvoiceSchema) as any,
    defaultValues: invoice
      ? {
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
          tiene_factoraje: invoice.tiene_factoraje,
          dia_adelanto_factoraje: invoice.dia_adelanto_factoraje ?? undefined,
          fecha_factoraje: (invoice as any)?.fecha_factoraje ?? undefined,
          fecha_cobro_factoring: (invoice as any)?.fecha_cobro_factoring ?? undefined,
          items: (invoice as any)?.items || [],
          monto_recurrente: invoice.monto_recurrente || 0,
          monto_no_recurrente: invoice.monto_no_recurrente || 0,
          monto_creacion_contenido: invoice.monto_creacion_contenido || 0,
          total_usd: invoice.total_usd ?? undefined,
          meses_causados: invoice.meses_causados ?? undefined,
          fecha_inicio_causacion: invoice.fecha_inicio_causacion ?? undefined,
          fecha_fin_causacion: invoice.fecha_fin_causacion ?? undefined,
          vendedor: invoice.vendedor ?? undefined,
          porcentaje_comision: invoice.porcentaje_comision ?? 5,
          comision_aliado: !!invoice.comision_aliado,
          porcentaje_comision_aliado: invoice.porcentaje_comision_aliado ?? undefined,
          plan_id: (invoice as any)?.plan_id ?? undefined,
          aliado_id: (invoice as any)?.aliado_id ?? undefined,
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
          items: [],
          fecha_creacion: new Date().toISOString().split('T')[0],
        },
  })

  useEffect(() => {
    if (invoice) {
      form.reset({
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
        tiene_factoraje: invoice.tiene_factoraje,
        dia_adelanto_factoraje: invoice.dia_adelanto_factoraje ?? undefined,
        fecha_factoraje: (invoice as any)?.fecha_factoraje ?? undefined,
        fecha_cobro_factoring: (invoice as any)?.fecha_cobro_factoring ?? undefined,
        items: (invoice as any)?.items || [],
        monto_recurrente: invoice.monto_recurrente || 0,
        monto_no_recurrente: invoice.monto_no_recurrente || 0,
        monto_creacion_contenido: invoice.monto_creacion_contenido || 0,
        total_usd: invoice.total_usd ?? undefined,
        meses_causados: invoice.meses_causados ?? undefined,
        fecha_inicio_causacion: invoice.fecha_inicio_causacion ?? undefined,
        fecha_fin_causacion: invoice.fecha_fin_causacion ?? undefined,
        vendedor: invoice.vendedor ?? undefined,
        porcentaje_comision: invoice.porcentaje_comision ?? 5,
        comision_aliado: !!invoice.comision_aliado,
        porcentaje_comision_aliado: invoice.porcentaje_comision_aliado ?? undefined,
        plan_id: (invoice as any)?.plan_id ?? undefined,
        aliado_id: (invoice as any)?.aliado_id ?? undefined,
        vendedor_id: (invoice as any)?.vendedor_id ?? undefined,
      })
      if (invoice.vendedor) setSelectedVendedorNombre(invoice.vendedor)
    } else {
      form.reset({
        estado: 'Pendiente',
        tiene_factoraje: false,
        comision_aliado: false,
        dia_pago_cliente: 0,
        monto_no_recurrente: 0,
        monto_creacion_contenido: 0,
        monto_recurrente: 0,
        items: [],
        fecha_creacion: new Date().toISOString().split('T')[0],
      })
      setSelectedVendedorNombre('')
      setCommissionParticipants([])
    }
  }, [invoice, form])

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  })

  const watchedItems = form.watch('items')
  const watchedMoneda = form.watch('moneda')
  const watchedSociedad = form.watch('sociedad')
  const watchedFechaCreacion = form.watch('fecha_creacion')
  const watchedFechaVencimiento = form.watch('fecha_vencimiento')
  const tieneFactoraje = form.watch('tiene_factoraje')
  const watchedVendedorId = form.watch('vendedor_id')
  const watchedFechaFactoraje = form.watch('fecha_factoraje')

  // Calculate subtotal for an item
  const calculateSubtotal = (item: any) => {
    const base = (item.quantity || 0) * (item.price || 0)
    return base * (1 - (item.discount || 0) / 100)
  }

  const grandTotal = (watchedItems || []).reduce(
    (acc: number, item: any) => acc + calculateSubtotal(item), 0
  )

  // Auto-set currency when sociedad changes
  useEffect(() => {
    const defaultCurrency = SOCIEDAD_CURRENCY_MAP[watchedSociedad as keyof typeof SOCIEDAD_CURRENCY_MAP]
    if (defaultCurrency) form.setValue('moneda', defaultCurrency)
  }, [watchedSociedad])

  // Auto-calculate dias de pago
  useEffect(() => {
    if (watchedFechaCreacion && watchedFechaVencimiento) {
      const start = new Date(watchedFechaCreacion + 'T00:00:00')
      const end = new Date(watchedFechaVencimiento + 'T00:00:00')
      const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      if (diffDays >= 0) form.setValue('dia_pago_cliente', diffDays)
    }
  }, [watchedFechaCreacion, watchedFechaVencimiento])

  // Auto-calculate factoraje days
  useEffect(() => {
    if (tieneFactoraje && watchedFechaFactoraje && watchedFechaVencimiento) {
      const f = new Date(watchedFechaFactoraje + 'T00:00:00')
      const v = new Date(watchedFechaVencimiento + 'T00:00:00')
      const diffDays = Math.ceil((v.getTime() - f.getTime()) / (1000 * 60 * 60 * 24))
      if (diffDays >= 0) form.setValue('dia_adelanto_factoraje', diffDays)
    }
  }, [tieneFactoraje, watchedFechaFactoraje, watchedFechaVencimiento])

  // Auto-populate vendedor name from vendedor_id
  useEffect(() => {
    if (watchedVendedorId && vendedores.length > 0) {
      const selected = vendedores.find((v: any) => v.id === watchedVendedorId)
      if (selected) {
        form.setValue('vendedor', selected.nombre)
        setSelectedVendedorNombre(selected.nombre)
      }
    }
  }, [watchedVendedorId, vendedores])

  // Convert to USD
  useEffect(() => {
    async function convert() {
      const total = grandTotal > 0 ? grandTotal : (form.getValues('monto_recurrente') || 0) + (form.getValues('monto_no_recurrente') || 0) + (form.getValues('monto_creacion_contenido') || 0)
      if (total <= 0) { setTotalUSD(null); setExchangeRateInfo(''); return }
      if (watchedMoneda === 'USD') { setTotalUSD(total); setExchangeRateInfo(''); form.setValue('total_usd', total); return }
      if (!watchedMoneda) return
      try {
        const result = await convertToUSDClient(total, watchedMoneda, watchedFechaCreacion)
        setTotalUSD(result.amountUSD)
        form.setValue('total_usd', result.amountUSD)
        setExchangeRateInfo(`Tasa: 1 USD = ${result.rate} ${watchedMoneda} (${result.source})`)
      } catch { setTotalUSD(null); setExchangeRateInfo('') }
    }
    convert()
  }, [grandTotal, watchedMoneda, watchedFechaCreacion])

  // Set legacy monto_recurrente from items total
  useEffect(() => {
    if (grandTotal > 0) {
      form.setValue('monto_recurrente', grandTotal)
    }
  }, [grandTotal])

  // Auto-add vendedor as participant
  useEffect(() => {
    if (selectedVendedorNombre && commissionParticipants.length === 0) {
      setCommissionParticipants([{ beneficiario_nombre: selectedVendedorNombre, rol: 'closer', porcentaje: 5 }])
    }
  }, [selectedVendedorNombre])

  // Commission preview
  useEffect(() => {
    const validParticipants = commissionParticipants.filter(p => p.beneficiario_nombre && p.porcentaje > 0)
    const validItems = (watchedItems || []).filter((item: any) => item.alegra_item_id && item.price > 0)
    if (validParticipants.length === 0 || validItems.length === 0) { setItemCommissionPreview([]); return }
    const itemsWithRanges = validItems.map((item: any) => {
      const catalogItem = availableItems.find((ai: any) => String(ai.id) === String(item.alegra_item_id))
      return { ...item, name: item.name || catalogItem?.name || '', moneda: catalogItem?.moneda || watchedMoneda, commission_ranges: catalogItem?.commission_ranges || [] }
    })
    calculateItemCommissions({ items: itemsWithRanges, participants: validParticipants, totalUSD, grandTotal, moneda: watchedMoneda })
      .then(setItemCommissionPreview).catch(console.error)
  }, [watchedItems, commissionParticipants, totalUSD, grandTotal, watchedMoneda, availableItems])

  function handleSelectItem(index: number, itemId: string) {
    const item = availableItems.find((i: any) => String(i.id) === itemId)
    if (!item) return
    form.setValue(`items.${index}.alegra_item_id`, String(item.id))
    form.setValue(`items.${index}.name`, item.name)
    form.setValue(`items.${index}.description`, '')
    form.setValue(`items.${index}.price`, item.precio_default || 0)
  }

  function handleAddItem() {
    append({ alegra_item_id: '', name: '', description: '', quantity: 1, price: 0, discount: 0 })
  }

  async function handleFormSubmit(data: IncomeInvoiceFormData) {
    // Set total from items if items exist
    if (grandTotal > 0) {
      data.monto_recurrente = grandTotal
      data.total_usd = totalUSD
    }
    await onSubmit(data)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{invoice ? 'Editar Factura de Ingreso' : 'Nueva Factura de Ingreso'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
            {/* Sociedad, Estado, Moneda */}
            <div className="grid grid-cols-3 gap-4">
              <FormField control={form.control} name="sociedad" render={({ field }) => (
                <FormItem>
                  <FormLabel>Sociedad *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger></FormControl>
                    <SelectContent>{SOCIEDADES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="estado" render={({ field }) => (
                <FormItem>
                  <FormLabel>Estado</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{INVOICE_ESTADOS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="moneda" render={({ field }) => (
                <FormItem>
                  <FormLabel>Moneda *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{MONEDAS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* Cliente */}
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="razon_social_cliente" render={({ field }) => (
                <FormItem>
                  <FormLabel>Razón Social Cliente *</FormLabel>
                  <FormControl><Input {...field} placeholder="Nombre del cliente" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="hacku_cliente" render={({ field }) => (
                <FormItem>
                  <FormLabel>hackÜ Cliente</FormLabel>
                  {!showNewHackuCliente ? (
                    <Select onValueChange={(val) => {
                      if (val === '__new__') { setShowNewHackuCliente(true); return }
                      if (val === '__none__') { field.onChange(''); return }
                      field.onChange(val)
                    }} value={field.value || '__none__'}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">Sin hackÜ Cliente</SelectItem>
                        {hackuClientes.map((hc: any) => <SelectItem key={hc.id} value={hc.nombre}>{hc.nombre}</SelectItem>)}
                        <SelectItem value="__new__" className="text-blue-600 font-semibold">+ Crear nuevo...</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex gap-2">
                      <FormControl>
                        <Input placeholder="Nombre nuevo hackÜ Cliente" value={newHackuClienteName} onChange={(e) => setNewHackuClienteName(e.target.value)} autoFocus />
                      </FormControl>
                      <Button type="button" size="sm" disabled={!newHackuClienteName.trim() || creatingHackuCliente}
                        onClick={async () => {
                          setCreatingHackuCliente(true)
                          try {
                            const created = await createHackuCliente(newHackuClienteName.trim())
                            if (created) { setHackuClientes((prev: any) => [...prev, created].sort((a: any, b: any) => a.nombre.localeCompare(b.nombre))); field.onChange(created.nombre) }
                          } finally { setCreatingHackuCliente(false); setShowNewHackuCliente(false); setNewHackuClienteName('') }
                        }}>
                        {creatingHackuCliente ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Crear'}
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => { setShowNewHackuCliente(false); setNewHackuClienteName('') }}>X</Button>
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* Documento */}
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="numero_documento" render={({ field }) => (
                <FormItem>
                  <FormLabel>N° Documento</FormLabel>
                  <FormControl><Input {...field} value={field.value ?? ''} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="tipo_documento" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo Documento</FormLabel>
                  <FormControl><Input {...field} value={field.value ?? ''} placeholder="Ej: Factura Alegra" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* Fechas with quick day buttons */}
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="fecha_creacion" render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha Creación *</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="space-y-2">
                <FormField control={form.control} name="fecha_vencimiento" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha Vencimiento *</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="flex flex-wrap gap-1">
                  {[5, 8, 10, 15, 20, 30, 35, 45].map((days) => (
                    <button key={days} type="button"
                      className="px-2 py-0.5 text-[11px] rounded-md border hover:bg-slate-100 text-muted-foreground"
                      onClick={() => {
                        const emision = form.getValues('fecha_creacion')
                        if (emision) {
                          const date = new Date(emision + 'T00:00:00')
                          date.setDate(date.getDate() + days)
                          form.setValue('fecha_vencimiento', date.toISOString().split('T')[0])
                        }
                      }}>
                      {days}d
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <Separator />

            {/* Items Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Items de Factura</h3>
                <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                  <Plus className="mr-1 h-4 w-4" /> Agregar Item
                </Button>
              </div>

              {fields.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No hay items. Haz clic en &quot;Agregar Item&quot;.</p>
              )}

              {fields.map((field, index) => (
                <div key={field.id} className="border rounded-lg p-4 mb-3 space-y-3">
                  <div>
                    <label className="text-xs font-medium">Item</label>
                    <div className="mt-1">
                      <ItemSearchSelect
                        items={availableItems}
                        value={watchedItems?.[index]?.alegra_item_id || ''}
                        onSelect={(val) => handleSelectItem(index, val)}
                        loading={!itemsLoaded}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-5 gap-3 items-end">
                    <FormField control={form.control} name={`items.${index}.quantity`} render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Cantidad</FormLabel>
                        <FormControl><Input type="number" min="1" step="1" {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name={`items.${index}.price`} render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Precio</FormLabel>
                        <FormControl><Input type="number" min="0" step="0.01" {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name={`items.${index}.discount`} render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Descuento %</FormLabel>
                        <FormControl><Input type="number" min="0" max="100" step="0.01" {...field} value={field.value ?? 0} /></FormControl>
                      </FormItem>
                    )} />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Subtotal</p>
                      <p className="text-sm font-medium h-10 flex items-center">
                        {new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2 }).format(calculateSubtotal(watchedItems?.[index] || { quantity: 0, price: 0 }))}
                      </p>
                    </div>
                    <div className="flex justify-end">
                      <Button type="button" variant="ghost" size="icon" className="text-red-500 hover:text-red-700" onClick={() => remove(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {/* Item description/comments */}
                  <FormField
                    control={form.control}
                    name={`items.${index}.description`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            placeholder="Comentarios del item (detalle de facturación)..."
                            {...field}
                            value={field.value ?? ''}
                            className="text-xs h-8"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              ))}
            </div>

            {/* Totals */}
            {(grandTotal > 0 || (form.getValues('monto_recurrente') || 0) > 0) && (
              <div className="bg-slate-50 rounded-lg p-4 space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Total ({watchedMoneda})</span>
                  <span className="font-semibold">{new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2 }).format(grandTotal || form.getValues('monto_recurrente') || 0)}</span>
                </div>
                {totalUSD !== null && watchedMoneda !== 'USD' && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Total USD (estimado)</span>
                    <span>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalUSD)}</span>
                  </div>
                )}
                {exchangeRateInfo && <p className="text-xs text-muted-foreground">{exchangeRateInfo}</p>}
              </div>
            )}

            {/* Commission Participants */}
            {(fields.length > 0 || grandTotal > 0) && (
              <div className="bg-blue-50 rounded-lg p-4">
                <CommissionParticipantsEditor
                  vendedores={vendedores}
                  participants={commissionParticipants}
                  onChange={setCommissionParticipants}
                />
                {itemCommissionPreview.length > 0 && (
                  <div className="mt-3 border-t border-blue-200 pt-3">
                    <p className="text-xs font-semibold text-blue-800 mb-2">Comisiones por item</p>
                    {Array.from(new Set(itemCommissionPreview.map((c: any) => c.alegra_item_id))).map(itemId => {
                      const itemComms = itemCommissionPreview.filter((c: any) => c.alegra_item_id === itemId)
                      const first = itemComms[0]
                      return (
                        <div key={itemId} className="bg-white/60 rounded p-2 mb-1">
                          <div className="flex justify-between text-xs">
                            <span className="font-medium">{first.item_nombre}</span>
                            <span className="text-blue-600">{new Intl.NumberFormat('es-CO').format(first.item_subtotal)} {watchedMoneda}</span>
                          </div>
                          {itemComms.map((c: any, i: number) => (
                            <div key={i} className="flex justify-between text-[11px] pl-2">
                              <span className="text-slate-600">{c.beneficiario_nombre} ({c.rol}) — {c.porcentaje}%</span>
                              <span className="font-medium text-green-700">
                                {new Intl.NumberFormat('es-CO').format(c.monto_comision_local)} {watchedMoneda}
                                {watchedMoneda !== 'USD' && <span className="text-slate-400 ml-1">(~${c.monto_comision_usd.toFixed(2)})</span>}
                              </span>
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            <Separator />

            {/* Vendedor & Aliado */}
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="vendedor_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Vendedor (KAM)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ''}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar vendedor" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {vendedores.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.nombre} ({v.rol || 'KAM'})</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="aliado_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Aliado / Reseller</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || '__none__'}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar aliado" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">Sin aliado</SelectItem>
                      {aliados.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.nombre} ({a.porcentaje_comision || 0}%)</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <Separator />

            {/* Factoraje */}
            <FormField control={form.control} name="tiene_factoraje" render={({ field }) => (
              <FormItem className="flex items-center gap-3">
                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                <FormLabel className="!mt-0">¿Tiene Factoraje?</FormLabel>
              </FormItem>
            )} />
            {tieneFactoraje && (
              <div className="grid grid-cols-3 gap-4">
                <FormField control={form.control} name="fecha_factoraje" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha Tentativa Factoraje</FormLabel>
                    <FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="dia_adelanto_factoraje" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Días Adelanto</FormLabel>
                    <FormControl><Input type="number" {...field} value={field.value ?? ''} readOnly className="bg-gray-50" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="fecha_cobro_factoring" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha Cobro Factoring</FormLabel>
                    <FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl>
                  </FormItem>
                )} />
              </div>
            )}

            {/* Causación */}
            <div className="grid grid-cols-3 gap-4">
              <FormField control={form.control} name="meses_causados" render={({ field }) => (
                <FormItem>
                  <FormLabel>Meses Causados</FormLabel>
                  <FormControl><Input type="number" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : null)} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="fecha_inicio_causacion" render={({ field }) => (
                <FormItem>
                  <FormLabel>Inicio Causación</FormLabel>
                  <FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="fecha_fin_causacion" render={({ field }) => (
                <FormItem>
                  <FormLabel>Fin Causación</FormLabel>
                  <FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl>
                </FormItem>
              )} />
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
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
