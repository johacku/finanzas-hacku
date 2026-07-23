/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { createAlegraInvoiceDraft, createAlegraRemission, createAlegraInvoiceRequest, sendSlackNewRequestNotification } from "@/actions/alegra.actions"
import { requireCronSecret } from "@/lib/api-auth"

export async function GET(request: Request) {
  const denied = requireCronSecret(request)
  if (denied) return denied

  const supabase = createServiceClient()
  const today = new Date()
  const dayOfMonth = today.getDate()
  const todayStr = today.toISOString().split('T')[0]

  // Get active templates for today's day
  const { data: templates, error } = await (supabase as any)
    .from('recurring_invoice_templates')
    .select('*')
    .eq('activo', true)
    .eq('dia_recurrencia', dayOfMonth)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const results: any[] = []

  for (const tpl of templates || []) {
    // Skip if already executed today
    if (tpl.ultima_ejecucion === todayStr) {
      results.push({ id: tpl.id, client: tpl.alegra_client_name, status: 'skipped', reason: 'already executed today' })
      continue
    }

    try {
      const isHackuSAS = tpl.sociedad === 'hackÜ SAS'
      let alegraId: string | null = null

      // Calculate dates
      const fechaEmision = todayStr
      const vencDate = new Date(today)
      vencDate.setDate(vencDate.getDate() + (tpl.dias_vencimiento || 30))
      const fechaVencimiento = vencDate.toISOString().split('T')[0]

      // Create in Alegra if SAS
      if (isHackuSAS && tpl.alegra_client_id && tpl.alegra_client_id !== 'nuevo') {
        const alegraItems = (tpl.items || []).map((item: any) => ({
          id: item.alegra_item_id || item.id,
          price: item.price,
          quantity: item.quantity,
          description: item.description || undefined,
          discount: item.discount || 0,
        }))

        if (tpl.tipo_documento === 'orden_servicio') {
          const result = await createAlegraRemission({
            clientId: tpl.alegra_client_id,
            date: fechaEmision,
            dueDate: fechaVencimiento,
            items: alegraItems,
            observations: tpl.observaciones || undefined,
            anotation: tpl.anotaciones || undefined,
          })
          if (result.success) alegraId = String(result.data?.id ?? '')
        } else {
          const result = await createAlegraInvoiceDraft({
            clientId: tpl.alegra_client_id,
            date: fechaEmision,
            dueDate: fechaVencimiento,
            items: alegraItems,
            observations: tpl.observaciones || undefined,
            anotation: tpl.anotaciones || undefined,
          })
          if (result.success) alegraId = String(result.data?.id ?? '')
        }
      }

      // Create request in DB
      await createAlegraInvoiceRequest({
        alegra_invoice_id: alegraId || undefined,
        alegra_client_id: tpl.alegra_client_id || 'recurrente',
        alegra_client_name: tpl.alegra_client_name,
        sociedad: tpl.sociedad,
        moneda: tpl.moneda,
        fecha_emision: fechaEmision,
        fecha_vencimiento: fechaVencimiento,
        observaciones: `${tpl.observaciones || ''}\n\n[Factura recurrente - día ${tpl.dia_recurrencia} de cada mes]`.trim(),
        anotaciones: tpl.anotaciones || null,
        items: tpl.items,
        subtotal: tpl.total,
        impuestos: 0,
        total: tpl.total,
        total_usd: tpl.total_usd || undefined,
        solicitante_email: tpl.solicitante_email,
        solicitante_nombre: tpl.solicitante_nombre,
        vendedor_nombre: tpl.vendedor_nombre || null,
        oc_numero: tpl.oc_numero || null,
        status: isHackuSAS ? 'borrador' : 'pendiente_aprobacion',
      }, { useServiceRole: true })

      // Send Slack
      await sendSlackNewRequestNotification({
        client_name: tpl.alegra_client_name,
        sociedad: tpl.sociedad,
        moneda: tpl.moneda,
        total: tpl.total,
        total_usd: tpl.total_usd,
        vendedor: tpl.vendedor_nombre || '',
        solicitante: tpl.solicitante_nombre,
        fecha_emision: fechaEmision,
        es_cliente_nuevo: false,
        es_diferido: false,
      }).catch(console.error)

      // Update last execution
      await (supabase as any)
        .from('recurring_invoice_templates')
        .update({ ultima_ejecucion: todayStr })
        .eq('id', tpl.id)

      results.push({ id: tpl.id, client: tpl.alegra_client_name, status: 'created', alegraId })
    } catch (e: any) {
      results.push({ id: tpl.id, client: tpl.alegra_client_name, status: 'error', error: e.message })
    }
  }

  return NextResponse.json({
    date: todayStr,
    day: dayOfMonth,
    processed: results.length,
    results,
  })
}
