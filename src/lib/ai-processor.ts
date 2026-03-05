/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * OpenAI processor for extracting invoice data from PDFs and images
 * Supports both PDF files and image formats
 */

import pdfParse from "pdf-parse"

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

/**
 * Extract text from PDF buffer
 */
async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    const pdfData = await pdfParse(buffer)
    return pdfData.text || ""
  } catch (error) {
    console.error("PDF parsing error:", error)
    throw new Error("Failed to extract text from PDF")
  }
}

/**
 * Extract invoice data from PDF document using OpenAI
 * @param documentUrl - Data URL or file path of the PDF/image document
 * @param userApiKey - User's OpenAI API key (optional, will use server key if not provided)
 * @param invoiceType - Type of invoice: "income" or "expense"
 * @returns Extracted structured invoice data with confidence scores
 */
export async function extractDataFromPDF(
  documentUrl: string,
  userApiKey: string = "",
  invoiceType: "income" | "expense" = "income"
): Promise<ExtractedInvoiceData> {
  // Use server API key first, fallback to user key, then error
  const apiKey = process.env.OPENAI_API_KEY || userApiKey

  if (!apiKey) {
    throw new Error("OpenAI API key is required. Set OPENAI_API_KEY environment variable.")
  }

  if (!documentUrl) {
    throw new Error("Document URL is required")
  }

  try {
    let documentText = ""
    let contentArray: any[] = []

    // Check if it's a base64 data URL
    if (documentUrl.startsWith("data:")) {
      const [header, data] = documentUrl.split(",")
      const isBinary = header.includes("application/pdf") || header.includes("octet-stream")

      if (isBinary) {
        // It's a PDF - extract text
        const buffer = Buffer.from(data, "base64")
        documentText = await extractTextFromPDF(buffer)
        contentArray = [
          {
            type: "text",
            text: `Aquí está el contenido extraído del PDF:\n\n${documentText}`,
          },
        ]
      } else {
        // It's an image - use vision API
        contentArray = [
          {
            type: "image_url" as const,
            image_url: { url: documentUrl },
          },
        ]
      }
    } else {
      // Assume it's a URL
      contentArray = [
        {
          type: "image_url" as const,
          image_url: { url: documentUrl },
        },
      ]
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

    contentArray.push({
      type: "text",
      text: prompt,
    })

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: contentArray,
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
