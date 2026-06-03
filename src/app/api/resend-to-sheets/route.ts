/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * GET /api/resend-to-sheets?month=2026-06
 * One-time endpoint to resend all invoice requests for a month to Google Sheets
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const month = searchParams.get("month") || "2026-06"

  const sheetsUrl = process.env.GOOGLE_SHEETS_INCOME_SEGMENTATION_URL
  if (!sheetsUrl) {
    return NextResponse.json({ error: "GOOGLE_SHEETS_INCOME_SEGMENTATION_URL not set" }, { status: 500 })
  }

  const supabase = await createClient()

  // Get all requests for the month
  const startDate = `${month}-01`
  const endDate = `${month}-31`

  const { data: requests, error } = await (supabase as any)
    .from("alegra_invoice_requests")
    .select("*")
    .gte("fecha_emision", startDate)
    .lte("fecha_emision", endDate)
    .order("fecha_emision", { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const results: any[] = []

  for (const req of requests || []) {
    const items = req.items || []
    const total = req.total || 0
    const totalUsd = req.total_usd || null
    const moneda = req.moneda || "COP"

    // Check if diferido info exists in observaciones
    const diferidoMatch = (req.observaciones || "").match(/Pago diferido en (\d+) cuotas: (.+)/)

    let cuotas: Array<{ mes: string; monto: number; monto_usd?: number }>

    if (diferidoMatch) {
      // Parse diferido cuotas from observaciones
      const cuotasStr = diferidoMatch[2].split(" | ")
      const fechaBase = new Date(req.fecha_emision + "T00:00:00")

      cuotas = cuotasStr.map((c: string, i: number) => {
        const [mes, montoStr] = c.split(": ")
        const monto = parseFloat(montoStr?.replace(/\./g, "").replace(",", ".")) || 0
        const montoUsd = totalUsd && total > 0 ? Math.round((monto / total) * totalUsd * 100) / 100 : undefined
        return { mes: mes?.trim() || "", monto, monto_usd: montoUsd }
      })
    } else {
      // Single row with full total
      const fechaBase = new Date(req.fecha_emision + "T00:00:00")
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
      const mesStr = months[fechaBase.getMonth()] + "/" + String(fechaBase.getFullYear()).slice(-2)

      // Calculate USD if not available
      let montoUsd = totalUsd
      if (!montoUsd && moneda === "COP") {
        montoUsd = Math.round((total / 4150) * 100) / 100 // fallback rate
      }

      cuotas = [{
        mes: mesStr,
        monto: total,
        monto_usd: montoUsd || total,
      }]
    }

    const payload = {
      client_name: req.alegra_client_name,
      sociedad: req.sociedad,
      vendedor: req.vendedor_nombre || "",
      fecha_emision: req.fecha_emision,
      numero_factura: req.alegra_numero_factura || (req.alegra_invoice_id ? String(req.alegra_invoice_id) : ""),
      cuotas,
    }

    try {
      const res = await fetch(sheetsUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const result = await res.json().catch(() => ({ status: res.status }))
      results.push({ client: req.alegra_client_name, factura: req.alegra_invoice_id, sent: true, result })
    } catch (e: any) {
      results.push({ client: req.alegra_client_name, factura: req.alegra_invoice_id, sent: false, error: e.message })
    }
  }

  return NextResponse.json({
    month,
    total: requests?.length || 0,
    results,
  })
}
