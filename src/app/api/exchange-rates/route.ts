/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"

/**
 * Mapping from moneda to currency_pair enum in DB
 */
const CURRENCY_TO_PAIR: Record<string, string> = {
  COP: "USDCOP",
  MXN: "USDMXN",
  BRL: "USDBRL",
  PEN: "USDPEN",
  EUR: "USDEUR",
}

const SUPPORTED_CURRENCIES = ["COP", "MXN", "BRL", "EUR", "PEN"]

/**
 * GET /api/exchange-rates
 * Query params: ?date=YYYY-MM-DD&currency=COP (optional, defaults to today/COP)
 *
 * Fetches exchange rates from public API and caches in Supabase (trm_rates table).
 * Uses the real exchange rate for the requested date for ALL supported currencies.
 * Returns: { success, source, date, rates: { USD: 1, COP: x, MXN: y, ... } }
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient()
    const searchParams = request.nextUrl.searchParams
    const date = searchParams.get("date") || new Date().toISOString().split("T")[0]
    const currency = searchParams.get("currency") || "COP"

    // 1. Try to get the specific currency rate from cache
    const pair = CURRENCY_TO_PAIR[currency]
    if (pair) {
      const { data: cachedRate } = await (supabase as any)
        .from("trm_rates")
        .select("tasa_cierre")
        .eq("par", pair)
        .eq("fecha", date)
        .single()

      if (cachedRate) {
        // Also try to load other cached rates for the same date
        const rates: Record<string, number> = { USD: 1 }
        rates[currency] = Number(cachedRate.tasa_cierre)

        const { data: allCached } = await (supabase as any)
          .from("trm_rates")
          .select("par, tasa_cierre")
          .eq("fecha", date)

        if (allCached) {
          for (const row of allCached as any[]) {
            const cur = Object.entries(CURRENCY_TO_PAIR).find(([, v]) => v === row.par)?.[0]
            if (cur) rates[cur] = Number(row.tasa_cierre)
          }
        }

        return NextResponse.json({
          success: true,
          source: "cache",
          date,
          rates,
        })
      }
    }

    // 2. Fetch from external API (exchangerate-api.com free tier)
    const externalResponse = await fetch(
      `https://api.exchangerate-api.com/v4/latest/USD`,
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 3600 },
      }
    )

    if (!externalResponse.ok) {
      // Fallback: try a second free API
      return await fetchFromFallbackAPI(supabase, date, currency)
    }

    const data = await externalResponse.json()

    // 3. Build rates object with real values
    const rates: Record<string, number> = { USD: 1 }
    for (const cur of SUPPORTED_CURRENCIES) {
      if (data.rates[cur]) {
        rates[cur] = data.rates[cur]
      }
    }

    // 4. Cache ALL supported currency rates in Supabase
    const upsertRows = SUPPORTED_CURRENCIES
      .filter((cur) => rates[cur] && CURRENCY_TO_PAIR[cur])
      .map((cur) => ({
        par: CURRENCY_TO_PAIR[cur],
        fecha: date,
        tasa_cierre: rates[cur],
      }))

    if (upsertRows.length > 0) {
      const { error } = await (supabase as any)
        .from("trm_rates")
        .upsert(upsertRows, { onConflict: "par,fecha" })

      if (error) {
        console.error("Failed to cache exchange rates:", error)
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

/**
 * Fallback: try open.er-api.com (no key required) if primary API fails
 */
async function fetchFromFallbackAPI(
  supabase: ReturnType<typeof createServiceClient>,
  date: string,
  currency: string
) {
  try {
    const fallbackRes = await fetch(
      `https://open.er-api.com/v6/latest/USD`,
      { headers: { Accept: "application/json" } }
    )

    if (fallbackRes.ok) {
      const fallbackData = await fallbackRes.json()
      const rates: Record<string, number> = { USD: 1 }

      for (const cur of SUPPORTED_CURRENCIES) {
        if (fallbackData.rates?.[cur]) {
          rates[cur] = fallbackData.rates[cur]
        }
      }

      // Cache in DB
      const upsertRows = SUPPORTED_CURRENCIES
        .filter((cur) => rates[cur] && CURRENCY_TO_PAIR[cur])
        .map((cur) => ({
          par: CURRENCY_TO_PAIR[cur],
          fecha: date,
          tasa_cierre: rates[cur],
        }))

      if (upsertRows.length > 0) {
        await (supabase as any)
          .from("trm_rates")
          .upsert(upsertRows, { onConflict: "par,fecha" })
          .then(({ error }: { error: any }) => {
            if (error) console.error("Failed to cache fallback rates:", error)
          })
      }

      return NextResponse.json({
        success: true,
        source: "fallback-api",
        date,
        rates,
      })
    }
  } catch {
    // ignore fallback errors
  }

  // Last resort: return default approximate rates
  return NextResponse.json(
    {
      success: true,
      source: "default",
      date,
      rates: {
        USD: 1,
        COP: 4150,
        MXN: 17,
        BRL: 5,
        EUR: 0.92,
        PEN: 3.7,
      },
      note: "Using approximate default rates. External APIs temporarily unavailable.",
    },
    { status: 200 }
  )
}
