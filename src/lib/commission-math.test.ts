import { describe, it, expect } from 'vitest'
import {
  commissionPercentForPrice,
  recurringAmountUsd,
  sanitizePostgrestValue,
  DEFAULT_COMMISSION_PERCENT,
  type CommissionRange,
} from './commission-math'
import { convertToUSD } from './currency'

describe('commissionPercentForPrice — tier fallthrough (BUG 3)', () => {
  const ranges: CommissionRange[] = [
    { precio_desde: 1_000_000, precio_hasta: 2_000_000, porcentaje_comision: 5 },
    { precio_desde: 2_000_000, precio_hasta: null, porcentaje_comision: 15 },
  ]

  it('returns the matching tier for a price inside a range', () => {
    expect(commissionPercentForPrice(ranges, 1_500_000)).toBe(5)
  })

  it('returns the open-ended top tier for a large price', () => {
    expect(commissionPercentForPrice(ranges, 9_000_000)).toBe(15)
  })

  it('returns 0 (NOT the highest tier) for a price below the lowest range', () => {
    // The bug returned sorted[last].porcentaje_comision (15%) here.
    expect(commissionPercentForPrice(ranges, 50_000)).toBe(0)
  })

  it('handles the exact lower boundary inclusively', () => {
    expect(commissionPercentForPrice(ranges, 1_000_000)).toBe(5)
  })

  it('handles the exact upper boundary inclusively', () => {
    expect(commissionPercentForPrice(ranges, 2_000_000)).toBe(5)
  })

  it('returns the default when there are no ranges', () => {
    expect(commissionPercentForPrice([], 1_500_000)).toBe(DEFAULT_COMMISSION_PERCENT)
    expect(commissionPercentForPrice(undefined, 1_500_000)).toBe(DEFAULT_COMMISSION_PERCENT)
  })
})

describe('commissionPercentForPrice — currency filtering (BUG 2)', () => {
  const mixed: CommissionRange[] = [
    { precio_desde: 100, precio_hasta: 1000, porcentaje_comision: 10, moneda: 'USD' },
    { precio_desde: 1_000_000, precio_hasta: null, porcentaje_comision: 3, moneda: 'COP' },
  ]

  it('picks the USD tier for a USD-priced item, ignoring COP thresholds', () => {
    // A $500 item must match the USD range (10%), not fall into COP logic.
    expect(commissionPercentForPrice(mixed, 500, 'USD')).toBe(10)
  })

  it('picks the COP tier for a COP-priced item', () => {
    expect(commissionPercentForPrice(mixed, 4_000_000, 'COP')).toBe(3)
  })

  it('falls back to all ranges when no range matches the requested currency', () => {
    // No BRL ranges exist → fall back to all ranges; 500 matches the USD tier's window.
    expect(commissionPercentForPrice(mixed, 500, 'BRL')).toBe(10)
  })

  it('treats a range without moneda as COP', () => {
    const ranges: CommissionRange[] = [
      { precio_desde: 1_000_000, precio_hasta: null, porcentaje_comision: 7 },
    ]
    expect(commissionPercentForPrice(ranges, 2_000_000, 'COP')).toBe(7)
  })
})

describe('recurringAmountUsd — recurring commission base (BUG 1)', () => {
  it('converts ONLY monto_recurrente using the implied invoice rate', () => {
    // total_usd=3000 for total_moneda_local=12,000,000 → implied rate 4000 COP/USD.
    // monto_recurrente=4,000,000 COP → 1000 USD (NOT 3000, the full total_usd).
    const inv = { total_usd: 3000, total_moneda_local: 12_000_000, monto_recurrente: 4_000_000 }
    expect(recurringAmountUsd(inv)).toBeCloseTo(1000, 6)
  })

  it('yields a 1% commission far below 1% of the full total (regression guard)', () => {
    const inv = { total_usd: 3000, total_moneda_local: 12_000_000, monto_recurrente: 4_000_000 }
    const comision = recurringAmountUsd(inv) * 0.01
    expect(comision).toBeCloseTo(10, 6) // was 30 (3000*0.01) with the bug
  })

  it('returns 0 when total_usd is missing (cannot derive a rate)', () => {
    expect(recurringAmountUsd({ total_usd: null, total_moneda_local: 12_000_000, monto_recurrente: 4_000_000 })).toBe(0)
  })

  it('returns 0 when there is no recurring portion', () => {
    expect(recurringAmountUsd({ total_usd: 3000, total_moneda_local: 12_000_000, monto_recurrente: 0 })).toBe(0)
  })

  it('does not divide by zero when total_moneda_local is 0', () => {
    expect(recurringAmountUsd({ total_usd: 3000, total_moneda_local: 0, monto_recurrente: 4_000_000 })).toBe(0)
  })
})

describe('convertToUSD — cashflow must not mix currencies (BUG A)', () => {
  it('converts COP to USD with fallback rate (~4150), not passing raw COP through', () => {
    const usd = convertToUSD(4_150_000, 'COP', {})
    expect(usd).toBeCloseTo(1000, 6)
    expect(usd).not.toBe(4_150_000)
  })

  it('returns USD unchanged', () => {
    expect(convertToUSD(1000, 'USD', {})).toBe(1000)
  })

  it('uses a live rate when provided instead of the fallback', () => {
    expect(convertToUSD(4000, 'COP', { USDCOP: 4000 })).toBe(1)
  })

  it('returns null for an unknown currency (caller must treat as 0, not raw)', () => {
    expect(convertToUSD(1000, 'XYZ', {})).toBeNull()
  })
})

describe('sanitizePostgrestValue — filter injection (BUG C)', () => {
  it('strips commas that would inject extra OR clauses', () => {
    expect(sanitizePostgrestValue('acme,id.eq.1')).not.toContain(',')
  })

  it('strips parentheses and PostgREST wildcards/quotes', () => {
    const out = sanitizePostgrestValue('a(b)c%d"e\\f')
    expect(out).not.toMatch(/[,()\\%"]/)
  })

  it('leaves a normal search term usable', () => {
    expect(sanitizePostgrestValue('Acme SAS')).toBe('Acme SAS')
  })

  it('also strips braces when includeBraces is set (for .cs.{...} clauses)', () => {
    const out = sanitizePostgrestValue('x"}malicious{', true)
    expect(out).not.toMatch(/[{}"]/)
  })

  it('does NOT strip braces by default', () => {
    // Default mode keeps braces (only the .cs clause needs them removed).
    expect(sanitizePostgrestValue('a{b}')).toBe('a{b}')
  })
})
