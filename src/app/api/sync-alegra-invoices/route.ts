/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * GET /api/sync-alegra-invoices?from=2026-07-01&limit=50
 * Syncs invoices from Alegra to income_invoices.
 * Only imports invoices that don't already exist (by numero_documento).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const fromDate = searchParams.get('from') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const limit = parseInt(searchParams.get('limit') || '100')

  const email = process.env.ALEGRA_API_EMAIL
  const token = process.env.ALEGRA_API_TOKEN
  if (!email || !token) return NextResponse.json({ error: "Alegra credentials not configured" }, { status: 500 })

  const auth = Buffer.from(`${email}:${token}`).toString('base64')
  const supabase = await createClient()

  // Get existing invoice numbers to avoid duplicates
  const { data: existing } = await (supabase as any)
    .from('income_invoices')
    .select('numero_documento')
    .not('numero_documento', 'is', null)

  const existingDocs = new Set((existing || []).map((e: any) => e.numero_documento))

  // Fetch invoices from Alegra (paginated)
  const allInvoices: any[] = []
  let start = 0
  const pageSize = 30

  while (allInvoices.length < limit) {
    const res = await fetch(
      `https://api.alegra.com/api/v1/invoices?start=${start}&limit=${pageSize}&order_direction=DESC&order_field=date&date_start=${fromDate}&metadata=true`,
      { headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' } }
    )
    if (!res.ok) break
    const result = await res.json()
    const data = result.data ?? result
    if (!Array.isArray(data) || data.length === 0) break
    allInvoices.push(...data)
    if (data.length < pageSize) break
    start += pageSize
  }

  let imported = 0
  let skipped = 0
  let errors = 0
  const details: any[] = []

  for (const inv of allInvoices) {
    const fullNumber = inv.numberTemplate?.fullNumber
    if (!fullNumber) { skipped++; continue }
    if (existingDocs.has(fullNumber)) { skipped++; continue }

    // Map Alegra status to our estado
    let estado = 'Pendiente'
    if (inv.status === 'closed' && inv.balance <= 0) estado = 'Pagada'
    else if (inv.status === 'void') estado = 'Anulada'
    else if (inv.status === 'open' || inv.status === 'closed') estado = 'Pendiente'

    // Map items
    const items = (inv.items || []).map((item: any) => ({
      alegra_item_id: String(item.id),
      name: item.name || item.description || '',
      description: item.description || '',
      quantity: item.quantity || 1,
      price: item.price || 0,
      discount: item.discount || 0,
    }))

    // Determine currency
    const moneda = inv.currency?.code || 'COP'
    const total = inv.total || 0

    const invoiceData = {
      sociedad: 'hackÜ SAS',
      razon_social_cliente: inv.client?.name || 'Desconocido',
      numero_documento: fullNumber,
      tipo_documento: 'Factura Alegra',
      estado,
      moneda,
      fecha_creacion: inv.date,
      fecha_vencimiento: inv.dueDate || inv.date,
      dia_pago_cliente: 0,
      tiene_factoraje: false,
      monto_recurrente: total,
      monto_no_recurrente: 0,
      monto_creacion_contenido: 0,
      total_moneda_local: moneda === 'COP' ? total : null,
      total_usd: moneda === 'USD' ? total : null,
      items: items.length > 0 ? items : null,
    }

    const { error } = await (supabase as any)
      .from('income_invoices')
      .insert(invoiceData)

    if (error) {
      errors++
      details.push({ doc: fullNumber, error: error.message })
    } else {
      imported++
      details.push({ doc: fullNumber, client: inv.client?.name, total, status: estado })
    }
  }

  return NextResponse.json({
    total_from_alegra: allInvoices.length,
    imported,
    skipped,
    errors,
    details: details.slice(0, 20),
  })
}
