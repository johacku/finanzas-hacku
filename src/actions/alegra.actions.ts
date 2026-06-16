/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ---------------------------------------------------------------------------
// Helper for Alegra API calls
// ---------------------------------------------------------------------------

async function alegraFetch(endpoint: string, options?: RequestInit) {
  const email = process.env.ALEGRA_API_EMAIL
  const token = process.env.ALEGRA_API_TOKEN
  if (!email || !token) throw new Error('Alegra API credentials not configured')

  const auth = Buffer.from(`${email}:${token}`).toString('base64')
  const res = await fetch(`https://api.alegra.com/api/v1${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options?.headers,
    },
  })

  if (!res.ok) {
    const errorText = await res.text()
    console.error(`[Alegra API] ${res.status} ${endpoint}:`, errorText)
    throw new Error(`Alegra API error (${res.status}): ${errorText}`)
  }

  return res.json()
}

// ---------------------------------------------------------------------------
// 1a. GET ALL CONTACTS (paginated fetch of every contact)
// ---------------------------------------------------------------------------

export async function getAllAlegraContacts() {
  let allContacts: any[] = []
  let start = 0
  const limit = 30

  while (true) {
    const result = await alegraFetch(`/contacts?start=${start}&limit=${limit}&metadata=true`)
    const data = result.data ?? result
    if (!Array.isArray(data) || data.length === 0) break
    allContacts = allContacts.concat(data)
    if (data.length < limit) break
    start += limit
  }

  return allContacts
}

// ---------------------------------------------------------------------------
// 1b. GET CONTACTS (clients) - with search and pagination
// ---------------------------------------------------------------------------

export async function getAlegraContacts(query?: string, start: number = 0) {
  const params = new URLSearchParams({
    start: String(start),
    limit: '30',
    metadata: 'true',
  })

  if (query) {
    params.set('query', query)
  }

  const result = await alegraFetch(`/contacts?${params.toString()}`)

  return {
    data: result.data ?? result,
    total: result.metadata?.total ?? 0,
  }
}

// ---------------------------------------------------------------------------
// 2. GET ITEMS - with search and pagination
// ---------------------------------------------------------------------------

// Allowed item IDs for invoice requests
const ALLOWED_ITEM_IDS = [49, 1, 3, 20, 107, 8, 47, 154, 80, 95, 101]

export async function getAlegraItems(query?: string) {
  // Fetch each allowed item individually
  const items: any[] = []
  for (const id of ALLOWED_ITEM_IDS) {
    try {
      const item = await alegraFetch(`/items/${id}`)
      if (item && item.id) items.push(item)
    } catch {
      // skip items that don't exist
    }
  }

  // Sort by name
  items.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''))

  return {
    data: items,
    total: items.length,
  }
}

// ---------------------------------------------------------------------------
// 3. CREATE DRAFT INVOICE IN ALEGRA
// ---------------------------------------------------------------------------

export async function createAlegraInvoiceDraft(data: {
  date: string
  dueDate: string
  clientId: string
  items: Array<{
    id: string
    price: number
    quantity: number
    description?: string
    discount?: number
    tax?: Array<{ id: string }>
  }>
  currency?: { code: string; exchangeRate: string }
  observations?: string
  anotation?: string
  seller?: { id: string }
  purchaseOrderNumber?: string
}) {
  const body: Record<string, unknown> = {
    status: 'draft',
    date: data.date,
    dueDate: data.dueDate,
    client: data.clientId,
    items: data.items,
    numberTemplate: { id: 19 },
    paymentForm: 'CREDIT',
  }

  if (data.currency) body.currency = data.currency
  if (data.observations) body.observations = data.observations
  if (data.anotation) body.anotation = data.anotation
  if (data.seller) body.seller = data.seller
  if (data.purchaseOrderNumber) body.purchaseOrderNumber = data.purchaseOrderNumber

  console.log('[Alegra] Creating draft invoice:', JSON.stringify(body, null, 2))

  const invoice = await alegraFetch('/invoices', {
    method: 'POST',
    body: JSON.stringify(body),
  })

  console.log('[Alegra] Draft created successfully, id:', invoice?.id)
  return invoice
}

// ---------------------------------------------------------------------------
// 3b. CREATE REMISSION (ORDEN DE SERVICIO) IN ALEGRA
// ---------------------------------------------------------------------------

export async function createAlegraRemission(data: {
  date: string
  dueDate: string
  clientId: string
  items: Array<{
    id: string
    price: number
    quantity: number
    description?: string
    discount?: number
  }>
  documentName?: string // "remission" or "serviceOrder"
  observations?: string
  anotation?: string
  currency?: { code: string; exchangeRate: string }
  purchaseOrderNumber?: string
}) {
  const body: Record<string, unknown> = {
    date: data.date,
    dueDate: data.dueDate,
    client: data.clientId,
    items: data.items,
    documentName: data.documentName || 'serviceOrder',
  }

  if (data.currency) body.currency = data.currency
  if (data.observations) body.observations = data.observations
  if (data.anotation) body.anotation = data.anotation
  if (data.purchaseOrderNumber) body.purchaseOrderNumber = data.purchaseOrderNumber

  console.log('[Alegra] Creating remission:', JSON.stringify(body, null, 2))

  const remission = await alegraFetch('/remissions', {
    method: 'POST',
    body: JSON.stringify(body),
  })

  console.log('[Alegra] Remission created, id:', remission?.id)
  return remission
}

// ---------------------------------------------------------------------------
// 4. CREATE INVOICE REQUEST (save to our DB)
// ---------------------------------------------------------------------------

export async function createAlegraInvoiceRequest(data: {
  alegra_invoice_id?: string
  alegra_client_id: string
  alegra_client_name: string
  sociedad: string
  moneda: string
  fecha_emision: string
  fecha_vencimiento: string
  observaciones?: string
  anotaciones?: string
  items: unknown[]
  subtotal: number
  impuestos: number
  total: number
  total_usd?: number
  currency_exchange_rate?: number
  solicitante_email: string
  solicitante_nombre: string
  oc_numero?: string
  oc_url?: string
  vendedor_nombre?: string
  status?: string
}) {
  const supabase = await createClient()

  const { data: inserted, error } = await (supabase as any)
    .from('alegra_invoice_requests')
    .insert({
      alegra_invoice_id: data.alegra_invoice_id ?? null,
      alegra_client_id: data.alegra_client_id,
      alegra_client_name: data.alegra_client_name,
      sociedad: data.sociedad,
      moneda: data.moneda,
      fecha_emision: data.fecha_emision,
      fecha_vencimiento: data.fecha_vencimiento,
      observaciones: data.observaciones ?? null,
      anotaciones: data.anotaciones ?? null,
      items: data.items,
      subtotal: data.subtotal,
      impuestos: data.impuestos,
      total: data.total,
      total_usd: data.total_usd ?? null,
      currency_exchange_rate: data.currency_exchange_rate ?? null,
      solicitante_email: data.solicitante_email,
      solicitante_nombre: data.solicitante_nombre,
      oc_numero: data.oc_numero ?? null,
      oc_url: data.oc_url ?? null,
      vendedor_nombre: data.vendedor_nombre ?? null,
      status: data.status || 'pendiente_aprobacion',
    })
    .select()
    .single()

  if (error) {
    console.error('[DB] Failed to insert alegra_invoice_request:', error.message, error.details, error.hint)
    throw new Error(`Error guardando solicitud: ${error.message}`)
  }

  console.log('[DB] Invoice request saved, id:', inserted?.id)
  revalidatePath('/alegra-invoices')
  revalidatePath('/dashboard')

  return inserted
}

// ---------------------------------------------------------------------------
// 5. GET INVOICE REQUESTS from our DB (with filters)
// ---------------------------------------------------------------------------

export async function getAlegraInvoiceRequests(filters?: {
  status?: string
  solicitante_email?: string
}) {
  const supabase = await createClient()

  let query = (supabase as any)
    .from('alegra_invoice_requests')
    .select('*')
    .order('created_at', { ascending: false })

  if (filters?.status) query = query.eq('status', filters.status as any)
  if (filters?.solicitante_email) query = query.eq('solicitante_email', filters.solicitante_email)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data
}

// ---------------------------------------------------------------------------
// 6. UPDATE REQUEST STATUS
// ---------------------------------------------------------------------------

// Update any fields on an alegra invoice request
export async function updateAlegraRequest(id: string, data: Record<string, any>) {
  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('alegra_invoice_requests')
    .update(data)
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/alegra-invoices')
}

export async function updateAlegraRequestStatus(
  id: string,
  status: string,
  extra?: {
    aprobado_por?: string
    alegra_pdf_url?: string
    alegra_numero_factura?: string
    alegra_invoice_id?: string
    fecha_facturacion?: string
    alegra_client_name?: string
  }
) {
  const supabase = await createClient()

  const updateData: Record<string, unknown> = { status }

  if (status === 'aprobada') {
    updateData.fecha_aprobacion = new Date().toISOString()
  }

  if (extra?.aprobado_por) updateData.aprobado_por = extra.aprobado_por
  if (extra?.alegra_pdf_url) updateData.alegra_pdf_url = extra.alegra_pdf_url
  if (extra?.alegra_numero_factura) updateData.alegra_numero_factura = extra.alegra_numero_factura
  if (extra?.alegra_invoice_id) updateData.alegra_invoice_id = extra.alegra_invoice_id
  if (extra?.fecha_facturacion) updateData.fecha_facturacion = extra.fecha_facturacion
  if (extra?.alegra_client_name) updateData.alegra_client_name = extra.alegra_client_name

  const { error } = await (supabase as any)
    .from('alegra_invoice_requests')
    .update(updateData)
    .eq('id', id)

  if (error) throw new Error(error.message)

  // Auto-create income invoice when status changes to facturada
  if (status === 'facturada') {
    await createIncomeInvoiceFromRequest(id).catch(err =>
      console.error('[Income] Auto-create failed:', err)
    )
  }

  revalidatePath('/alegra-invoices')
  revalidatePath('/dashboard')
}

// ---------------------------------------------------------------------------
// 7. GET SINGLE REQUEST
// ---------------------------------------------------------------------------

export async function getAlegraInvoiceRequest(id: string) {
  const supabase = await createClient()

  const { data, error } = await (supabase as any)
    .from('alegra_invoice_requests')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw new Error(error.message)
  return data
}

// ---------------------------------------------------------------------------
// 8. GET ALEGRA INVOICE DETAILS (including PDF)
// ---------------------------------------------------------------------------

export async function getAlegraInvoiceDetails(alegraInvoiceId: string) {
  const invoice = await alegraFetch(`/invoices/${alegraInvoiceId}?fields=pdf`)
  return invoice
}

// ---------------------------------------------------------------------------
// 9. UPLOAD OC FILE
// ---------------------------------------------------------------------------

export async function uploadOCFile(formData: FormData) {
  const supabase = await createClient()

  const file = formData.get('file') as File
  if (!file) throw new Error('No file provided')

  // Sanitize filename: remove spaces, special chars
  const safeName = file.name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-zA-Z0-9._-]/g, '_') // replace special chars with _
    .replace(/_+/g, '_') // collapse multiple underscores
  const filename = `oc/${Date.now()}-${safeName}`
  const { error } = await supabase.storage
    .from('invoice-documents')
    .upload(filename, file)

  if (error) throw new Error(error.message)

  const { data: { publicUrl } } = supabase.storage
    .from('invoice-documents')
    .getPublicUrl(filename)

  return publicUrl
}

// ---------------------------------------------------------------------------
// 10. GET ALEGRA NUMBER TEMPLATES (for invoice numbering)
// ---------------------------------------------------------------------------

export async function getAlegraNumberTemplates() {
  const templates = await alegraFetch('/number-templates?type=invoice')
  return templates
}

// ---------------------------------------------------------------------------
// 11. CREATE INCOME INVOICE FROM ALEGRA REQUEST (when facturada)
// ---------------------------------------------------------------------------

export async function createIncomeInvoiceFromRequest(requestId: string) {
  const supabase = await createClient()

  // Get the request
  const { data: request, error: fetchError } = await (supabase as any)
    .from('alegra_invoice_requests')
    .select('*')
    .eq('id', requestId)
    .single()

  if (fetchError || !request) {
    console.error('[Income] Failed to fetch request:', fetchError?.message)
    return null
  }

  // Check if already created (avoid duplicates) using numero_documento
  const docRef = request.alegra_numero_factura || (request.alegra_invoice_id ? `Alegra-${request.alegra_invoice_id}` : null)
  if (docRef) {
    const { data: existing } = await (supabase as any)
      .from('income_invoices')
      .select('id')
      .eq('numero_documento', docRef)
      .single()

    if (existing) {
      console.log('[Income] Invoice already exists for numero_documento:', docRef)
      return existing
    }
  }

  // Map fields from alegra request to income invoice
  const invoiceData: Record<string, unknown> = {
    sociedad: request.sociedad,
    razon_social_cliente: request.alegra_client_name,
    moneda: request.moneda,
    monto_recurrente: request.total || 0,
    monto_no_recurrente: 0,
    monto_creacion_contenido: 0,
    total_usd: request.total_usd || null,
    currency_exchange_rate: request.currency_exchange_rate || null,
    total_moneda_local: request.total || null,
    fecha_creacion: request.fecha_emision,
    fecha_vencimiento: request.fecha_vencimiento,
    estado: 'Pendiente',
    vendedor: request.vendedor_nombre || null,
    numero_documento: docRef || null,
    tipo_documento: 'Factura Alegra',
    documento_url: request.alegra_pdf_url || null,
  }

  // Try to extract commission from observaciones
  const comisionMatch = (request.observaciones || '').match(/Comisión:\s*([\d.]+)%/)
  if (comisionMatch) {
    invoiceData.porcentaje_comision = parseFloat(comisionMatch[1])
  }

  const { data: created, error: insertError } = await (supabase as any)
    .from('income_invoices')
    .insert(invoiceData)
    .select()
    .single()

  if (insertError) {
    console.error('[Income] Failed to create income invoice:', insertError.message)
    return null
  }

  console.log('[Income] Created income invoice:', created?.id)
  revalidatePath('/income-invoices')
  return created
}

// ---------------------------------------------------------------------------
// 12. SEND DIFERIDO DATA TO GOOGLE SHEETS (Income Segmentation)
// ---------------------------------------------------------------------------

export async function sendDiferidoToSheets(data: {
  client_name: string
  sociedad: string
  vendedor: string
  fecha_emision: string
  numero_factura?: string
  cuotas: Array<{ mes: string; monto: number; monto_usd?: number }>
}) {
  const sheetsWebhookUrl = process.env.GOOGLE_SHEETS_INCOME_SEGMENTATION_URL
  if (!sheetsWebhookUrl) {
    console.warn('[Sheets] GOOGLE_SHEETS_INCOME_SEGMENTATION_URL not configured, skipping')
    return null
  }

  try {
    const res = await fetch(sheetsWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (!res.ok) {
      const errorText = await res.text()
      console.error('[Sheets] Failed to send diferido data:', errorText)
      return null
    }

    const result = await res.json()
    console.log('[Sheets] Diferido data sent, rows added:', result.rowsAdded)
    return result
  } catch (error) {
    console.error('[Sheets] Error sending diferido data:', error)
    return null
  }
}

// ---------------------------------------------------------------------------
// LOCAL CLIENTS - from income_invoices table by sociedad
// ---------------------------------------------------------------------------

export async function getLocalClients(sociedad: string, query?: string) {
  const supabase = await createClient()

  let dbQuery = (supabase as any)
    .from('income_invoices')
    .select('razon_social_cliente')
    .eq('sociedad', sociedad)
    .not('razon_social_cliente', 'is', null)
    .order('razon_social_cliente', { ascending: true })

  if (query) {
    dbQuery = dbQuery.ilike('razon_social_cliente', `%${query}%`)
  }

  dbQuery = dbQuery.limit(100)

  const { data, error } = await dbQuery
  if (error) {
    console.error('[LocalClients] Error:', error.message)
    return []
  }

  // Get unique client names
  const unique = Array.from(new Set((data || []).map((r: any) => r.razon_social_cliente).filter(Boolean))) as string[]
  return unique.map((name: string, i: number) => ({ id: `local-${i}`, name }))
}

// ---------------------------------------------------------------------------
// 13. SEND SLACK NOTIFICATION ON NEW INVOICE REQUEST
// ---------------------------------------------------------------------------

const SLACK_NOTIFY_CHANNEL = 'C04JUTJQ7AN'
const SLACK_NOTIFY_USERS = [
  'U020B382918',  // Tati
  'U0B0CGUCVDX',  // Aleja
  'U04CTV3SYAU',  // Jeremy
  'U052L6W2F6J',  // Mari
]

export async function sendSlackNewRequestNotification(data: {
  client_name: string
  sociedad: string
  moneda: string
  total: number
  total_usd?: number | null
  vendedor: string
  solicitante: string
  fecha_emision: string
  es_cliente_nuevo?: boolean
  es_diferido?: boolean
  num_cuotas?: number
}) {
  const botToken = process.env.SLACK_BOT_TOKEN
  if (!botToken) {
    console.error('[Slack] SLACK_BOT_TOKEN not configured in environment')
    return null
  }

  const mentions = SLACK_NOTIFY_USERS.map(id => `<@${id}>`).join(' ')
  const totalStr = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 0 }).format(data.total)
  const totalUsdStr = data.total_usd
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(data.total_usd)
    : null

  const blocks: any[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: '🧾 Nueva Solicitud de Factura', emoji: true },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${mentions}\nSe ha creado una nueva solicitud de factura:`,
      },
    },
    { type: 'divider' },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*🏢 Cliente:*\n${data.client_name}${data.es_cliente_nuevo ? ' _(nuevo)_' : ''}` },
        { type: 'mrkdwn', text: `*🏦 Sociedad:*\n${data.sociedad}` },
        { type: 'mrkdwn', text: `*💰 Total:*\n${totalStr} ${data.moneda}${totalUsdStr ? ` (${totalUsdStr})` : ''}` },
        { type: 'mrkdwn', text: `*📅 Emisión:*\n${data.fecha_emision}` },
        { type: 'mrkdwn', text: `*👤 Vendedor:*\n${data.vendedor || 'N/A'}` },
        { type: 'mrkdwn', text: `*📝 Solicitante:*\n${data.solicitante}` },
      ],
    },
  ]

  if (data.es_diferido && data.num_cuotas) {
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `📊 _Pago diferido en ${data.num_cuotas} cuotas_` }],
    })
  }

  blocks.push({ type: 'divider' })
  blocks.push({
    type: 'context',
    elements: [{ type: 'mrkdwn', text: `_hackÜ Cash Flow · <https://finanzas-hacku.vercel.app/alegra-invoices|Ver solicitudes>_` }],
  })

  try {
    const res = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${botToken}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        channel: SLACK_NOTIFY_CHANNEL,
        username: 'hackÜ Finance',
        icon_emoji: ':money_with_wings:',
        blocks,
      }),
    })

    const result = await res.json()
    if (!result.ok) {
      console.error('[Slack] Error:', result.error)
    } else {
      console.log('[Slack] Notification sent')
    }
    return result
  } catch (error) {
    console.error('[Slack] Exception:', error)
    return null
  }
}
