"use server"

import { createClient } from "@/lib/supabase/server"
import { extractDataFromPDF, validateExtractedData } from "@/lib/ai-processor"

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface ProcessInvoiceParams {
  file: File
  invoiceType: "income" | "expense"
  userApiKey: string
}

interface ProcessedInvoiceData {
  documento_url: string
  extracted_data: {
    fecha: string | null
    nombre_cliente_proveedor: string | null
    monto: number | null
    moneda: string | null
    concepto: string | null
    numero_factura: string | null
    fecha_vencimiento: string | null
  }
  client_or_vendor_id: string | null
  warnings: string[]
  success: boolean
}

/**
 * Upload invoice PDF to Supabase Storage
 */
export async function uploadInvoicePDF(file: File): Promise<string> {
  const supabase = await createClient()

  const fileName = `${Date.now()}-${file.name}`
  const filePath = `invoices/${fileName}`

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { data: _uploadData, error } = await supabase.storage
    .from("invoice-documents")
    .upload(filePath, file)

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`)
  }

  // Get public URL
  const { data: publicUrlData } = supabase.storage
    .from("invoice-documents")
    .getPublicUrl(filePath)

  return publicUrlData.publicUrl
}

/**
 * Process invoice with OpenAI Vision and auto-complete form
 * User must provide their own OpenAI API key
 */
export async function processInvoiceWithAI(
  documentUrl: string,
  invoiceType: "income" | "expense",
  userApiKey: string
): Promise<ProcessedInvoiceData> {
  const supabase = await createClient()
  const warnings: string[] = []

  try {
    // Extract data from PDF using OpenAI Vision
    const extractedData = await extractDataFromPDF(
      documentUrl,
      userApiKey,
      invoiceType
    )

    // Validate extracted data
    const validation = validateExtractedData(extractedData)
    if (!validation.valid) {
      warnings.push(...validation.errors)
    }

    let clientOrVendorId: string | null = null

    // Try to match or create customer/vendor
    if (extractedData.nombre_cliente_proveedor) {
      if (invoiceType === "income") {
        // Try to find existing customer with fuzzy match
        const { data: customers } = await supabase
          .from("customers")
          .select("id, nombre_cliente")
          .ilike("nombre_cliente", `%${extractedData.nombre_cliente_proveedor}%`)
          .limit(1)

        if (customers && customers.length > 0) {
          clientOrVendorId = customers[0].id
        } else {
          // Create new customer if not found
          const newCustomer = {
            nombre_cliente: extractedData.nombre_cliente_proveedor,
            tiene_factoraje: false,
          }

          const { data: created, error } = await supabase
            .from("customers")
            .insert([newCustomer])
            .select("id")

          if (!error && created && created.length > 0) {
            clientOrVendorId = created[0].id
            warnings.push(
              `Cliente creado automáticamente: ${extractedData.nombre_cliente_proveedor}`
            )
          }
        }
      } else {
        // For expense invoices, try to find existing vendor
        const { data: vendors } = await supabase
          .from("proveedores")
          .select("id, nombre_proveedor")
          .ilike("nombre_proveedor", `%${extractedData.nombre_cliente_proveedor}%`)
          .limit(1)

        if (vendors && vendors.length > 0) {
          clientOrVendorId = vendors[0].id
        } else {
          // Create new vendor if not found
          const newVendor = {
            nombre_proveedor: extractedData.nombre_cliente_proveedor,
          }

          const { data: created, error } = await supabase
            .from("proveedores")
            .insert([newVendor])
            .select("id")

          if (!error && created && created.length > 0) {
            clientOrVendorId = created[0].id
            warnings.push(
              `Proveedor creado automáticamente: ${extractedData.nombre_cliente_proveedor}`
            )
          }
        }
      }
    }

    return {
      documento_url: documentUrl,
      extracted_data: {
        fecha: extractedData.fecha,
        nombre_cliente_proveedor: extractedData.nombre_cliente_proveedor,
        monto: extractedData.monto,
        moneda: extractedData.moneda,
        concepto: extractedData.concepto,
        numero_factura: extractedData.numero_factura,
        fecha_vencimiento: extractedData.fecha_vencimiento,
      },
      client_or_vendor_id: clientOrVendorId,
      warnings,
      success: validation.valid,
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error"
    console.error("Invoice processing error:", errorMessage)

    return {
      documento_url: documentUrl,
      extracted_data: {
        fecha: null,
        nombre_cliente_proveedor: null,
        monto: null,
        moneda: null,
        concepto: null,
        numero_factura: null,
        fecha_vencimiento: null,
      },
      client_or_vendor_id: null,
      warnings: [`Error procesando PDF: ${errorMessage}`],
      success: false,
    }
  }
}

// fileToBase64 has been moved to /lib/file-utils.ts since it uses browser APIs (FileReader)
// Client-side files should import from: import { fileToBase64 } from '@/lib/file-utils'
