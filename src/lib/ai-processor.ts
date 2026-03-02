/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * OpenAI Vision API processor for extracting invoice data from PDFs
 * User must provide their own API key (never stored server-side)
 */

interface ExtractedInvoiceData {
  fecha: string | null
  nombre_cliente_proveedor: string | null
  monto: number | null
  moneda: string | null
  concepto: string | null
  numero_factura: string | null
  fecha_vencimiento: string | null
  confidence: {
    fecha: number
    nombre: number
    monto: number
    moneda: number
  }
}

interface DocumentContent {
  type: "image" | "text"
  text?: string
  image_url?: {
    url: string
  }
}

/**
 * Extract invoice data from PDF document using OpenAI Vision API
 * @param documentUrl - URL of the PDF document (must be publicly accessible or base64)
 * @param userApiKey - User's OpenAI API key (passed as parameter, never stored)
 * @param invoiceType - Type of invoice: "income" or "expense"
 * @returns Extracted structured invoice data with confidence scores
 */
export async function extractDataFromPDF(
  documentUrl: string,
  userApiKey: string,
  invoiceType: "income" | "expense"
): Promise<ExtractedInvoiceData> {
  if (!userApiKey) {
    throw new Error("OpenAI API key is required")
  }

  if (!documentUrl) {
    throw new Error("Document URL is required")
  }

  try {
    // Determine if URL is base64 or public URL
    const isBase64 = documentUrl.startsWith("data:")
    const imageSource = isBase64
      ? {
          type: "base64",
          media_type: "image/jpeg",
          data: documentUrl.split(",")[1],
        }
      : {
          type: "url",
          url: documentUrl,
        }

    const prompt =
      invoiceType === "income"
        ? `Analiza esta factura de ingreso y extrae la siguiente información en formato JSON:
        - fecha (YYYY-MM-DD): fecha de emisión
        - nombre_cliente_proveedor (string): nombre del cliente
        - monto (number): monto facturado
        - moneda (string): moneda (USD, COP, MXN, etc.)
        - concepto (string): descripción de servicios/productos
        - numero_factura (string): número de factura si está disponible
        - fecha_vencimiento (YYYY-MM-DD): fecha de vencimiento si está disponible

        Responde SOLO con JSON válido, sin markdown ni explicaciones adicionales.`
        : `Analiza esta factura de gasto y extrae la siguiente información en formato JSON:
        - fecha (YYYY-MM-DD): fecha de emisión
        - nombre_cliente_proveedor (string): nombre del proveedor
        - monto (number): monto de la factura
        - moneda (string): moneda (USD, COP, MXN, etc.)
        - concepto (string): descripción de servicios/productos
        - numero_factura (string): número de factura si está disponible
        - fecha_vencimiento (YYYY-MM-DD): fecha de vencimiento si está disponible

        Responde SOLO con JSON válido, sin markdown ni explicaciones adicionales.`

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4-vision",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url" as const,
                image_url:
                  imageSource.type === "url"
                    ? { url: imageSource.url }
                    : {
                        url: `data:image/jpeg;base64,${(imageSource as any).data}`,
                      },
              },
              {
                type: "text",
                text: prompt,
              },
            ],
          },
        ],
        max_tokens: 1024,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(
        `OpenAI API error: ${error.error?.message || "Unknown error"}`
      )
    }

    const data = await response.json()
    const extractedText = data.choices[0]?.message?.content

    if (!extractedText) {
      throw new Error("No content returned from OpenAI API")
    }

    // Parse JSON from response
    let extracted: Partial<ExtractedInvoiceData> = {}
    try {
      extracted = JSON.parse(extractedText)
    } catch (e) {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = extractedText.match(/```json\n?([\s\S]*?)\n?```/)
      if (jsonMatch) {
        extracted = JSON.parse(jsonMatch[1])
      } else {
        throw new Error("Could not parse OpenAI response as JSON")
      }
    }

    // Add confidence scores based on data presence and format
    const confidence = {
      fecha: extracted.fecha ? 0.95 : 0,
      nombre: extracted.nombre_cliente_proveedor ? 0.9 : 0,
      monto: extracted.monto ? 0.95 : 0,
      moneda: extracted.moneda ? 0.9 : 0,
    }

    return {
      fecha: extracted.fecha || null,
      nombre_cliente_proveedor: extracted.nombre_cliente_proveedor || null,
      monto: extracted.monto ? Number(extracted.monto) : null,
      moneda: extracted.moneda || null,
      concepto: extracted.concepto || null,
      numero_factura: extracted.numero_factura || null,
      fecha_vencimiento: extracted.fecha_vencimiento || null,
      confidence,
    }
  } catch (error) {
    console.error("PDF extraction error:", error)
    throw error
  }
}

/**
 * Validate extracted invoice data
 */
export function validateExtractedData(
  data: ExtractedInvoiceData
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!data.nombre_cliente_proveedor) {
    errors.push("Cliente/Proveedor no fue detectado")
  }
  if (!data.monto) {
    errors.push("Monto no fue detectado")
  }
  if (!data.fecha) {
    errors.push("Fecha de emisión no fue detectada")
  }
  if (!data.moneda) {
    errors.push("Moneda no fue detectada")
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
