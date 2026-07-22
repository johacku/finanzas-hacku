/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { verifyAlegraWebhook } from "@/lib/api-auth"

/**
 * Build Basic Auth header for Alegra API.
 */
function getAlegraAuthHeader(): string {
  const email = process.env.ALEGRA_API_EMAIL || ""
  const token = process.env.ALEGRA_API_TOKEN || ""
  const encoded = Buffer.from(`${email}:${token}`).toString("base64")
  return `Basic ${encoded}`
}

/**
 * Fetch the invoice PDF URL from Alegra API.
 */
async function fetchAlegraInvoicePdf(invoiceId: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.alegra.com/api/v1/invoices/${invoiceId}?fields=pdf`,
      {
        method: "GET",
        headers: {
          Authorization: getAlegraAuthHeader(),
          Accept: "application/json",
        },
      }
    )

    if (!response.ok) {
      console.error(`Alegra API error: ${response.status} ${response.statusText}`)
      return null
    }

    const invoiceData = await response.json()
    return invoiceData.pdf || null
  } catch (error) {
    console.error("Failed to fetch Alegra invoice PDF:", error)
    return null
  }
}

/**
 * POST /api/alegra-webhook
 * Called by Alegra when invoices are created, edited, or deleted.
 * Handles the edit-invoice event to detect draft -> open (facturada) transitions.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Verify the shared secret before processing.
    // verifyAlegraWebhook accepts the token from either the `x-alegra-token`
    // header or the `secret`/`token` field in the JSON body, and emits a
    // console.warn (rather than rejecting) when ALEGRA_WEBHOOK_SECRET is unset
    // so that existing integrations already configured in Alegra's dashboard
    // continue to work while the secret is being rolled out.
    if (!verifyAlegraWebhook(request, body ?? {})) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Alegra sends a validation POST with empty body during subscription setup
    if (!body || !body.id) {
      return NextResponse.json({ ok: true })
    }

    const alegraInvoiceId = String(body.id)
    const status: string | undefined = body.status // draft, open, closed, void
    const numberTemplate = body.numberTemplate

    // Use the service-role client so this server-to-server call (no user
    // session) bypasses the `authenticated`-only RLS policy on
    // alegra_invoice_requests. The token gate above (verifyAlegraWebhook) is
    // the sole authorisation boundary for this endpoint.
    const supabase = createServiceClient()

    // Find matching request in our DB
    const { data: requestRecord } = await (supabase as any)
      .from("alegra_invoice_requests")
      .select("id, status")
      .eq("alegra_invoice_id", alegraInvoiceId)
      .single()

    if (!requestRecord) {
      // Not a tracked invoice, ignore
      return NextResponse.json({ ok: true, message: "Not tracked" })
    }

    // If invoice is now open or closed (facturada), update our record
    if (status === "open" || status === "closed") {
      // Fetch PDF from Alegra API
      const pdfUrl = await fetchAlegraInvoicePdf(alegraInvoiceId)

      // Update our record
      await (supabase as any)
        .from("alegra_invoice_requests")
        .update({
          status: "facturada",
          alegra_pdf_url: pdfUrl,
          alegra_numero_factura:
            numberTemplate?.text || numberTemplate?.number || null,
          fecha_facturacion: new Date().toISOString(),
        })
        .eq("id", requestRecord.id)
    }

    // If invoice is voided
    if (status === "void") {
      await (supabase as any)
        .from("alegra_invoice_requests")
        .update({ status: "anulada" })
        .eq("id", requestRecord.id)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Alegra webhook error:", error)
    // Always return 200 to avoid Alegra retries
    return NextResponse.json({ ok: true })
  }
}

/**
 * GET /api/alegra-webhook
 * Health check endpoint.
 */
export async function GET() {
  return NextResponse.json({ status: "ok", service: "alegra-webhook" })
}
