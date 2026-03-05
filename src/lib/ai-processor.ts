/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * OpenAI Files API processor - uploads PDF directly to OpenAI and reads with GPT-4o
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

export async function extractDataFromPDF(
  documentUrl: string,
  userApiKey: string = "",
  invoiceType: "income" | "expense" = "income"
): Promise<ExtractedInvoiceData> {
  const apiKey = process.env.OPENAI_API_KEY || userApiKey
  if (!apiKey) throw new Error("OpenAI API key is required.")
  if (!documentUrl) throw new Error("Document URL is required")

  // 1. Get PDF as buffer
  let pdfBuffer: Buffer
  let filename = "invoice.pdf"

  if (documentUrl.startsWith("data:")) {
    const base64Data = documentUrl.split(",")[1]
    pdfBuffer = Buffer.from(base64Data, "base64")
  } else {
    const res = await fetch(documentUrl)
    pdfBuffer = Buffer.from(await res.arrayBuffer())
    filename = documentUrl.split("/").pop()?.split("?")[0] || "invoice.pdf"
  }

  // 2. Upload PDF to OpenAI Files API
  const formData = new FormData()
  const blob = new Blob([pdfBuffer], { type: "application/pdf" })
  formData.append("file", blob, filename)
  formData.append("purpose", "user_data")

  const uploadRes = await fetch("https://api.openai.com/v1/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  })

  if (!uploadRes.ok) {
    const err = await uploadRes.json()
    throw new Error(`OpenAI Files upload error: ${err.error?.message || "Unknown"}`)
  }

  const { id: fileId } = await uploadRes.json()

  // 3. Ask GPT-4o to read the file and return JSON
  const prompt =
    invoiceType === "income"
      ? `Analiza esta factura de ingreso y devuelve SOLO este JSON (sin markdown, sin texto adicional):
{"fecha":"YYYY-MM-DD","nombre_cliente_proveedor":"nombre del cliente","monto":0,"moneda":"USD","concepto":"descripción","numero_factura":"número","fecha_vencimiento":"YYYY-MM-DD"}`
      : `Analiza esta factura de gasto y devuelve SOLO este JSON (sin markdown, sin texto adicional):
{"fecha":"YYYY-MM-DD","nombre_cliente_proveedor":"nombre del proveedor","monto":0,"moneda":"USD","concepto":"descripción","numero_factura":"número","fecha_vencimiento":"YYYY-MM-DD"}`

  const chatRes = await fetch("https://api.openai.com/v1/chat/completions", {
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
          content: [
            { type: "file", file: { file_id: fileId } },
            { type: "text", text: prompt },
          ],
        },
      ],
      max_tokens: 1024,
    }),
  })

  // Cleanup: delete file after use (non-blocking)
  fetch(`https://api.openai.com/v1/files/${fileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${apiKey}` },
  }).catch(() => {})

  if (!chatRes.ok) {
    const err = await chatRes.json()
    throw new Error(`OpenAI API error: ${err.error?.message || "Unknown"}`)
  }

  const raw = (await chatRes.json()).choices[0]?.message?.content || ""

  // 4. Parse JSON
  let extracted: Partial<ExtractedInvoiceData> = {}
  try {
    extracted = JSON.parse(raw)
  } catch {
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) extracted = JSON.parse(match[0])
    else throw new Error("No se pudo parsear el JSON de OpenAI")
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
}

export function validateExtractedData(data: ExtractedInvoiceData): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  if (!data.nombre_cliente_proveedor) errors.push("Cliente/Proveedor no detectado")
  if (!data.monto) errors.push("Monto no detectado")
  if (!data.fecha) errors.push("Fecha no detectada")
  if (!data.moneda) errors.push("Moneda no detectada")
  return { valid: errors.length === 0, errors }
}
