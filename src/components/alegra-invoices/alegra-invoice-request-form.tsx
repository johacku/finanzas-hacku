// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useEffect, useRef } from 'react'
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
import { SOCIEDADES, MONEDAS, SOCIEDAD_CURRENCY_MAP } from '@/lib/constants'
import { convertToUSDClient } from '@/lib/currency-client'
import { useToast } from '@/hooks/use-toast'
import {
  getAlegraContacts,
  getLocalClients,
  createAlegraInvoiceDraft,
  createAlegraRemission,
  createAlegraInvoiceRequest,
  uploadOCFile,
  sendDiferidoToSheets,
  sendSlackNewRequestNotification,
} from '@/actions/alegra.actions'
import { getVendedores, getAliados, getPlanes } from '@/actions/master-lists.actions'
import { getActiveItems } from '@/actions/item-commission-config.actions'
import { createRecurringTemplate } from '@/actions/recurring-invoices.actions'
import { createStripePaymentLink } from '@/actions/stripe.actions'
import { addParticipant as addParticipantAction } from '@/actions/commissions.actions'
import { calculateItemCommissions, saveItemCommissions } from '@/actions/item-commissions.actions'
import { CommissionParticipantsEditor } from '@/components/comisiones/commission-participants-editor'
import { ItemSearchSelect } from '@/components/shared/item-search-select'

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

  // Items catalog (pre-loaded)
  const [availableItems, setAvailableItems] = useState<any[]>([])
  const [itemsLoaded, setItemsLoaded] = useState(false)

  // Exchange rate
  const [exchangeRateInfo, setExchangeRateInfo] = useState<string>('')
  const [totalUSD, setTotalUSD] = useState<number | null>(null)

  // Vendedores & Aliados
  const [vendedores, setVendedores] = useState<any[]>([])
  const [aliados, setAliados] = useState<any[]>([])
  const [selectedVendedorNombre, setSelectedVendedorNombre] = useState('')
  const [selectedAliado, setSelectedAliado] = useState<any>(null)

  // OC file
  const [ocFile, setOcFile] = useState<File | null>(null)

  // Ref to suppress client search after selection
  const clientJustSelectedRef = useRef(false)

  // Tipo de documento Alegra
  const [tipoDocumento, setTipoDocumento] = useState<'factura' | 'orden_servicio'>('factura')

  // Cliente nuevo state
  const [esClienteNuevo, setEsClienteNuevo] = useState(false)
  const [nombreClienteNuevo, setNombreClienteNuevo] = useState('')

  // Commission participants state
  const [commissionParticipants, setCommissionParticipants] = useState<Array<{ beneficiario_nombre: string; rol: string; porcentaje: number }>>([])

  // Recurrente state
  const [esRecurrente, setEsRecurrente] = useState(false)
  const [diaRecurrencia, setDiaRecurrencia] = useState<number>(1)
  const [diasVencimiento, setDiasVencimiento] = useState<number>(30)

  // Link de cobro Stripe
  const [generarLinkPago, setGenerarLinkPago] = useState(false)

  // Diferido (installment) state - local only, not sent to Alegra
  const [esDiferido, setEsDiferido] = useState(false)
  const [numeroCuotas, setNumeroCuotas] = useState<number>(1)
  const [cuotas, setCuotas] = useState<Array<{ mes: string; monto: number }>>([])

  // Item commission preview
  const [itemCommissionPreview, setItemCommissionPreview] = useState<Array<any>>([])

  // Item nuevo requires observaciones
  const [hasItemNuevo, setHasItemNuevo] = useState(false)

  // Load vendedores, aliados, items, and planes on mount
  useEffect(() => {
    getVendedores().then((data) => setVendedores(data || [])).catch(console.error)
    getAliados().then((data) => setAliados(data || [])).catch(console.error)
    Promise.all([getActiveItems(), getPlanes()]).then(([items, planes]) => {
      const mappedItems = (items || []).map((i: any) => ({
        id: i.alegra_item_id,
        name: i.nombre,
        moneda: i.moneda,
        precio_default: i.precio_default,
        commission_ranges: i.item_commission_ranges || [],
        _type: 'item',
      }))
      const mappedPlanes = (planes || []).map((p: any) => ({
        id: `plan_${p.id}`,
        name: `[Plan] ${p.nombre}`,
        moneda: '',
        precio_default: 0,
        commission_ranges: (p.plan_commission_ranges || []).map((r: any) => ({
          precio_desde: r.precio_desde,
          precio_hasta: r.precio_hasta,
          porcentaje_comision: r.porcentaje_comision,
          moneda: r.moneda || 'COP',
        })),
        _type: 'plan',
      }))
      const all = [
        { id: '__nuevo__', name: '+ Item nuevo (detallar en observaciones)', moneda: '', precio_default: 0, commission_ranges: [], _type: 'special' },
        ...mappedPlanes,
        ...mappedItems,
      ]
      setAvailableItems(all)
      setItemsLoaded(true)
    }).catch(console.error)
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
  const watchedSociedad = form.watch('sociedad')
  const isSAS = watchedSociedad === 'hackÜ SAS'

  // Debounced client search
  useEffect(() => {
    if (clientJustSelectedRef.current) {
      clientJustSelectedRef.current = false
      return
    }
    const timer = setTimeout(async () => {
      if (clientSearch.length >= 2) {
        setClientsLoading(true)
        try {
          if (isSAS) {
            const result = await getAlegraContacts(clientSearch)
            setClients(result.data || result || [])
          } else {
            const result = await getLocalClients(watchedSociedad, clientSearch)
            setClients(result || [])
          }
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
  }, [clientSearch, isSAS, watchedSociedad])

  // Reset client and auto-set currency when sociedad changes
  useEffect(() => {
    form.setValue('alegra_client_id', '')
    form.setValue('alegra_client_name', '')
    setClientSearch('')
    setClients([])
    setShowClientResults(false)
    const defaultCurrency = SOCIEDAD_CURRENCY_MAP[watchedSociedad as keyof typeof SOCIEDAD_CURRENCY_MAP]
    if (defaultCurrency) {
      form.setValue('moneda', defaultCurrency)
    }
  }, [watchedSociedad])


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

  // Auto-calculate item commissions preview
  useEffect(() => {
    const validParticipants = commissionParticipants.filter(p => p.beneficiario_nombre && p.porcentaje > 0)
    const validItems = (watchedItems || []).filter((item: any) => item.alegra_item_id && item.price > 0)

    if (validParticipants.length === 0 || validItems.length === 0) {
      setItemCommissionPreview([])
      return
    }

    const itemsWithRanges = validItems.map((item: any) => {
      const catalogItem = availableItems.find((ai: any) => String(ai.id) === String(item.alegra_item_id))
      return {
        alegra_item_id: item.alegra_item_id,
        name: item.name || catalogItem?.name || '',
        price: item.price,
        quantity: item.quantity || 1,
        discount: item.discount || 0,
        moneda: catalogItem?.moneda || watchedMoneda,
        commission_ranges: catalogItem?.commission_ranges || [],
      }
    })

    calculateItemCommissions({
      items: itemsWithRanges,
      participants: validParticipants,
      totalUSD: totalUSD,
      grandTotal: grandTotal,
      moneda: watchedMoneda,
    }).then(setItemCommissionPreview).catch(console.error)
  }, [watchedItems, commissionParticipants, totalUSD, grandTotal, watchedMoneda, availableItems])

  // Auto-add default participant when vendedor is selected
  // Uses the item/plan's configured commission rate as default %, filtered by invoice moneda
  useEffect(() => {
    if (selectedVendedorNombre && commissionParticipants.length === 0) {
      const firstItem = (watchedItems || []).find((item: any) => item.alegra_item_id && item.price > 0)
      let defaultPct = 5
      if (firstItem) {
        const catalogItem = availableItems.find((ai: any) => String(ai.id) === String(firstItem.alegra_item_id))
        if (catalogItem?.commission_ranges?.length > 0) {
          // Filter by invoice moneda first, fallback to all
          let rangesForMoneda = catalogItem.commission_ranges.filter((r: any) => (r.moneda || 'COP') === watchedMoneda)
          if (rangesForMoneda.length === 0) rangesForMoneda = catalogItem.commission_ranges
          const sorted = [...rangesForMoneda].sort((a: any, b: any) => (a.precio_desde || 0) - (b.precio_desde || 0))
          for (const range of sorted) {
            if (firstItem.price >= (range.precio_desde || 0) && (range.precio_hasta === null || firstItem.price <= range.precio_hasta)) {
              defaultPct = range.porcentaje_comision
              break
            }
          }
          if (defaultPct === 5 && sorted.length > 0) defaultPct = sorted[sorted.length - 1].porcentaje_comision || 5
        }
      }
      setCommissionParticipants([{ beneficiario_nombre: selectedVendedorNombre, rol: 'closer', porcentaje: defaultPct }])
    }
  }, [selectedVendedorNombre])

  function handleSelectClient(client: any) {
    form.setValue('alegra_client_id', String(client.id))
    form.setValue('alegra_client_name', client.name)
    clientJustSelectedRef.current = true
    setClientSearch(client.name)
    setShowClientResults(false)
    setClients([])
  }

  function handleSelectItem(index: number, itemId: string) {
    const item = availableItems.find((i: any) => String(i.id) === itemId)
    if (!item) return
    form.setValue(`items.${index}.alegra_item_id`, String(item.id))
    form.setValue(`items.${index}.name`, item.name)
    form.setValue(`items.${index}.description`, item.description || '')
    // Use default price from config if available
    const defaultPrice = item.precio_default || item.price?.[0]?.price || item.price || 0
    form.setValue(`items.${index}.price`, defaultPrice)

    // Track if any item is "nuevo"
    const allItems = form.getValues('items') || []
    allItems[index] = { ...allItems[index], alegra_item_id: String(item.id) }
    setHasItemNuevo(allItems.some((i: any) => i.alegra_item_id === '__nuevo__'))
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
    // Validate: if "item nuevo" is selected, observaciones is required
    if (hasItemNuevo && (!data.observaciones || data.observaciones.trim().length < 10)) {
      toast({
        title: 'Observaciones requeridas',
        description: 'Cuando seleccionas "Item nuevo", debes detallar los items en las observaciones (mínimo 10 caracteres).',
        variant: 'destructive',
      })
      return
    }

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
      const shouldSendToAlegra = isHackuSAS && !esClienteNuevo && !generarLinkPago

      let alegraError = ''
      if (shouldSendToAlegra) {
        try {
          let currencyPayload: { code: string; exchangeRate: string } | undefined
          if (data.moneda !== 'COP') {
            const { rate } = await convertToUSDClient(1, 'COP', data.fecha_emision)
            currencyPayload = { code: data.moneda, exchangeRate: String(rate) }
          }

          const alegraItems = data.items
            .filter((item) => item.alegra_item_id && item.alegra_item_id !== '')
            .map((item) => ({
              id: Number(item.alegra_item_id) || item.alegra_item_id,
              price: item.price,
              quantity: item.quantity,
              description: item.description || undefined,
              discount: item.discount || 0,
            }))

          if (tipoDocumento === 'orden_servicio') {
            const remissionResult = await createAlegraRemission({
              clientId: data.alegra_client_id,
              date: data.fecha_emision,
              dueDate: data.fecha_vencimiento,
              items: alegraItems,
              documentName: 'serviceOrder',
              currency: currencyPayload,
              observations: data.observaciones || undefined,
              anotation: data.anotaciones || undefined,
              purchaseOrderNumber: data.oc_numero || undefined,
            })
            if (remissionResult.success) {
              alegraInvoiceId = String(remissionResult.data?.id ?? '') || null
            } else {
              alegraError = remissionResult.error || 'Error en Alegra'
            }
          } else {
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
            if (draftResult.success) {
              alegraInvoiceId = String(draftResult.data?.id ?? '') || null
            } else {
              alegraError = draftResult.error || 'Error en Alegra'
            }
          }
        } catch (alegraErr: any) {
          console.error('[Alegra] Unexpected error:', alegraErr)
          alegraError = alegraErr?.message || 'Error inesperado en Alegra'
        }
      }

      // Append diferido info to observaciones if applicable
      let finalObservaciones = data.observaciones || ''
      if (alegraError) {
        finalObservaciones += `\n\n⚠️ Error al crear en Alegra: ${alegraError}`
      }
      if (esDiferido && cuotas.length > 0) {
        const cuotasText = cuotas.map(c => `${c.mes}: ${new Intl.NumberFormat('es-CO').format(c.monto)}`).join(' | ')
        finalObservaciones += `\n\nPago diferido en ${numeroCuotas} cuotas: ${cuotasText}`
      }

      // Append recurrente info to observaciones
      if (esRecurrente) {
        finalObservaciones += `\n\n[Recurrente: día ${diaRecurrencia} de cada mes, vencimiento +${diasVencimiento} días]`
      }

      // Append commission info to observaciones (local only, not sent to Alegra)
      if (commissionParticipants.length > 0 && grandTotal > 0) {
        const comText = commissionParticipants
          .filter(p => p.beneficiario_nombre && p.porcentaje > 0)
          .map(p => `${p.beneficiario_nombre} (${p.rol}): ${p.porcentaje}% = ${new Intl.NumberFormat('es-CO').format(grandTotal * (p.porcentaje / 100))} ${data.moneda}`)
          .join(' | ')
        finalObservaciones += `\n\nComisiones: ${comText}`
      }

      // 3. Save in our DB
      const savedRequest = await createAlegraInvoiceRequest({
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
        total_usd: totalUSD || null,
        solicitante_email: data.solicitante_email,
        solicitante_nombre: data.solicitante_nombre,
        oc_numero: data.oc_numero || null,
        oc_url: ocUrl || null,
        vendedor_nombre: selectedVendedorNombre || null,
        status: shouldSendToAlegra ? 'borrador' : 'pendiente_aprobacion',
      })

      // Save commission participants
      for (const p of commissionParticipants.filter(cp => cp.beneficiario_nombre && cp.porcentaje > 0)) {
        await addParticipantAction({
          alegra_request_id: savedRequest?.id || undefined,
          beneficiario_nombre: p.beneficiario_nombre,
          rol: p.rol,
          porcentaje: p.porcentaje,
        }).catch(console.error)
      }

      // Save item-level commissions
      if (itemCommissionPreview.length > 0) {
        try {
          await saveItemCommissions({
            alegra_request_id: savedRequest?.id || undefined,
            items: itemCommissionPreview.map(c => ({
              ...c,
              item_moneda: data.moneda,
            })),
            sociedad: data.sociedad,
            cliente_nombre: data.alegra_client_name,
          })
        } catch (e) {
          console.error('[ItemCommissions] Save error:', e)
        }
      }

      // Create deferred commission cuotas
      if (esDiferido && cuotas.length > 0) {
        const cuotasWithUSD = cuotas.map((c) => ({
          mes: c.mes,
          monto_usd: watchedMoneda !== 'USD' && totalUSD && grandTotal > 0
            ? Math.round((c.monto / grandTotal) * (totalUSD || 0) * 100) / 100
            : c.monto,
        }))

        const { createDeferredCommissions } = await import('@/actions/commissions.actions')
        await createDeferredCommissions({
          alegra_request_id: savedRequest?.id,
          participants: commissionParticipants.filter(cp => cp.beneficiario_nombre && cp.porcentaje > 0),
          cuotas: cuotasWithUSD,
          sociedad: data.sociedad,
          cliente_nombre: data.alegra_client_name,
        }).catch(console.error)
      }

      // Save recurring template if applicable
      if (esRecurrente) {
        await createRecurringTemplate({
          alegra_client_id: data.alegra_client_id || undefined,
          alegra_client_name: data.alegra_client_name,
          sociedad: data.sociedad,
          moneda: data.moneda,
          dia_recurrencia: diaRecurrencia,
          dias_vencimiento: diasVencimiento,
          observaciones: data.observaciones || undefined,
          anotaciones: data.anotaciones || undefined,
          items: data.items as any,
          total: grandTotal,
          total_usd: totalUSD || null,
          solicitante_email: data.solicitante_email,
          solicitante_nombre: data.solicitante_nombre,
          vendedor_nombre: selectedVendedorNombre || undefined,
          oc_numero: data.oc_numero || undefined,
          porcentaje_comision: commissionParticipants.reduce((sum, p) => sum + (p.porcentaje || 0), 0),
          tipo_documento: tipoDocumento,
        }).catch(console.error)
      }

      // Generate Stripe payment link if requested
      let stripePaymentUrl = ''
      if (generarLinkPago && grandTotal > 0) {
        const stripeResult = await createStripePaymentLink({
          clientName: data.alegra_client_name,
          description: `Factura ${data.alegra_client_name} - ${data.sociedad}`,
          amount: grandTotal,
          currency: data.moneda,
          sociedad: data.sociedad,
          invoiceNumber: alegraInvoiceId || undefined,
        })
        if (stripeResult.success && stripeResult.paymentUrl) {
          stripePaymentUrl = stripeResult.paymentUrl
        } else {
          alegraError = `Stripe: ${stripeResult.error || 'No se generó el link'}`
        }
      }

      // 4. Send to Google Sheets Income Segmentation (always)
      {
        let cuotasToSend: Array<{ mes: string; monto: number; monto_usd?: number }>

        if (esDiferido && cuotas.length > 0) {
          // Diferido: send each installment as a row
          cuotasToSend = cuotas.map((c) => ({
            mes: c.mes,
            monto: c.monto,
            monto_usd: watchedMoneda !== 'USD' && totalUSD && grandTotal > 0
              ? Math.round((c.monto / grandTotal) * totalUSD * 100) / 100
              : c.monto,
          }))
        } else {
          // No diferido: send as 1 single row with the full total
          const fechaBase = new Date(data.fecha_emision + 'T00:00:00')
          const mesNombre = fechaBase.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
          cuotasToSend = [{
            mes: mesNombre.charAt(0).toUpperCase() + mesNombre.slice(1),
            monto: grandTotal,
            monto_usd: totalUSD ?? (watchedMoneda === 'USD' ? grandTotal : undefined),
          }]
        }

        // Fire and forget
        sendDiferidoToSheets({
          client_name: data.alegra_client_name,
          sociedad: data.sociedad,
          vendedor: selectedVendedorNombre || data.solicitante_nombre,
          fecha_emision: data.fecha_emision,
          numero_factura: alegraInvoiceId ? String(alegraInvoiceId) : undefined,
          cuotas: cuotasToSend,
        }).catch(console.error)
      }

      // 5. Send Slack notification (awaited to ensure it completes)
      try {
        await sendSlackNewRequestNotification({
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
          stripe_payment_url: stripePaymentUrl || undefined,
        })
      } catch (slackErr) {
        console.error('[Slack] Failed:', slackErr)
      }

      toast({
        title: alegraError ? 'Solicitud creada (con advertencia)' : 'Solicitud creada',
        description: alegraError
          ? `Solicitud guardada pero Alegra falló: ${alegraError.substring(0, 100)}`
          : shouldSendToAlegra
            ? tipoDocumento === 'orden_servicio'
              ? 'Orden de servicio creada en Alegra y solicitud registrada.'
              : 'Borrador enviado a Alegra y solicitud registrada.'
            : esClienteNuevo
              ? 'Solicitud registrada con cliente nuevo (pendiente de aprobación).'
              : 'Solicitud registrada (pendiente de facturación).',
        variant: alegraError ? 'destructive' : 'default',
      })
      form.reset()
      setClientSearch('')
      setOcFile(null)
      setEsClienteNuevo(false)
      setNombreClienteNuevo('')
      setCommissionParticipants([])
      setGenerarLinkPago(false)
      setEsRecurrente(false)
      setDiaRecurrencia(1)
      setDiasVencimiento(30)
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
          <form onSubmit={form.handleSubmit(handleSubmit, (errors) => {
            console.error('Form validation errors:', JSON.stringify(errors, null, 2))
            const messages: string[] = []
            for (const [key, val] of Object.entries(errors)) {
              if (val?.message) messages.push(`${key}: ${val.message}`)
              else if (Array.isArray(val)) {
                val.forEach((item: any, i: number) => {
                  if (item) Object.entries(item).forEach(([k, v]: any) => {
                    if (v?.message) messages.push(`Item ${i + 1} ${k}: ${v.message}`)
                  })
                })
              }
            }
            toast({
              title: 'Errores en el formulario',
              description: messages.join('. ') || 'Revisa los campos requeridos',
              variant: 'destructive',
            })
          })} className="space-y-6">
            {/* Link de cobro Stripe */}
            <div className="flex items-center gap-3">
              <Checkbox
                id="generar_link_pago"
                checked={generarLinkPago}
                onCheckedChange={(checked) => setGenerarLinkPago(checked === true)}
              />
              <label htmlFor="generar_link_pago" className="text-sm font-medium cursor-pointer">
                💳 Generar link de cobro (Stripe)
              </label>
            </div>

            {generarLinkPago && (
              <p className="text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
                Se generará un link de pago en Stripe. No se enviará borrador a Alegra.
              </p>
            )}

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

            {isSAS && !esClienteNuevo && !generarLinkPago && (
              <div>
                <label className="text-sm font-medium">Tipo de documento en Alegra</label>
                <Select value={tipoDocumento} onValueChange={(v) => setTipoDocumento(v as 'factura' | 'orden_servicio')}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="factura">Factura (Borrador)</SelectItem>
                    <SelectItem value="orden_servicio">Orden de Servicio (Remisión)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {isSAS && !esClienteNuevo && !generarLinkPago && (
              <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                ⚠️ ATENCIÓN: Se creará {tipoDocumento === 'factura' ? 'un borrador de factura' : 'una orden de servicio'} en Alegra.
              </p>
            )}

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
                      <FormLabel>{isSAS ? 'Cliente Alegra *' : 'Cliente *'}</FormLabel>
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
                              {client.name} {isSAS && client.identification ? `- ${client.identification}` : ''}
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
              <div className="space-y-2">
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
                <div className="flex flex-wrap gap-1">
                  {[5, 8, 10, 15, 20, 30, 35, 45].map((days) => (
                    <button
                      key={days}
                      type="button"
                      className="px-2 py-0.5 text-[11px] rounded-md border hover:bg-slate-100 text-muted-foreground"
                      onClick={() => {
                        const emision = form.getValues('fecha_emision')
                        if (emision) {
                          const date = new Date(emision + 'T00:00:00')
                          date.setDate(date.getDate() + days)
                          form.setValue('fecha_vencimiento', date.toISOString().split('T')[0])
                        }
                      }}
                    >
                      {days}d
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Vendedor & Aliado */}
            <div className="grid grid-cols-2 gap-4">
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
              <div>
                <label className="text-sm font-medium">Aliado / Reseller</label>
                <Select
                  value={selectedAliado?.id || '__none__'}
                  onValueChange={(val) => {
                    if (val === '__none__') {
                      setSelectedAliado(null)
                      return
                    }
                    const aliado = aliados.find((a: any) => a.id === val)
                    setSelectedAliado(aliado || null)
                    // Auto-add aliado as commission participant
                    if (aliado && !commissionParticipants.some(p => p.beneficiario_nombre === aliado.nombre)) {
                      setCommissionParticipants(prev => [...prev, {
                        beneficiario_nombre: aliado.nombre,
                        rol: 'aliado',
                        porcentaje: aliado.porcentaje_comision || 5,
                      }])
                    }
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Sin aliado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin aliado</SelectItem>
                    {aliados.map((a: any) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.nombre} ({a.porcentaje_comision || 0}%)
                      </SelectItem>
                    ))}
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
                  {/* Item select with search */}
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

            {/* Commission Participants */}
            {fields.length > 0 && (
              <div className="bg-blue-50 rounded-lg p-4">
                <CommissionParticipantsEditor
                  vendedores={vendedores}
                  participants={commissionParticipants}
                  onChange={setCommissionParticipants}
                />
                {/* Item-level commission preview */}
                {itemCommissionPreview.length > 0 && (
                  <div className="mt-3 border-t border-blue-200 pt-3">
                    <p className="text-xs font-semibold text-blue-800 mb-2">Desglose de comisiones por item</p>
                    <div className="space-y-2">
                      {/* Group by item */}
                      {Array.from(new Set(itemCommissionPreview.map((c: any) => c.alegra_item_id))).map(itemId => {
                        const itemComms = itemCommissionPreview.filter((c: any) => c.alegra_item_id === itemId)
                        const firstComm = itemComms[0]
                        const itemTotalLocal = itemComms.reduce((sum: number, c: any) => sum + (c.monto_comision_local || 0), 0)
                        const itemTotalUSD = itemComms.reduce((sum: number, c: any) => sum + c.monto_comision_usd, 0)
                        return (
                          <div key={itemId} className="bg-white/60 rounded p-2">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs font-medium text-blue-900">{firstComm.item_nombre}</span>
                              <span className="text-[10px] text-blue-600">
                                {firstComm.item_cantidad}x {new Intl.NumberFormat('es-CO').format(firstComm.item_precio)} = {new Intl.NumberFormat('es-CO').format(firstComm.item_subtotal)} {watchedMoneda}
                              </span>
                            </div>
                            {itemComms.map((c: any, i: number) => (
                              <div key={i} className="flex justify-between text-[11px] pl-2">
                                <span className="text-slate-600">{c.beneficiario_nombre} ({c.rol}) — {c.porcentaje}%</span>
                                <span className="font-medium text-green-700">
                                  {new Intl.NumberFormat('es-CO').format(c.monto_comision_local)} {watchedMoneda}
                                  {watchedMoneda !== 'USD' && (
                                    <span className="text-slate-400 ml-1">(~{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(c.monto_comision_usd)})</span>
                                  )}
                                </span>
                              </div>
                            ))}
                            <div className="flex justify-end text-[10px] text-blue-700 font-semibold mt-0.5">
                              Subtotal: {new Intl.NumberFormat('es-CO').format(itemTotalLocal)} {watchedMoneda}
                              {watchedMoneda !== 'USD' && ` (~${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(itemTotalUSD)})`}
                            </div>
                          </div>
                        )
                      })}
                      {/* Grand total */}
                      <div className="flex justify-between items-center pt-2 border-t border-blue-200">
                        <span className="text-xs font-bold text-blue-900">Total comisiones</span>
                        <div className="text-right">
                          <span className="text-sm font-bold text-green-700">
                            {new Intl.NumberFormat('es-CO').format(
                              itemCommissionPreview.reduce((sum: number, c: any) => sum + (c.monto_comision_local || 0), 0)
                            )} {watchedMoneda}
                          </span>
                          {watchedMoneda !== 'USD' && (
                            <span className="text-xs text-slate-500 ml-2">
                              (~{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
                                itemCommissionPreview.reduce((sum: number, c: any) => sum + c.monto_comision_usd, 0)
                              )})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {/* Fallback: show simple totals if no item preview */}
                {itemCommissionPreview.length === 0 && commissionParticipants.length > 0 && grandTotal > 0 && (
                  <div className="mt-2 space-y-1">
                    {commissionParticipants.filter(p => p.beneficiario_nombre && p.porcentaje > 0).map((p, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span>{p.beneficiario_nombre} ({p.rol}) — {p.porcentaje}%</span>
                        <span className="font-medium">
                          {new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2 }).format(grandTotal * (p.porcentaje / 100))} {watchedMoneda}
                        </span>
                      </div>
                    ))}
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
                  <FormLabel>
                    Observaciones
                    {hasItemNuevo && <span className="text-red-600 ml-1">* (obligatorio - detallar items nuevos)</span>}
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={hasItemNuevo ? "OBLIGATORIO: Detalla los items nuevos que no existen en Alegra..." : "Observaciones internas..."}
                      rows={hasItemNuevo ? 4 : 2}
                      {...field}
                      value={field.value ?? ''}
                      className={hasItemNuevo && !field.value ? 'border-red-400 bg-red-50' : ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {isSAS && !esClienteNuevo && !generarLinkPago && (
              <FormField
                control={form.control}
                name="anotaciones"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Anotaciones (para el PDF de Alegra)</FormLabel>
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
            )}

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

            <Separator />

            {/* Recurrente */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="es_recurrente"
                  checked={esRecurrente}
                  onCheckedChange={(checked) => setEsRecurrente(checked === true)}
                />
                <label htmlFor="es_recurrente" className="text-sm font-medium cursor-pointer">
                  ¿Es recurrente? (se crea automáticamente cada mes)
                </label>
              </div>

              {esRecurrente && (
                <div className="pl-7 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Día del mes</label>
                      <Input
                        type="number"
                        min="1"
                        max="28"
                        value={diaRecurrencia}
                        onChange={(e) => setDiaRecurrencia(parseInt(e.target.value) || 1)}
                        className="mt-1"
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">Se creará automáticamente este día cada mes (1-28)</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Días para vencimiento</label>
                      <Input
                        type="number"
                        min="1"
                        max="90"
                        value={diasVencimiento}
                        onChange={(e) => setDiasVencimiento(parseInt(e.target.value) || 30)}
                        className="mt-1"
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">Días después de emisión para el vencimiento</p>
                    </div>
                  </div>
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
