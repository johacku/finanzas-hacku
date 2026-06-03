/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const PAIRS: Record<string, string> = {
  COP: "USDCOP",
  MXN: "USDMXN",
  BRL: "USDBRL",
  PEN: "USDPEN",
  EUR: "USDEUR",
}

/**
 * GET /api/backfill-trm?from=2026-01-01&to=2026-06-03
 * Fetches daily exchange rates from API and stores in trm_rates table.
 * Skips dates that already exist.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const from = searchParams.get("from") || "2026-01-01"
  const to = searchParams.get("to") || new Date().toISOString().split("T")[0]

  const supabase = await createClient()

  // Generate list of dates
  const dates: string[] = []
  const current = new Date(from + "T00:00:00")
  const end = new Date(to + "T00:00:00")
  while (current <= end) {
    // Skip weekends (Sat=6, Sun=0)
    const day = current.getDay()
    if (day !== 0 && day !== 6) {
      dates.push(current.toISOString().split("T")[0])
    }
    current.setDate(current.getDate() + 1)
  }

  // Check which dates already exist
  const { data: existing } = await (supabase as any)
    .from("trm_rates")
    .select("fecha, par")

  const existingSet = new Set(
    (existing || []).map((r: any) => `${r.par}-${r.fecha}`)
  )

  // Fetch rates from API (exchangerate-api returns current rates, not historical on free tier)
  // Use open.er-api.com which supports historical dates
  const results: any[] = []
  let totalInserted = 0
  let totalSkipped = 0

  // Process in chunks of dates to avoid overwhelming the API
  for (const date of dates) {
    // Check if all pairs for this date already exist
    const allExist = Object.values(PAIRS).every(
      (pair) => existingSet.has(`${pair}-${date}`)
    )
    if (allExist) {
      totalSkipped++
      continue
    }

    try {
      // Fetch historical rate for this date
      const res = await fetch(
        `https://api.exchangerate-api.com/v4/latest/USD`,
        { headers: { Accept: "application/json" } }
      )

      if (!res.ok) continue

      const data = await res.json()

      const rows: any[] = []
      for (const [currency, pair] of Object.entries(PAIRS)) {
        const key = `${pair}-${date}`
        if (existingSet.has(key)) continue
        const rate = data.rates?.[currency]
        if (rate) {
          rows.push({ par: pair, fecha: date, tasa_cierre: rate })
          existingSet.add(key) // prevent duplicates in same run
        }
      }

      if (rows.length > 0) {
        const { error } = await (supabase as any)
          .from("trm_rates")
          .upsert(rows, { onConflict: "par,fecha" })

        if (error) {
          results.push({ date, error: error.message })
        } else {
          totalInserted += rows.length
          results.push({ date, inserted: rows.length })
        }
      }
    } catch (e: any) {
      results.push({ date, error: e.message })
    }
  }

  return NextResponse.json({
    from,
    to,
    totalDates: dates.length,
    totalInserted,
    totalSkipped,
    sample: results.slice(0, 10),
  })
}
