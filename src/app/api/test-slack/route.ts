/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { sendSlackNewRequestNotification } from "@/actions/alegra.actions"
import { requireCronSecret } from "@/lib/api-auth"

export async function GET(request: Request) {
  const denied = requireCronSecret(request)
  if (denied) return denied

  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  const botToken = process.env.SLACK_BOT_TOKEN
  if (!botToken) {
    return NextResponse.json({ error: "SLACK_BOT_TOKEN not configured" }, { status: 500 })
  }

  // Resend notifications for last N solicitudes
  if (action === 'resend') {
    const limit = parseInt(searchParams.get('limit') || '2')
    const supabase = createServiceClient()
    const { data: requests } = await (supabase as any)
      .from('alegra_invoice_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    const results = []
    for (const req of requests || []) {
      try {
        await sendSlackNewRequestNotification({
          client_name: req.alegra_client_name,
          sociedad: req.sociedad,
          moneda: req.moneda,
          total: req.total,
          total_usd: req.total_usd,
          vendedor: req.vendedor_nombre || '',
          solicitante: req.solicitante_nombre,
          fecha_emision: req.fecha_emision,
        })
        results.push({ client: req.alegra_client_name, sent: true })
      } catch (e: any) {
        results.push({ client: req.alegra_client_name, sent: false, error: e.message })
      }
    }
    return NextResponse.json({ results })
  }

  // Default: simple test
  try {
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: { "Authorization": `Bearer ${botToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ channel: "C04JUTJQ7AN", text: "🧪 Test — Slack conectado." }),
    })
    const data = await res.json()
    return NextResponse.json({ ok: data.ok, error: data.error || null, token_prefix: botToken.substring(0, 10) + "..." })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 })
  }
}
