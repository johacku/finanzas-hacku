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
// 1. GET CONTACTS (clients) - with search and pagination
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

export async function getAlegraItems(query?: string, start: number = 0) {
  const params = new URLSearchParams({
    start: String(start),
    limit: '30',
    metadata: 'true',
  })

  if (query) {
    params.set('query', query)
  }

  const result = await alegraFetch(`/items?${params.toString()}`)

  return {
    data: result.data ?? result,
    total: result.metadata?.total ?? 0,
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

export async function updateAlegraRequestStatus(
  id: string,
  status: string,
  extra?: {
    aprobado_por?: string
    alegra_pdf_url?: string
    alegra_numero_factura?: string
    alegra_invoice_id?: string
    fecha_facturacion?: string
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

  const { error } = await (supabase as any)
    .from('alegra_invoice_requests')
    .update(updateData)
    .eq('id', id)

  if (error) throw new Error(error.message)

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

  const filename = `oc/${Date.now()}-${file.name}`
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
// 11. SEND DIFERIDO DATA TO GOOGLE SHEETS (Income Segmentation)
// ---------------------------------------------------------------------------

export async function sendDiferidoToSheets(data: {
  client_name: string
  sociedad: string
  vendedor: string
  fecha_emision: string
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
