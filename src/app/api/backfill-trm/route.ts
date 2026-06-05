/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/** Currency pairs we track: lowercase keys match the fawazahmed0 API response */
const CURRENCY_KEYS: Record<string, string> = {
  cop: "USDCOP",
  mxn: "USDMXN",
  brl: "USDBRL",
  pen: "USDPEN",
  eur: "USDEUR",
}

const PAIR_COUNT = Object.keys(CURRENCY_KEYS).length // 5

/** Small delay to avoid rate-limiting the CDN */
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * GET /api/backfill-trm?from=2026-01-01&to=2026-06-05&batch=30
 *
 * Fetches historical exchange rates from fawazahmed0/currency-api and stores
 * them in the trm_rates table. Processes at most `batch` dates per request
 * (default 30) to stay within Vercel Hobby 10s timeout.
 *
 * Returns { from, to, processed, inserted, nextFrom? } so the caller can
 * keep calling with from=nextFrom until backfill is complete.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const from = searchParams.get("from") || "2026-01-01"
  const to = searchParams.get("to") || new Date().toISOString().split("T")[0]
  const batchSize = Math.min(Number(searchParams.get("batch") || "30"), 60)

  const supabase = await createClient()

  // 1. Generate all weekday dates in the range
  const allDates: string[] = []
  const current = new Date(from + "T12:00:00Z")
  const end = new Date(to + "T12:00:00Z")
  while (current <= end) {
    const day = current.getUTCDay()
    if (day !== 0 && day !== 6) {
      allDates.push(current.toISOString().split("T")[0])
    }
    current.setUTCDate(current.getUTCDate() + 1)
  }

  if (allDates.length === 0) {
    return NextResponse.json({ from, to, processed: 0, inserted: 0 })
  }

  // 2. Find dates that already have ALL 5 pairs in trm_rates
  const { data: existing } = await (supabase as any)
    .from("trm_rates")
    .select("fecha, par")
    .in("fecha", allDates)

  // Count how many pairs each date has
  const dateCount: Record<string, number> = {}
  for (const row of existing || []) {
    dateCount[row.fecha] = (dateCount[row.fecha] || 0) + 1
  }

  // Build set for fast per-pair lookup
  const existingSet = new Set(
    (existing || []).map((r: any) => `${r.par}-${r.fecha}`)
  )

  // 3. Filter to dates that are missing at least one pair
  const missingDates = allDates.filter(
    (d) => (dateCount[d] || 0) < PAIR_COUNT
  )

  // 4. Take only batchSize dates
  const datesToProcess = missingDates.slice(0, batchSize)

  let totalInserted = 0
  const errors: Array<{ date: string; error: string }> = []

  for (const date of datesToProcess) {
    try {
      // Fetch historical rate for this specific date
      const url = `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${date}/v1/currencies/usd.json`
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
      })

      if (!res.ok) {
        errors.push({ date, error: `API returned ${res.status}` })
        continue
      }

      const data = await res.json()
      const rates = data?.usd
      if (!rates) {
        errors.push({ date, error: "No usd rates in response" })
        continue
      }

      // Build rows for currencies we don't already have
      const rows: Array<{ par: string; fecha: string; tasa_cierre: number }> = []
      for (const [currency, pair] of Object.entries(CURRENCY_KEYS)) {
        if (existingSet.has(`${pair}-${date}`)) continue
        const rate = rates[currency]
        if (rate != null) {
          rows.push({ par: pair, fecha: date, tasa_cierre: rate })
        }
      }

      if (rows.length > 0) {
        const { error } = await (supabase as any)
          .from("trm_rates")
          .upsert(rows, { onConflict: "par,fecha" })

        if (error) {
          errors.push({ date, error: error.message })
        } else {
          totalInserted += rows.length
        }
      }

      // Small delay between API calls to be polite to the CDN
      await sleep(100)
    } catch (e: any) {
      errors.push({ date, error: e.message })
    }
  }

  // 5. Calculate nextFrom if there are more dates to process
  let nextFrom: string | undefined
  if (missingDates.length > batchSize) {
    // Next batch starts at the first unprocessed missing date
    nextFrom = missingDates[batchSize]
  }

  return NextResponse.json({
    from,
    to,
    processed: datesToProcess.length,
    inserted: totalInserted,
    ...(nextFrom ? { nextFrom } : {}),
    ...(errors.length > 0 ? { errors } : {}),
  })
}
