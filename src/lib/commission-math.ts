/**
 * Pure, side-effect-free finance/commission helpers.
 *
 * These are extracted out of the `'use server'` action files so they can be
 * unit-tested in isolation (a `'use server'` module can only export async
 * functions and drags in `next/headers` via the Supabase server client).
 * The server actions import and wrap these.
 */

export interface CommissionRange {
  precio_desde: number
  precio_hasta: number | null
  porcentaje_comision: number
  moneda?: string
}

export const DEFAULT_COMMISSION_PERCENT = 5

/**
 * Commission % for a price given a set of tiered ranges.
 *
 * - Empty ranges → DEFAULT_COMMISSION_PERCENT (caller has no config yet).
 * - Price within a range [precio_desde, precio_hasta] → that range's %.
 *   `precio_hasta === null` means "and up".
 * - Price BELOW the lowest range's lower bound → 0 (no tier reached).
 *   (Historically this wrongly returned the HIGHEST tier's %.)
 *
 * When `moneda` is provided, only ranges of that currency are considered
 * (ranges without a `moneda` are treated as 'COP'). If no range matches the
 * currency, we fall back to all ranges rather than returning nothing.
 */
export function commissionPercentForPrice(
  ranges: CommissionRange[] | null | undefined,
  price: number,
  moneda?: string
): number {
  if (!ranges || ranges.length === 0) return DEFAULT_COMMISSION_PERCENT

  let filtered = moneda
    ? ranges.filter((r) => (r.moneda || 'COP') === moneda)
    : ranges
  if (filtered.length === 0) filtered = ranges

  const sorted = [...filtered].sort(
    (a, b) => (a.precio_desde || 0) - (b.precio_desde || 0)
  )

  for (const range of sorted) {
    const desde = range.precio_desde || 0
    const hasta = range.precio_hasta
    if (price >= desde && (hasta === null || hasta === undefined || price <= hasta)) {
      return range.porcentaje_comision
    }
  }

  // Price is below the lowest range's lower bound — no tier applies.
  return 0
}

/**
 * Convert the recurring portion of an income invoice to USD using an implied
 * rate derived from the invoice's own totals, so only `monto_recurrente`
 * (local currency) is converted — never the full invoice `total_usd`.
 *
 * Returns 0 when the totals needed to derive a rate are missing or non-positive
 * (caller should skip creating a commission in that case).
 */
export function recurringAmountUsd(inv: {
  total_usd?: number | null
  total_moneda_local?: number | null
  monto_recurrente?: number | null
}): number {
  const totalUsd = Number(inv.total_usd) || 0
  const totalLocal = Number(inv.total_moneda_local) || 0
  const recurrente = Number(inv.monto_recurrente) || 0
  if (totalUsd > 0 && totalLocal > 0 && recurrente > 0) {
    return recurrente * (totalUsd / totalLocal)
  }
  return 0
}

/**
 * Strip PostgREST-significant characters from a value before interpolating it
 * into a Supabase `.or()` / `.ilike()` filter string, preventing filter-string
 * injection. Braces/quotes are extra-dangerous inside `.cs.{"..."}` clauses, so
 * callers targeting those should pass `includeBraces = true`.
 */
export function sanitizePostgrestValue(value: string, includeBraces = false): string {
  const pattern = includeBraces ? /[,()\\%"{}]/g : /[,()\\%"]/g
  return value.replace(pattern, ' ').trim()
}
