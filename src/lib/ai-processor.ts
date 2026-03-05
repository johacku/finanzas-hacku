/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * OpenAI processor for extracting invoice data from PDFs
 * Downloads PDF, extracts text, sends to GPT-4o for JSON extraction
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

async function extractTextFromBuffer(buffer: Buffer): Promise<string> {
  const { default: pdfParse } = await import("pdf-parse")
  const data = await pdfParse(buffer)
  return data.text || ""
}

export async function extractDataFromPDF(
  documentUrl: string,
  userApiKey: string = "",
  invoiceType: "income" | "expense" = "income"
): Promise<ExtractedInvoiceData> {
  const apiKey = process.env.OPENAI_API_KEY || userApiKey
  if (!apiKey) throw new Error("OpenAI API key is required.")
  if (!documentUrl) throw new Error("Document URL is required")

  try {
    let pdfText = ""

    // If it's a base64 PDF, decode it
    if (documentUrl.startsWith("data:application/pdf") || documentUrl.startsWith("data:application/octet")) {
      const base64Data = documentUrl.split(",")[1]
      const buffer = Buffer.from(base64Data, "base64")
      pdfText = await extractTextFromBuffer(buffer)
    }
    // If it's a URL (e.g. Supabase public URL), fetch it
    else if (documentUrl.startsWith("http")) {
      const fetchResponse = await fetch(documentUrl)
      const arrayBuffer = await fetchResponse.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      pdfText = await extractTextFromBuffer(buffer)
    }
    // If it's a base64 image, use vision (not PDF)
    else if (documentUrl.startsWith("data:image")) {
      pdfText = "" // Will use vision below
    }

    const prompt =
      invoiceType === "income"
        ? `Eres un extractor de datos de facturas. Analiza el siguiente texto de una factura de INGRESO y extrae los datos en formato JSON.

Texto de la factura:
${pdfText}

Devuelve SOLO el siguiente JSON (sin markdown, sin explicaciones):
{
  "fecha": "YYYY-MM-DD o null",
  "nombre_cliente_proveedor": "nombre del cliente o null",
  "monto": número o null,
  "moneda": "USD/COP/MXN etc o null",
  "concepto": "descripción del servicio/producto o null",
  "numero_factura": "número de factura o null",
  "fecha_vencimiento": "YYYY-MM-DD o null"
}`
        : `Eres un extractor de datos de facturas. Analiza el siguiente texto de una factura de GASTO y extrae los datos en formato JSON.

Texto de la factura:
${pdfText}

Devuelve SOLO el siguiente JSON (sin markdown, sin explicaciones):
{
  "fecha": "YYYY-MM-DD o null",
  "nombre_cliente_proveedor": "nombre del proveedor o null",
  "monto": número o null,
  "moneda": "USD/COP/MXN etc o null",
  "concepto": "descripción del servicio/producto o null",
  "numero_factura": "número de factura o null",
  "fecha_vencimiento": "YYYY-MM-DD o null"
}`

    // Build content - text if PDF, vision if image
    const content: any[] = pdfText
      ? [{ type: "text", text: prompt }]
      : [
          { type: "image_url", image_url: { url: documentUrl } },
          {
            type: "text",
            text: prompt.replace(`\n\nTexto de la factura:\n${pdfText}\n\n`, "\n\nAnaliza la imagen de la factura.\n\n"),
          },
        ]

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content }],
        max_tokens: 1024,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`OpenAI API error: ${error.error?.message || "Unknown error"}`)
    }

    const data = await response.json()
    const extractedText = data.choices[0]?.message?.content

    if (!extractedText) throw new Error("No content returned from OpenAI API")

    let extracted: Partial<ExtractedInvoiceData> = {}
    try {
      extracted = JSON.parse(extractedText)
    } catch {
      const jsonMatch = extractedText.match(/```json\n?([\s\S]*?)\n?```/)
      if (jsonMatch) {
        extracted = JSON.parse(jsonMatch[1])
      } else {
        const jsonStart = extractedText.indexOf("{")
        const jsonEnd = extractedText.lastIndexOf("}") + 1
        if (jsonStart >= 0 && jsonEnd > jsonStart) {
          extracted = JSON.parse(extractedText.substring(jsonStart, jsonEnd))
        } else {
          throw new Error("Could not parse OpenAI response as JSON")
        }
      }
    }

    return {
      fecha: extracted.fecha || null,
      nombre_cliente_proveedor: extracted.nombre_cliente_proveedor || null,
      monto: extracted.monto ? Number(extracted.monto) : null,
      moneda: extracted.moneda || null,
      concepto: extracted.concepto || null,
      numero_factura: extracted.numero_factura || null,
      fecha_vencimiento: extracted.fecha_vencimiento || null,
      confidence: {
        fecha: extracted.fecha ? 0.95 : 0,
        nombre: extracted.nombre_cliente_proveedor ? 0.9 : 0,
        monto: extracted.monto ? 0.95 : 0,
        moneda: extracted.moneda ? 0.9 : 0,
      },
    }
  } catch (error) {
    console.error("PDF extraction error:", error)
    throw error
  }
}

export function validateExtractedData(data: ExtractedInvoiceData): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  if (!data.nombre_cliente_proveedor) errors.push("Cliente/Proveedor no fue detectado")
  if (!data.monto) errors.push("Monto no fue detectado")
  if (!data.fecha) errors.push("Fecha de emisión no fue detectada")
  if (!data.moneda) errors.push("Moneda no fue detectada")
  return { valid: errors.length === 0, errors }
}
