/* eslint-disable @typescript-eslint/no-explicit-any */
"use server"

import { createClient } from "@/lib/supabase/server"

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

const FALLBACK_RATES: Record<string, number> = {
  USD: 1,
  COP: 4150,
  MXN: 17,
  BRL: 5,
  EUR: 0.92,
  PEN: 3.7,
}

/**
 * Get exchange rate for a specific currency on a specific date.
 * Checks Supabase cache first, then fetches from external API.
 * Works for ALL supported currencies (COP, MXN, BRL, EUR, PEN).
 */
export async function getExchangeRateForDate(
  currency: string = "COP",
  date: string = new Date().toISOString().split("T")[0]
): Promise<number> {
  if (currency === "USD") return 1

  const supabase = await createClient()
  const pair = CURRENCY_TO_PAIR[currency]

  // 1. Try cache in trm_rates
  if (pair) {
    const { data: cached } = await supabase
      .from("trm_rates")
      .select("tasa_cierre")
      .eq("par", pair as any)
      .eq("fecha", date)
      .single()

    if (cached) {
      return Number((cached as any).tasa_cierre)
    }
  }

  // 2. Fetch from external API
  try {
    const res = await fetch(
      `https://api.exchangerate-api.com/v4/latest/USD`,
      { headers: { Accept: "application/json" } }
    )

    if (res.ok) {
      const data = await res.json()
      const rate = data.rates?.[currency]

      if (rate && pair) {
        // Cache the rate
        await (supabase as any)
          .from("trm_rates")
          .upsert(
            [{ par: pair, fecha: date, tasa_cierre: rate }],
            { onConflict: "par,fecha" }
          )
        return rate
      }
    }
  } catch (error) {
    console.warn("Error fetching exchange rate from API:", error)
  }

  // 3. Fallback
  return FALLBACK_RATES[currency] || 1
}

/**
 * Convert amount from any currency to USD using real exchange rates.
 * Fetches the rate for the given date from cache or external API.
 */
export async function convertToUSD(
  amount: number,
  currency: string,
  date: string // YYYY-MM-DD
): Promise<{
  amountUSD: number
  exchangeRate: number
  currency: string
  date: string
}> {
  if (currency === "USD") {
    return { amountUSD: amount, exchangeRate: 1, currency, date }
  }

  const rate = await getExchangeRateForDate(currency, date)
  return {
    amountUSD: rate > 0 ? Math.round((amount / rate) * 100) / 100 : 0,
    exchangeRate: rate,
    currency,
    date,
  }
}

/**
 * Convert from USD to any local currency using real exchange rates.
 */
export async function convertFromUSD(
  amountUSD: number,
  targetCurrency: string,
  date: string // YYYY-MM-DD
): Promise<{
  amountLocal: number
  exchangeRate: number
  sourceCurrency: string
  targetCurrency: string
  date: string
}> {
  if (targetCurrency === "USD") {
    return {
      amountLocal: amountUSD,
      exchangeRate: 1,
      sourceCurrency: "USD",
      targetCurrency,
      date,
    }
  }

  const rate = await getExchangeRateForDate(targetCurrency, date)
  return {
    amountLocal: Math.round(amountUSD * rate * 100) / 100,
    exchangeRate: rate,
    sourceCurrency: "USD",
    targetCurrency,
    date,
  }
}

/**
 * Save exchange rate for a specific currency pair and date.
 * Uses upsert to handle both insert and update.
 */
export async function saveTRMRate(
  fecha: string, // YYYY-MM-DD
  tasa: number,
  currency: string = "COP"
) {
  const supabase = await createClient()
  const pair = CURRENCY_TO_PAIR[currency]

  if (!pair) {
    throw new Error(`Unsupported currency: ${currency}`)
  }

  const { data, error } = await supabase
    .from("trm_rates")
    .upsert(
      [{ par: pair as any, fecha, tasa_cierre: tasa }],
      { onConflict: "par,fecha" }
    )
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to save exchange rate: ${error.message}`)
  }

  return data
}

/**
 * Get all exchange rates for a currency in a date range
 */
export async function getTRMRatesForRange(
  startDate: string,
  endDate: string,
  currency: string = "COP"
) {
  const supabase = await createClient()
  const pair = CURRENCY_TO_PAIR[currency] || "USDCOP"

  const { data, error } = await supabase
    .from("trm_rates")
    .select("*")
    .eq("par", pair as any)
    .gte("fecha", startDate)
    .lte("fecha", endDate)
    .order("fecha", { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch TRM rates: ${error.message}`)
  }

  return data
}

/**
 * Calculate average exchange rate for a currency in a date range
 */
export async function getAverageTRMForRange(
  startDate: string,
  endDate: string,
  currency: string = "COP"
): Promise<number> {
  const rates = await getTRMRatesForRange(startDate, endDate, currency)

  if (rates.length === 0) {
    return await getExchangeRateForDate(currency, startDate)
  }

  const sum = rates.reduce((acc, rate) => acc + Number(rate.tasa_cierre), 0)
  return sum / rates.length
}

/**
 * Format currency for display
 */
export async function formatCurrency(
  amount: number,
  currency: string,
  locale: string = "es-ES"
): Promise<string> {
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })

  return formatter.format(amount)
}

/**
 * Display amount in both currencies
 */
export async function displayDualCurrency(
  amountUSD: number,
  localCurrency: string,
  date: string,
  locale: string = "es-ES"
): Promise<string> {
  if (localCurrency === "USD") {
    return await formatCurrency(amountUSD, "USD", locale)
  }

  const converted = await convertFromUSD(amountUSD, localCurrency, date)
  const usdFormatted = await formatCurrency(amountUSD, "USD", locale)
  const localFormatted = await formatCurrency(converted.amountLocal, localCurrency, locale)

  return `${usdFormatted} (${localFormatted})`
}
