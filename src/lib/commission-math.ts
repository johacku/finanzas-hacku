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

export type CanalOrigen = 'hacku' | 'hunter'
export type TipoNegocio = 'recurrente' | 'one_time'

export interface CommissionRateContext {
  /** Whether the invoice is flagged as a brand-new client (nuevo negocio). */
  esClienteNuevo: boolean
  /** Acquisition channel — decides the "nuevo negocio" rate. */
  canalOrigen?: CanalOrigen | null
  /** Business type of the item (recurring vs one-time). Defaults to recurrente. */
  tipoNegocio?: TipoNegocio | null
  /** Number of months the invoice spans (6+ bumps the recurring rate). */
  mesesFacturados?: number | null
  /** One-time project managed by the hunter → +3%. */
  proyectoCortoHunter?: boolean | null
  /** Item price, for the price/ARPU-tier fallback. */
  precio?: number
  /** Currency for the price-tier fallback. */
  moneda?: string
  /** Configured price ranges for the fallback path. */
  ranges?: CommissionRange[] | null
}

export interface ResolvedCommissionRate {
  /** The resolved commission percentage (0–100). */
  porcentaje: number
  /** Human-readable rule that produced the rate (for auditing). */
  regla: string
}

/**
 * Single source of truth for the commission percentage of one invoice item.
 *
 * Precedence (see specs/001-comisiones-por-origen, ADR-1):
 *   1. Cliente nuevo + recurrente → tasa por canal (hacku 20% / hunter 25%),
 *      con bump a 30/35 si mesesFacturados >= 6.
 *   2. Cliente nuevo + one-time → hacku 10% / hunter 15%, +3% si proyecto
 *      corto gestionado por el hunter.
 *   3. Cualquier otro caso (cliente existente, o cliente nuevo sin canal) →
 *      lógica de rangos por precio/ARPU existente (sin cambios).
 *
 * The rate is ALWAYS resolved server-side from these flags; the frontend's
 * percentage is never trusted (FR-015).
 */
export function resolveCommissionRate(ctx: CommissionRateContext): ResolvedCommissionRate {
  const tipo: TipoNegocio = ctx.tipoNegocio === 'one_time' ? 'one_time' : 'recurrente'

  const fallback = (extra?: string): ResolvedCommissionRate => {
    const basePct = commissionPercentForPrice(ctx.ranges, ctx.precio ?? 0, ctx.moneda)
    // FIX #5: Restaura el bump de 6+ meses para clientes existentes.
    // La lógica previa a 043 bumpeaba +10 cuando meses_causados>=6 && rangoPct>=20.
    // Sólo aplica en el path de fallback (cliente existente o sin canal) para
    // negocio recurrente; no afecta la rama de cliente-nuevo que ya tiene su bump.
    const tipo: TipoNegocio = ctx.tipoNegocio === 'one_time' ? 'one_time' : 'recurrente'
    const meses = ctx.mesesFacturados ?? 0
    const aplicaBump = tipo === 'recurrente' && meses >= 6 && basePct >= 20
    const porcentaje = aplicaBump ? basePct + 10 : basePct
    const sufijoBump = aplicaBump ? ' · 6+ meses (+10%)' : ''
    return {
      porcentaje,
      regla: extra
        ? `${extra} → rango por precio (${ctx.moneda || 'COP'})${sufijoBump}`
        : `Cliente existente → rango por precio (${ctx.moneda || 'COP'})${sufijoBump}`,
    }
  }

  // Not a new client → keep the existing price/ARPU tier logic untouched.
  if (!ctx.esClienteNuevo) return fallback()

  // New client but no channel selected → cannot resolve an origin rate; fall
  // back to ranges rather than inventing one.
  if (ctx.canalOrigen !== 'hacku' && ctx.canalOrigen !== 'hunter') {
    return fallback('Cliente nuevo sin canal')
  }

  const canalLabel = ctx.canalOrigen === 'hacku' ? 'hackÜ' : 'Hunter'

  if (tipo === 'one_time') {
    const base = ctx.canalOrigen === 'hacku' ? 10 : 15
    const bonus = ctx.proyectoCortoHunter ? 3 : 0
    const reglaBonus = bonus ? ' + 3% proyecto corto Hunter' : ''
    return {
      porcentaje: base + bonus,
      regla: `Cliente nuevo · ${canalLabel} · one-time${reglaBonus} → ${base + bonus}%`,
    }
  }

  // Recurrente
  const seisMeses = (ctx.mesesFacturados ?? 0) >= 6
  const base = ctx.canalOrigen === 'hacku' ? 20 : 25
  const porcentaje = seisMeses ? base + 10 : base
  const reglaMeses = seisMeses ? ' · 6+ meses' : ''
  return {
    porcentaje,
    regla: `Cliente nuevo · ${canalLabel} · recurrente${reglaMeses} → ${porcentaje}%`,
  }
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

/** Round a monetary value to 2 decimals (half-up on the cent). */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export interface SplitParticipant {
  beneficiario_nombre: string
  rol: string
  /** Share (0–100) of the item's single commission that goes to this person. */
  share: number
}

export interface SplitResult extends SplitParticipant {
  monto_comision_local: number
  monto_comision_usd: number
}

/**
 * True when the participants' shares add up to 100 (within a tiny tolerance).
 *
 * The share is a REPARTO proportion of the item's single commission — not a
 * commission rate. Two people at 50/50 split one 5% commission (2.5% each),
 * they do NOT each earn 5%. The full commission is always distributed, so the
 * shares must sum to exactly 100%.
 */
export function sharesSumTo100(participants: Array<{ share?: number }>): boolean {
  if (!participants || participants.length === 0) return false
  const total = participants.reduce((acc, p) => acc + (Number(p.share) || 0), 0)
  return Math.abs(total - 100) < 0.01
}

/**
 * Split ONE item commission (already resolved: subtotal × item rate) among its
 * participants by their reparto shares. The item's commission is the same
 * regardless of how many people split it; only the distribution changes.
 *
 *   monto_participante = comisiónTotal × (share / 100)
 *
 * Rounding (spec 003, ADR-4): each amount is rounded to 2 decimals and the
 * leftover cents (comisiónTotal − Σ montos) are assigned to the LAST participant
 * so the distributed amounts sum EXACTLY to the item commission — no drift.
 *
 * Callers MUST validate `sharesSumTo100` first; this function trusts the shares
 * and does not renormalise them.
 */
export function splitItemCommission(
  comisionLocal: number,
  comisionUsd: number,
  participants: SplitParticipant[]
): SplitResult[] {
  if (!participants || participants.length === 0) return []

  const results: SplitResult[] = participants.map((p) => ({
    ...p,
    monto_comision_local: round2(comisionLocal * ((Number(p.share) || 0) / 100)),
    monto_comision_usd: round2(comisionUsd * ((Number(p.share) || 0) / 100)),
  }))

  // Assign the rounding residue to the last participant so the parts sum
  // exactly to the item's total commission (avoids ±cent drift on odd splits).
  const last = results[results.length - 1]
  const sumLocal = results.reduce((a, r) => a + r.monto_comision_local, 0)
  const sumUsd = results.reduce((a, r) => a + r.monto_comision_usd, 0)
  last.monto_comision_local = round2(last.monto_comision_local + (round2(comisionLocal) - sumLocal))
  last.monto_comision_usd = round2(last.monto_comision_usd + (round2(comisionUsd) - sumUsd))

  return results
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
