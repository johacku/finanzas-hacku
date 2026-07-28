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
import { useToast } from '@/hooks/use-toast'
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
  const { toast } = useToast()
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
  const [selectedAliado, setSelectedAliado] = useState<any>(null)

  // Pronto pago (income-specific)
  const [esProntoPago, setEsProntoPago] = useState(false)
  const [descuentoProntoPago, setDescuentoProntoPago] = useState<number>(2)

  // Nueva factura (new client commission)
  const [esNuevaFactura, setEsNuevaFactura] = useState(false)
  const [canalAdquisicion, setCanalAdquisicion] = useState('')

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
        // Default para el selector "Tipo de negocio" por ítem (spec 002).
        tipo_negocio_default: pl.frecuencia_recurrencia === 'one-time' ? 'one_time' : 'recurrente',
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
          fecha_pago_o_cobro: (invoice as any)?.fecha_pago_o_cobro ?? undefined,
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
        fecha_pago_o_cobro: (invoice as any)?.fecha_pago_o_cobro ?? undefined,
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

  // Auto-add vendedor as participant (owner of the invoice)
  useEffect(() => {
    if (selectedVendedorNombre && commissionParticipants.length === 0) {
      setCommissionParticipants([{ beneficiario_nombre: selectedVendedorNombre, rol: 'closer', porcentaje: 100 }])
    }
  }, [selectedVendedorNombre])

  // FIX #7: usar form.watch() para que meses_facturados y meses_causados sean
  // valores reactivos (deps del efecto), evitando que el preview quede obsoleto
  // cuando el usuario cambia el campo sin que haya otro campo observado cambiando.
  const mesesFacturadosWatch = form.watch('meses_facturados')
  const mesesCausadosWatch = form.watch('meses_causados')

  // Commission preview
  useEffect(() => {
    const validParticipants = commissionParticipants.filter(p => p.beneficiario_nombre && p.porcentaje > 0)
    const validItems = (watchedItems || []).filter((item: any) => item.alegra_item_id && item.price > 0)
    if (validParticipants.length === 0 || validItems.length === 0) { setItemCommissionPreview([]); return }
    const itemsWithRanges = validItems.map((item: any) => {
      const catalogItem = availableItems.find((ai: any) => String(ai.id) === String(item.alegra_item_id))
      return { ...item, name: item.name || catalogItem?.name || '', costo_directo: item.costo_directo || 0, moneda: catalogItem?.moneda || watchedMoneda, commission_ranges: catalogItem?.commission_ranges || [], tipo_negocio: item.tipo_negocio || catalogItem?.tipo_negocio_default || 'recurrente', proyecto_corto_hunter: !!item.proyecto_corto_hunter }
    })
    calculateItemCommissions({
      items: itemsWithRanges,
      participants: validParticipants,
      totalUSD,
      grandTotal,
      moneda: watchedMoneda,
      meses_causados: mesesCausadosWatch || undefined,
      es_cliente_nuevo: esNuevaFactura,
      canal_origen: esNuevaFactura && canalAdquisicion ? (canalAdquisicion as 'hacku' | 'hunter') : null,
      meses_facturados: mesesFacturadosWatch || undefined,
    })
      .then(setItemCommissionPreview).catch(console.error)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedItems, commissionParticipants, totalUSD, grandTotal, watchedMoneda, availableItems, esNuevaFactura, canalAdquisicion, mesesFacturadosWatch, mesesCausadosWatch])

  function handleSelectItem(index: number, itemId: string) {
    const item = availableItems.find((i: any) => String(i.id) === itemId)
    if (!item) return
    form.setValue(`items.${index}.alegra_item_id`, String(item.id))
    form.setValue(`items.${index}.name`, item.name)
    form.setValue(`items.${index}.description`, '')
    form.setValue(`items.${index}.price`, item.precio_default || 0)
    // Default del tipo de negocio derivado del catálogo (spec 002), editable.
    form.setValue(`items.${index}.tipo_negocio`, item.tipo_negocio_default || 'recurrente')
  }

  function handleAddItem() {
    append({ alegra_item_id: '', name: '', description: '', quantity: 1, price: 0, discount: 0 })
  }

  async function handleFormSubmit(data: IncomeInvoiceFormData) {
    // Validate: cliente nuevo requires a canal de origen (decides the 20/25% rate
    // and the Hunter originador attribution). Without it, the commission would
    // silently fall back to price ranges.
    if (esNuevaFactura && canalAdquisicion !== 'hacku' && canalAdquisicion !== 'hunter') {
      toast({
        title: 'Canal de origen requerido',
        description: 'Para un cliente nuevo, selecciona si el negocio fue traído por hackÜ (20%) o por el Hunter (25%).',
        variant: 'destructive',
      })
      return
    }

    // Validate: los shares de reparto de comisión deben sumar 100% (spec 003).
    // El % de cada participante reparte la ÚNICA comisión del item; si no suma
    // 100% se repartiría parcial o de más, así que se bloquea el guardado.
    const validParticipants = commissionParticipants.filter(p => p.beneficiario_nombre && p.porcentaje > 0)
    if (validParticipants.length > 0) {
      const sumaShares = validParticipants.reduce((acc, p) => acc + (p.porcentaje || 0), 0)
      if (Math.abs(sumaShares - 100) >= 0.01) {
        toast({
          title: 'El reparto de comisiones debe sumar 100%',
          description: `Los porcentajes de los participantes suman ${sumaShares}%. Ajústalos para que repartan el 100% de la comisión.`,
          variant: 'destructive',
        })
        return
      }
    }

    // Set total from items if items exist
    if (grandTotal > 0) {
      data.monto_recurrente = grandTotal
      data.total_usd = totalUSD
    }

    // Persist origin flags so they are saved to income_invoices (migration 042)
    data.es_cliente_nuevo = esNuevaFactura
    data.canal_origen = esNuevaFactura && canalAdquisicion ? (canalAdquisicion as 'hacku' | 'hunter') : null
    // meses_facturados: use form value if set, otherwise leave null
    // (meses_causados is a separate field for accounting; meses_facturados is for commission rate bumps)

    // Attach commission data to the form data so the table can use it
    ;(data as any)._commissionParticipants = commissionParticipants.filter(p => p.beneficiario_nombre && p.porcentaje > 0)
    ;(data as any)._itemCommissionPreview = itemCommissionPreview
    ;(data as any)._selectedVendedor = selectedVendedorNombre
    ;(data as any)._selectedVendedorId = data.vendedor_id || null
    ;(data as any)._esProntoPago = esProntoPago
    ;(data as any)._descuentoProntoPago = descuentoProntoPago

    // Save razón social → hackÜ cliente mapping
    if (data.razon_social_cliente && data.hacku_cliente) {
      import('@/actions/client-mapping.actions').then(({ saveClientMapping }) =>
        saveClientMapping(data.razon_social_cliente, data.hacku_cliente!).catch(console.error)
      )
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
                  <FormControl><Input {...field} placeholder="Nombre del cliente" onBlur={async (e) => {
                    field.onBlur()
                    // Auto-fill hackÜ Cliente from mapping
                    const val = e.target.value?.trim()
                    if (val && !form.getValues('hacku_cliente')) {
                      try {
                        const { getHackuClienteForRazonSocial } = await import('@/actions/client-mapping.actions')
                        const mapped = await getHackuClienteForRazonSocial(val)
                        if (mapped) form.setValue('hacku_cliente', mapped)
                      } catch { /* ignore */ }
                    }
                  }} /></FormControl>
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

            {/* Fecha de Cobro */}
            <FormField control={form.control} name="fecha_pago_o_cobro" render={({ field }) => (
              <FormItem>
                <FormLabel>Fecha de Cobro</FormLabel>
                <FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl>
                <p className="text-[10px] text-muted-foreground">Fecha en que el cliente paga. Determina cuando se paga la comision al vendedor.</p>
                <FormMessage />
              </FormItem>
            )} />

            {/* Vendedor & Aliado */}
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="vendedor_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Vendedor (KAM/Hunter)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ''}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar vendedor" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {vendedores.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.nombre} ({v.rol || 'KAM'})</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <div>
                <label className="text-sm font-medium">Aliado / Reseller</label>
                <Select
                  value={selectedAliado?.id || '__none__'}
                  onValueChange={(val) => {
                    if (val === '__none__') { setSelectedAliado(null); return }
                    const aliado = aliados.find((a: any) => a.id === val)
                    setSelectedAliado(aliado || null)
                    form.setValue('aliado_id', val)
                    if (aliado && !commissionParticipants.some(p => p.beneficiario_nombre === aliado.nombre)) {
                      setCommissionParticipants(prev => [...prev, { beneficiario_nombre: aliado.nombre, rol: 'aliado', porcentaje: aliado.porcentaje_comision || 5 }])
                    }
                  }}
                >
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Sin aliado" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin aliado</SelectItem>
                    {aliados.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.nombre} ({a.porcentaje_comision || 0}%)</SelectItem>)}
                  </SelectContent>
                </Select>
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
                  {/* Item description + costo directo */}
                  <div className="flex gap-2">
                    <FormField
                      control={form.control}
                      name={`items.${index}.description`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Input placeholder="Comentarios del item..." {...field} value={field.value ?? ''} className="text-xs h-8" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`items.${index}.costo_directo`}
                      render={({ field }) => (
                        <FormItem className="w-32">
                          <FormControl>
                            <Input type="number" min="0" step="0.01" placeholder="Costo directo" {...field} value={field.value ?? ''} className="text-xs h-8" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  {/* Tipo de negocio por ítem (spec 002) — solo para cliente nuevo:
                      one-time comisiona 10/15% (+3% proyecto corto) en vez de 20/25%. */}
                  {esNuevaFactura && (
                    <div className="flex items-center gap-3 bg-amber-50/60 border border-amber-100 rounded-md px-2 py-1.5">
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] font-medium text-amber-900">Tipo de negocio</label>
                        <Select
                          value={watchedItems?.[index]?.tipo_negocio || 'recurrente'}
                          onValueChange={(val) => form.setValue(`items.${index}.tipo_negocio`, val as 'recurrente' | 'one_time')}
                        >
                          <SelectTrigger className="h-7 w-40 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="recurrente">Recurrente (20/25%)</SelectItem>
                            <SelectItem value="one_time">One-time (10/15%)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {watchedItems?.[index]?.tipo_negocio === 'one_time' && (
                        <div className="flex items-center gap-1.5">
                          <Checkbox
                            id={`proyecto_corto_income_${index}`}
                            checked={!!watchedItems?.[index]?.proyecto_corto_hunter}
                            onCheckedChange={(checked) => form.setValue(`items.${index}.proyecto_corto_hunter`, checked === true)}
                          />
                          <label htmlFor={`proyecto_corto_income_${index}`} className="text-[11px] text-amber-900 cursor-pointer">
                            Proyecto corto (Hunter) +3%
                          </label>
                        </div>
                      )}
                    </div>
                  )}
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
                              <span className="text-slate-600">{c.beneficiario_nombre} ({c.rol}) — reparto {c.share_reparto ?? 100}% de {c.porcentaje}%</span>
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

            {/* Nueva factura */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-3">
                <Checkbox id="nueva_factura_income" checked={esNuevaFactura} onCheckedChange={(checked) => setEsNuevaFactura(checked === true)} />
                <label htmlFor="nueva_factura_income" className="text-sm font-medium cursor-pointer">Nueva factura (cliente nuevo — comisión por canal de origen)</label>
              </div>
              {esNuevaFactura && (
                <div className="grid grid-cols-2 gap-3 pl-7">
                  <div>
                    <label className="text-xs font-medium">Canal de origen *</label>
                    <Select value={canalAdquisicion} onValueChange={setCanalAdquisicion}>
                      <SelectTrigger className="mt-1 h-8"><SelectValue placeholder="Seleccionar canal..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hacku">Traído por hackÜ (20%)</SelectItem>
                        <SelectItem value="hunter">Traído por Hunter (25%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <FormField control={form.control} name="meses_facturados" render={({ field }) => (
                    <div>
                      <label className="text-xs font-medium">Meses facturados</label>
                      <Input type="number" min="1" step="1" placeholder="Ej: 6" className="mt-1 h-8"
                        value={field.value ?? ''}
                        onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : null)} />
                      <p className="text-[10px] text-amber-700 mt-0.5">6+ meses sube la tasa (hackÜ 30%, Hunter 35%)</p>
                    </div>
                  )} />
                </div>
              )}
            </div>

            {/* Pronto Pago (income-specific) */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-3">
                <Checkbox id="pronto_pago" checked={esProntoPago} onCheckedChange={(checked) => setEsProntoPago(checked === true)} />
                <label htmlFor="pronto_pago" className="text-sm font-medium cursor-pointer">Pronto Pago</label>
                <span className="text-xs text-muted-foreground">(pago dentro de 7 dias)</span>
              </div>
              {esProntoPago && (
                <div className="pl-7 space-y-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium">% Descuento ofrecido</label>
                      <Select value={String(descuentoProntoPago)} onValueChange={(v) => setDescuentoProntoPago(parseInt(v))}>
                        <SelectTrigger className="mt-1 h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="2">2% descuento → KAM recibe 1%</SelectItem>
                          <SelectItem value="3">3% descuento → KAM recibe 0.5%</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end">
                      <div className="bg-white rounded p-2 text-xs w-full">
                        <span className="text-muted-foreground">Comision pronto pago: </span>
                        <span className="font-bold text-green-700">
                          {descuentoProntoPago === 2 ? '1%' : '0.5%'} = {new Intl.NumberFormat('es-CO').format(grandTotal * (descuentoProntoPago === 2 ? 0.01 : 0.005))} {watchedMoneda}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
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
