import { NextRequest, NextResponse } from "next/server"
import { extractDataFromPDF } from "@/lib/ai-processor"

/**
 * POST /api/invoice-processor
 *
 * Process invoice PDF with OpenAI Vision
 * Expects: { documentUrl, invoiceType, userApiKey }
 * Returns: { success, extracted_data, warnings }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { documentUrl, invoiceType, userApiKey } = body

    // Validate inputs
    if (!documentUrl || !invoiceType || !userApiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: documentUrl, invoiceType, userApiKey",
        },
        { status: 400 }
      )
    }

    if (invoiceType !== "income" && invoiceType !== "expense") {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid invoiceType. Must be 'income' or 'expense'",
        },
        { status: 400 }
      )
    }

    // Rate limiting: Check user's API call count (optional)
    // Could add Redis-based rate limiting here

    // Process with OpenAI
    const extractedData = await extractDataFromPDF(
      documentUrl,
      userApiKey,
      invoiceType
    )

    return NextResponse.json(
      {
        success: true,
        extracted_data: extractedData,
        message: "Invoice processed successfully",
      },
      { status: 200 }
    )
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error"

    // Don't expose sensitive error details
    const isApiKeyError = errorMessage.includes("401") || errorMessage.includes("authentication")

    return NextResponse.json(
      {
        success: false,
        error: isApiKeyError
          ? "Invalid OpenAI API key or authentication failed"
          : "Failed to process invoice. Please try again.",
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
      },
      { status: 500 }
    )
  }
}
