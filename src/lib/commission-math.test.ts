import { describe, it, expect } from 'vitest'
import {
  commissionPercentForPrice,
  recurringAmountUsd,
  resolveCommissionRate,
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

describe('resolveCommissionRate — comisiones por origen del negocio', () => {
  // Fallback ranges used when the invoice is NOT a "cliente nuevo".
  const ranges: CommissionRange[] = [
    { precio_desde: 0, precio_hasta: 5_000, porcentaje_comision: 4 },
    { precio_desde: 5_000, precio_hasta: 9_000, porcentaje_comision: 4.5 },
    { precio_desde: 9_000, precio_hasta: null, porcentaje_comision: 5 },
  ]

  describe('cliente existente (es_cliente_nuevo=false) → rangos por precio/ARPU', () => {
    it('usa el rango por precio, ignorando canal_origen', () => {
      const r = resolveCommissionRate({
        esClienteNuevo: false,
        tipoNegocio: 'recurrente',
        precio: 10_000,
        ranges,
      })
      expect(r.porcentaje).toBe(5)
      expect(r.regla).toMatch(/rango/i)
    })

    it('cae al DEFAULT cuando no hay rangos configurados', () => {
      const r = resolveCommissionRate({
        esClienteNuevo: false,
        tipoNegocio: 'recurrente',
        precio: 10_000,
        ranges: [],
      })
      expect(r.porcentaje).toBe(DEFAULT_COMMISSION_PERCENT)
    })
  })

  describe('cliente nuevo · negocio recurrente (licencias, planes, retos IA)', () => {
    it('canal hackÜ → 20%', () => {
      const r = resolveCommissionRate({
        esClienteNuevo: true,
        canalOrigen: 'hacku',
        tipoNegocio: 'recurrente',
        precio: 10_000,
        ranges,
      })
      expect(r.porcentaje).toBe(20)
    })

    it('canal hunter → 25%', () => {
      const r = resolveCommissionRate({
        esClienteNuevo: true,
        canalOrigen: 'hunter',
        tipoNegocio: 'recurrente',
        precio: 10_000,
        ranges,
      })
      expect(r.porcentaje).toBe(25)
    })

    it('6+ meses, canal hackÜ → 30%', () => {
      const r = resolveCommissionRate({
        esClienteNuevo: true,
        canalOrigen: 'hacku',
        tipoNegocio: 'recurrente',
        mesesFacturados: 6,
        precio: 10_000,
        ranges,
      })
      expect(r.porcentaje).toBe(30)
    })

    it('6+ meses, canal hunter → 35%', () => {
      const r = resolveCommissionRate({
        esClienteNuevo: true,
        canalOrigen: 'hunter',
        tipoNegocio: 'recurrente',
        mesesFacturados: 12,
        precio: 10_000,
        ranges,
      })
      expect(r.porcentaje).toBe(35)
    })

    it('meses < 6 usa la tasa base (sin bump)', () => {
      const r = resolveCommissionRate({
        esClienteNuevo: true,
        canalOrigen: 'hunter',
        tipoNegocio: 'recurrente',
        mesesFacturados: 5,
        precio: 10_000,
        ranges,
      })
      expect(r.porcentaje).toBe(25)
    })
  })

  describe('cliente nuevo · negocio one-time', () => {
    it('canal hackÜ → 10%', () => {
      const r = resolveCommissionRate({
        esClienteNuevo: true,
        canalOrigen: 'hacku',
        tipoNegocio: 'one_time',
        precio: 10_000,
        ranges,
      })
      expect(r.porcentaje).toBe(10)
    })

    it('canal hunter → 15%', () => {
      const r = resolveCommissionRate({
        esClienteNuevo: true,
        canalOrigen: 'hunter',
        tipoNegocio: 'one_time',
        precio: 10_000,
        ranges,
      })
      expect(r.porcentaje).toBe(15)
    })

    it('proyecto corto gestionado por hunter → +3% en ambos canales', () => {
      const hacku = resolveCommissionRate({
        esClienteNuevo: true,
        canalOrigen: 'hacku',
        tipoNegocio: 'one_time',
        proyectoCortoHunter: true,
        precio: 10_000,
        ranges,
      })
      const hunter = resolveCommissionRate({
        esClienteNuevo: true,
        canalOrigen: 'hunter',
        tipoNegocio: 'one_time',
        proyectoCortoHunter: true,
        precio: 10_000,
        ranges,
      })
      expect(hacku.porcentaje).toBe(13)
      expect(hunter.porcentaje).toBe(18)
    })

    it('el bump de 6+ meses NO aplica a one-time', () => {
      const r = resolveCommissionRate({
        esClienteNuevo: true,
        canalOrigen: 'hunter',
        tipoNegocio: 'one_time',
        mesesFacturados: 12,
        precio: 10_000,
        ranges,
      })
      expect(r.porcentaje).toBe(15)
    })
  })

  describe('cliente existente · bump de 6+ meses (FIX #5)', () => {
    // El viejo código bumpeaba +10 cuando meses_causados>=6 && rangoPct>=20.
    // resolveCommissionRate debe restaurar ese comportamiento en el fallback.
    const rangesAltos: CommissionRange[] = [
      { precio_desde: 0, precio_hasta: null, porcentaje_comision: 20 },
    ]
    const rangesBajos: CommissionRange[] = [
      { precio_desde: 0, precio_hasta: null, porcentaje_comision: 5 },
    ]

    it('cliente existente · 20% en rangos · 6+ meses → 30%', () => {
      const r = resolveCommissionRate({
        esClienteNuevo: false,
        tipoNegocio: 'recurrente',
        mesesFacturados: 6,
        precio: 10_000,
        ranges: rangesAltos,
      })
      expect(r.porcentaje).toBe(30)
      expect(r.regla).toMatch(/6\+\s*meses/i)
    })

    it('cliente existente · 5% en rangos · 6+ meses → NO hace bump (base < 20)', () => {
      const r = resolveCommissionRate({
        esClienteNuevo: false,
        tipoNegocio: 'recurrente',
        mesesFacturados: 6,
        precio: 10_000,
        ranges: rangesBajos,
      })
      expect(r.porcentaje).toBe(5)
    })

    it('cliente existente · 20% en rangos · 5 meses → NO hace bump (meses < 6)', () => {
      const r = resolveCommissionRate({
        esClienteNuevo: false,
        tipoNegocio: 'recurrente',
        mesesFacturados: 5,
        precio: 10_000,
        ranges: rangesAltos,
      })
      expect(r.porcentaje).toBe(20)
    })

    it('one-time con 6+ meses · NO hace bump (bump es solo para recurrente)', () => {
      const r = resolveCommissionRate({
        esClienteNuevo: false,
        tipoNegocio: 'one_time',
        mesesFacturados: 12,
        precio: 10_000,
        ranges: rangesAltos,
      })
      expect(r.porcentaje).toBe(20)
    })
  })

  describe('validación / edge cases', () => {
    it('cliente nuevo sin canal → cae a rangos (no inventa tasa de origen)', () => {
      const r = resolveCommissionRate({
        esClienteNuevo: true,
        tipoNegocio: 'recurrente',
        precio: 10_000,
        ranges,
      })
      expect(r.porcentaje).toBe(5)
      expect(r.regla).toMatch(/rango|sin canal/i)
    })

    it('siempre devuelve una regla legible para auditar', () => {
      const r = resolveCommissionRate({
        esClienteNuevo: true,
        canalOrigen: 'hunter',
        tipoNegocio: 'recurrente',
        mesesFacturados: 6,
        precio: 10_000,
        ranges,
      })
      expect(typeof r.regla).toBe('string')
      expect(r.regla.length).toBeGreaterThan(0)
    })
  })
})
