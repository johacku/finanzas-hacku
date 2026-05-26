import type { CurrencyPair } from '@/lib/constants'

export type LatestRates = Partial<Record<CurrencyPair, number>>

const LOCALE_MAP: Record<string, string> = {
  COP: 'es-CO',
  USD: 'en-US',
  MXN: 'es-MX',
  BRL: 'pt-BR',
  EUR: 'de-DE',
}

/**
 * Format a number as currency. e.g. formatCurrency(1234567, 'COP') → "$ 1.234.567"
 */
export function formatCurrency(
  amount: number,
  currency: string,
  minimumFractionDigits = 0
): string {
  try {
    return new Intl.NumberFormat(LOCALE_MAP[currency] ?? 'en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toLocaleString()}`
  }
}

/**
 * Format a number as compact currency. e.g. formatCurrencyCompact(1234567, 'COP') → "$ 1.2M"
 */
export function formatCurrencyCompact(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(LOCALE_MAP[currency] ?? 'en-US', {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount)
  } catch {
    return `${currency} ${(amount / 1_000_000).toFixed(1)}M`
  }
}

/**
 * Convert amount in local currency to USD using TRM rates.
 * Returns null if rate is not available.
 */
export function convertToUSD(
  amount: number,
  currency: string,
  rates: LatestRates
): number | null {
  if (currency === 'USD') return amount

  const pairMap: Record<string, CurrencyPair> = {
    COP: 'USDCOP',
    MXN: 'USDMXN',
    BRL: 'USDBRL',
    PEN: 'USDPEN',
    EUR: 'USDEUR',
  }

  const pair = pairMap[currency]
  if (!pair) return null

  const rate = rates[pair]
  if (rate) return amount / rate

  // Fallback approximate rates if no cached rate available
  const fallbackRates: Record<string, number> = {
    COP: 4150,
    MXN: 17,
    BRL: 5,
    PEN: 3.7,
    EUR: 0.92,
  }
  const fallback = fallbackRates[currency]
  if (fallback) return amount / fallback

  return null
}

export function formatNumber(amount: number): string {
  return new Intl.NumberFormat('en-US').format(amount)
}
