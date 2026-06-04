/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * GET /api/fix-oc-urls
 * Regenerates public URLs for all OC files
 */
export async function GET() {
  const supabase = await createClient()

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

    // Extract file path from old URL
    let filePath = ""
    if (oldUrl.includes("/invoice-documents/")) {
      filePath = oldUrl.split("/invoice-documents/")[1]?.split("?")[0] || ""
    } else if (oldUrl.includes("/oc/")) {
      filePath = "oc/" + oldUrl.split("/oc/")[1]?.split("?")[0] || ""
    }

    if (!filePath) {
      results.push({ id: req.id, oc_numero: req.oc_numero, status: "skipped" })
      continue
    }

    // Generate permanent public URL
    const { data: { publicUrl } } = supabase.storage
      .from("invoice-documents")
      .getPublicUrl(filePath)

    const { error: updateError } = await (supabase as any)
      .from("alegra_invoice_requests")
      .update({ oc_url: publicUrl })
      .eq("id", req.id)

    results.push({
      id: req.id,
      oc_numero: req.oc_numero,
      status: updateError ? "error" : "fixed",
      url: publicUrl?.substring(0, 80) + "...",
    })
  }

  return NextResponse.json({ total: requests?.length || 0, results })
}
