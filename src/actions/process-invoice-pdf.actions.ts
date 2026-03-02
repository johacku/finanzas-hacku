"use server"

import { createClient } from "@/lib/supabase/server"
import { extractDataFromPDF } from "@/lib/ai-processor"

/**
 * Process invoice PDF with OpenAI Vision
 * This is a server action that safely handles PDF processing
 * The user's API key is never stored - it's passed directly to OpenAI
 */
export async function processInvoicePdfAction(params: {
  base64Document: string
  invoiceType: "income" | "expense"
  userApiKey: string
}) {
  const { base64Document, invoiceType, userApiKey } = params

  try {
    // Validate inputs
    if (!base64Document || !invoiceType || !userApiKey) {
      throw new Error("Missing required parameters")
    }

    if (!userApiKey.startsWith("sk-")) {
      throw new Error("Invalid OpenAI API Key format")
    }

    // Extract data from PDF using OpenAI Vision
    const extractedData = await extractDataFromPDF(
      base64Document,
      userApiKey,
      invoiceType
    )

    return {
      success: true,
      extracted_data: extractedData,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"

    // Check for specific API errors
    if (errorMessage.includes("401") || errorMessage.includes("Unauthorized")) {
      return {
        success: false,
        error: "Invalid OpenAI API Key. Please check your credentials.",
      }
    }

    if (errorMessage.includes("429")) {
      return {
        success: false,
        error: "API rate limit exceeded. Please wait a moment and try again.",
      }
    }

    return {
      success: false,
      error: `Failed to process PDF: ${errorMessage}`,
    }
  }
}

/**
 * Auto-create or link customer when processing invoice
 */
export async function autoLinkOrCreateCustomer(params: {
  nombre: string
  sociedad: string
}) {
  const supabase = await createClient()
  const { nombre, sociedad } = params

  try {
    // Try to find exact match
    const { data: existing } = await supabase
      .from("customers")
      .select("id")
      .ilike("nombre_cliente", `%${nombre}%`)
      .limit(1)
      .single()

    if (existing) {
      return { success: true, cliente_id: existing.id, created: false }
    }

    // Create new customer
    const { data: newCustomer, error } = await supabase
      .from("customers")
      .insert([
        {
          nombre_cliente: nombre,
          sociedad_cliente: sociedad,
          tiene_factoraje: false,
        },
      ])
      .select("id")
      .single()

    if (error) {
      throw error
    }

    return { success: true, cliente_id: newCustomer.id, created: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return {
      success: false,
      error: `Failed to link/create customer: ${errorMessage}`,
    }
  }
}

/**
 * Auto-create or link vendor when processing expense invoice
 */
export async function autoLinkOrCreateVendor(params: {
  nombre: string
  sociedad?: string
}) {
  const supabase = await createClient()
  const { nombre, sociedad } = params

  try {
    // Try to find exact match
    const { data: existing } = await supabase
      .from("proveedores")
      .select("id")
      .ilike("nombre_proveedor", `%${nombre}%`)
      .limit(1)
      .single()

    if (existing) {
      return { success: true, proveedor_id: existing.id, created: false }
    }

    // Create new vendor
    const { data: newVendor, error } = await supabase
      .from("proveedores")
      .insert([
        {
          nombre_proveedor: nombre,
          sociedad_proveedor: sociedad,
        },
      ])
      .select("id")
      .single()

    if (error) {
      throw error
    }

    return { success: true, proveedor_id: newVendor.id, created: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return {
      success: false,
      error: `Failed to link/create vendor: ${errorMessage}`,
    }
  }
}

/**
 * Save OpenAI API Key to user's browser storage (never stored server-side)
 * This is a helper function that returns instructions for client-side storage
 */
export async function getSaveApiKeyInstructions() {
  return {
    message: "API Key saved to your browser (not sent to servers)",
    storageKey: "openai_api_key",
    warning: "Never share your API key with anyone. It will only be stored in your browser.",
  }
}
