"use server"

import { createClient } from "@/lib/supabase/server"

/**
 * Get exchange rate for a specific date
 * Fetches from /api/exchange-rates endpoint which checks cache then external API
 */
export async function getExchangeRateForDate(
  currency: string = "COP",
  date: string = new Date().toISOString().split("T")[0]
): Promise<number> {
  try {
    // Call our internal API endpoint which handles caching and external API
    const response = await fetch(
      `/api/exchange-rates?date=${date}&currency=${currency}`,
      {
        next: { revalidate: 3600 }, // Cache for 1 hour
      }
    )

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`)
    }

    const data = await response.json()

    if (!data.success) {
      throw new Error(data.error || "Failed to fetch rates")
    }

    const rates = data.rates || {}
    return rates[currency] || rates.COP || 4000
  } catch (error) {
    console.warn("Error fetching exchange rates, using fallback:", error)

    // Fallback rates
    const DEFAULT_RATES: { [key: string]: number } = {
      USD: 1,
      COP: 4000, // Approximate USD to COP
      MXN: 17, // Approximate USD to MXN
      VEF: 2500000, // Approximate USD to VEF (Bolívares)
    }

    return DEFAULT_RATES[currency] || 1
  }
}

/**
 * Convert amount from one currency to USD
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
    return {
      amountUSD: amount,
      exchangeRate: 1,
      currency,
      date,
    }
  }

  // For COP, get TRM rate from database
  if (currency === "COP") {
    const rate = await getExchangeRateForDate("COP", date)
    return {
      amountUSD: amount / rate,
      exchangeRate: rate,
      currency,
      date,
    }
  }

  // For other currencies, use fixed rates (would need API integration for real rates)
  const FIXED_RATES: { [key: string]: number } = {
    MXN: 17, // 1 USD = 17 MXN (approximate)
    VEF: 2500000, // 1 USD = 2.5M VEF (approximate - highly volatile)
  }

  const rate = FIXED_RATES[currency] || 1
  return {
    amountUSD: amount / rate,
    exchangeRate: rate,
    currency,
    date,
  }
}

/**
 * Convert from USD to local currency
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

  // For COP, get TRM rate
  if (targetCurrency === "COP") {
    const rate = await getExchangeRateForDate("COP", date)
    return {
      amountLocal: amountUSD * rate,
      exchangeRate: rate,
      sourceCurrency: "USD",
      targetCurrency,
      date,
    }
  }

  // For other currencies
  const FIXED_RATES: { [key: string]: number } = {
    MXN: 17,
    VEF: 2500000,
  }

  const rate = FIXED_RATES[targetCurrency] || 1
  return {
    amountLocal: amountUSD * rate,
    exchangeRate: rate,
    sourceCurrency: "USD",
    targetCurrency,
    date,
  }
}

/**
 * Save TRM rate for a specific date
 * Used for updating exchange rates
 */
export async function saveTRMRate(
  fecha: string, // YYYY-MM-DD
  usd_cop: number
) {
  const supabase = await createClient()

  // Check if rate exists
  const { data: existing } = await supabase
    .from("trm_rates")
    .select("id")
    .eq("fecha", fecha)
    .single()

  if (existing) {
    // Update existing
    const { data, error } = await supabase
      .from("trm_rates")
      .update({ usd_cop })
      .eq("fecha", fecha)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update TRM rate: ${error.message}`)
    }

    return data
  }

  // Create new
  const { data, error } = await supabase
    .from("trm_rates")
    .insert([{ fecha, usd_cop }])
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to save TRM rate: ${error.message}`)
  }

  return data
}

/**
 * Get all TRM rates for a date range
 */
export async function getTRMRatesForRange(
  startDate: string,
  endDate: string
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("trm_rates")
    .select("*")
    .gte("fecha", startDate)
    .lte("fecha", endDate)
    .order("fecha", { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch TRM rates: ${error.message}`)
  }

  return data
}

/**
 * Calculate average TRM for a date range
 */
export async function getAverageTRMForRange(
  startDate: string,
  endDate: string
): Promise<number> {
  const rates = await getTRMRatesForRange(startDate, endDate)

  if (rates.length === 0) {
    return await getExchangeRateForDate("COP", startDate)
  }

  const sum = rates.reduce((acc, rate) => acc + rate.usd_cop, 0)
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
