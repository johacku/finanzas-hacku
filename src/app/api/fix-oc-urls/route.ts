/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * GET /api/fix-oc-urls
 * Regenerates signed URLs for all OC files that have broken public URLs
 */
export async function GET() {
  const supabase = await createClient()

  // Get all requests that have oc_url
  const { data: requests, error } = await (supabase as any)
    .from("alegra_invoice_requests")
    .select("id, oc_url, oc_numero")
    .not("oc_url", "is", null)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const results: any[] = []

  for (const req of requests || []) {
    const oldUrl = req.oc_url as string
    if (!oldUrl) continue

    // Extract the file path from the old URL
    // Old URLs look like: https://xxx.supabase.co/storage/v1/object/public/invoice-documents/oc/1234-file.pdf
    // We need: oc/1234-file.pdf
    let filePath = ""

    if (oldUrl.includes("/invoice-documents/")) {
      filePath = oldUrl.split("/invoice-documents/")[1]?.split("?")[0] || ""
    } else if (oldUrl.includes("/oc/")) {
      filePath = "oc/" + oldUrl.split("/oc/")[1]?.split("?")[0] || ""
    }

    if (!filePath) {
      results.push({ id: req.id, oc_numero: req.oc_numero, status: "skipped", reason: "could not parse path" })
      continue
    }

    // Generate new signed URL (1 year)
    const { data: signedData, error: signError } = await supabase.storage
      .from("invoice-documents")
      .createSignedUrl(filePath, 60 * 60 * 24 * 365)

    if (signError || !signedData?.signedUrl) {
      results.push({ id: req.id, oc_numero: req.oc_numero, status: "error", reason: signError?.message || "no signed url" })
      continue
    }

    // Update the record
    const { error: updateError } = await (supabase as any)
      .from("alegra_invoice_requests")
      .update({ oc_url: signedData.signedUrl })
      .eq("id", req.id)

    if (updateError) {
      results.push({ id: req.id, oc_numero: req.oc_numero, status: "error", reason: updateError.message })
    } else {
      results.push({ id: req.id, oc_numero: req.oc_numero, status: "fixed", newUrl: signedData.signedUrl.substring(0, 80) + "..." })
    }
  }

  return NextResponse.json({
    total: requests?.length || 0,
    results,
  })
}
