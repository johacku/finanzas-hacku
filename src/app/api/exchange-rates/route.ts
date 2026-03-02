import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * GET /api/exchange-rates
 * Query params: ?date=YYYY-MM-DD&currency=COP (optional, defaults to today/COP)
 *
 * Fetches exchange rates from public API and caches in Supabase
 * Returns: { date, rates: { [currency]: rate } }
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const searchParams = request.nextUrl.searchParams
    const date = searchParams.get("date") || new Date().toISOString().split("T")[0]
    const currency = searchParams.get("currency") || "COP"

    // Try to get from cache first
    const { data: cachedRate } = await supabase
      .from("trm_rates")
      .select("usd_cop, fecha")
      .eq("fecha", date)
      .single()

    if (cachedRate) {
      return NextResponse.json({
        success: true,
        source: "cache",
        date,
        rates: {
          USD: 1,
          COP: cachedRate.usd_cop,
          MXN: 17, // Fixed rate
          VEF: 2500000, // Fixed rate
        },
      })
    }

    // Fetch from external API (using exchangerate-api.com free tier)
    // Free tier: 1500 requests/month
    const externalResponse = await fetch(
      `https://api.exchangerate-api.com/v4/latest/USD`,
      {
        headers: {
          Accept: "application/json",
        },
        next: { revalidate: 3600 }, // Cache for 1 hour
      }
    )

    if (!externalResponse.ok) {
      // Fallback to default rates if API fails
      return NextResponse.json(
        {
          success: true,
          source: "default",
          date,
          rates: {
            USD: 1,
            COP: 4000, // Approximate fallback
            MXN: 17,
            VEF: 2500000,
          },
          note: "Using default rates. External API temporarily unavailable.",
        },
        { status: 200 }
      )
    }

    const data = await externalResponse.json()

    // Extract rates we need
    const rates = {
      USD: 1,
      COP: data.rates.COP || 4000,
      MXN: data.rates.MXN || 17,
      VEF: data.rates.VEF || 2500000,
    }

    // Cache the COP rate in Supabase for historical tracking
    if (currency === "COP" || !currency) {
      const { error } = await supabase
        .from("trm_rates")
        .upsert(
          [
            {
              fecha: date,
              usd_cop: rates.COP,
            },
          ],
          { onConflict: "fecha" }
        )

      if (error) {
        console.error("Failed to cache exchange rate:", error)
      }
    }

    return NextResponse.json({
      success: true,
      source: "external",
      date,
      rates,
    })
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error"

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch exchange rates",
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
      },
      { status: 500 }
    )
  }
}
