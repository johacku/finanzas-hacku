/**
 * Client-side currency conversion helper
 * Calls /api/exchange-rates to get live rates
 */

const FALLBACK_RATES: Record<string, number> = {
  USD: 1,
  COP: 4150,
  MXN: 17,
  BRL: 5,
  EUR: 0.92,
}

export interface ExchangeRateResult {
  rate: number
  amountUSD: number
  source: string
}

/**
 * Fetch the exchange rate for a currency on a given date
 */
export async function fetchExchangeRate(
  currency: string,
  date?: string
): Promise<{ rate: number; source: string }> {
  if (currency === 'USD') {
    return { rate: 1, source: 'direct' }
  }

  try {
    const dateParam = date || new Date().toISOString().split('T')[0]
    const res = await fetch(`/api/exchange-rates?date=${dateParam}&currency=${currency}`)

    if (!res.ok) throw new Error('API error')

    const data = await res.json()

    if (data.success && data.rates) {
      const rate = data.rates[currency] || FALLBACK_RATES[currency] || 1
      return { rate, source: data.source || 'api' }
    }

    throw new Error('Invalid response')
  } catch (error) {
    console.warn('Exchange rate fetch failed, using fallback:', error)
    return {
      rate: FALLBACK_RATES[currency] || 1,
      source: 'fallback',
    }
  }
}

/**
 * Convert an amount from a given currency to USD
 */
export async function convertToUSDClient(
  amount: number,
  currency: string,
  date?: string
): Promise<ExchangeRateResult> {
  if (currency === 'USD') {
    return { rate: 1, amountUSD: amount, source: 'direct' }
  }

  if (amount <= 0) {
    return { rate: 0, amountUSD: 0, source: 'zero' }
  }

  const { rate, source } = await fetchExchangeRate(currency, date)
  return {
    rate,
    amountUSD: rate > 0 ? Math.round((amount / rate) * 100) / 100 : 0,
    source,
  }
}

/**
 * Format exchange rate for display (e.g. "TRM: 1 USD = 4,150 COP")
 */
export function formatExchangeRate(rate: number, currency: string): string {
  if (currency === 'USD' || !rate || rate <= 0) return ''

  const formatted = new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(rate)

  return `TRM: 1 USD = ${formatted} ${currency}`
}
