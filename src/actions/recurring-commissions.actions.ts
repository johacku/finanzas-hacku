/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { revalidatePath } from 'next/cache'
import { recurringAmountUsd } from '@/lib/commission-math'

/**
 * Normalize a name for robust identity comparison.
 *
 * `vendor_commissions` stores only `beneficiario_nombre` (no `vendedor_id` FK).
 * Until a UUID-based comparison is possible, we normalise both sides with:
 *   - trim whitespace
 *   - lowercase
 *   - NFD decomposition + strip combining diacritical marks (Unicode 0300–036F)
 *     to collapse "Simón" → "simon", "Sofía" → "sofia", etc.
 * This prevents false negatives caused by diacritics or leading/trailing spaces.
 *
 * Note: we use a character-class range instead of the \p{Mn} Unicode property
 * flag because the project's tsc target doesn't guarantee ES2018 regex support.
 * The range U+0300–U+036F covers all standard combining diacritical marks.
 */
function normalizeName(name: string): string {
  // eslint-disable-next-line no-misleading-character-class
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

/**
 * Generate recurring account commissions for the ORIGINATING Hunter (1% from
 * the 2nd month, in perpetuity). Should be called monthly (from a cron job).
 *
 * Logic (specs/001-comisiones-por-origen, US3/US4, ADR-3/ADR-4):
 * - The 1% is attributed to the client's `hunter_originador_id`, NOT to whoever
 *   is the invoice's vendedor. It follows the originating Hunter even after a
 *   KAM takes over the account.
 * - Only clients flagged `es_negocio_nuevo_originado = true` qualify. A Hunter
 *   billing an already-existing account (no origination) gets NO 1% (FR-009).
 * - The invoice must be recurrent (monto_recurrente > 0), older than 30 days
 *   (2nd month+), not voided, and not already commissioned this month.
 * - Same-person rule (FR-010): if the originating Hunter is the same person who
 *   is already commissioning as KAM/closer on this invoice's billing, the 1% is
 *   suppressed (the two never stack for the same person).
 *
 * Uses the service-role client to bypass RLS: this runs server-to-server from
 * the cron route (/api/cron/recurring-commissions) with no user session.
 */
export async function generateRecurringCommissions() {
  const supabase = createServiceClient()
  let created = 0

  // Clients originated as new business, with an attributed Hunter.
  // Map: hacku_cliente UUID → originating Hunter nombre (for FK join).
  // Also map by nombre (for fallback on rows where hacku_cliente_id is NULL).
  const { data: clientes } = await (supabase as any)
    .from('hacku_clientes')
    .select('id, nombre, hunter_originador_id, es_negocio_nuevo_originado, vendedores:hunter_originador_id(nombre)')
    .eq('es_negocio_nuevo_originado', true)
    .not('hunter_originador_id', 'is', null)

  if (!clientes || clientes.length === 0) return { created: 0 }

  // FIX 4: build lookup by UUID (primary) and by nombre (fallback for rows
  // backfilled before migration 045 ran, or where hacku_cliente_id is NULL).
  const originadorByClienteId: Record<string, string> = {}
  const originadorByClienteNombre: Record<string, string> = {}
  for (const c of clientes) {
    const nombreHunter = c.vendedores?.nombre
    if (!nombreHunter) continue
    if (c.id) originadorByClienteId[c.id] = nombreHunter
    if (c.nombre) originadorByClienteNombre[c.nombre] = nombreHunter
  }
  if (Object.keys(originadorByClienteId).length === 0 && Object.keys(originadorByClienteNombre).length === 0) return { created: 0 }

  // Recurrent invoices older than 30 days (2nd month+), linked to an originated client.
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const cutoff = thirtyDaysAgo.toISOString().split('T')[0]

  const { data: invoices } = await (supabase as any)
    .from('income_invoices')
    .select('id, hacku_cliente, hacku_cliente_id, monto_recurrente, total_usd, total_moneda_local, sociedad, razon_social_cliente, moneda')
    .lte('fecha_creacion', cutoff)
    .neq('estado', 'Anulada')
    .gt('monto_recurrente', 0)

  if (!invoices || invoices.length === 0) return { created: 0 }

  // Current month key for dedup
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  for (const inv of invoices) {
    // FIX 4: prefer UUID-based lookup (hacku_cliente_id FK, migration 045);
    // fall back to text-name lookup for rows not yet backfilled.
    const originador = inv.hacku_cliente_id
      ? originadorByClienteId[inv.hacku_cliente_id]
      : (inv.hacku_cliente ? originadorByClienteNombre[inv.hacku_cliente] : null)
    if (!originador) continue // excepción cuenta existente / no originado (FR-009)

    // Check if recurring commission already exists for this invoice + month
    const { data: existing } = await (supabase as any)
      .from('vendor_commissions')
      .select('id')
      .eq('income_invoice_id', inv.id)
      .eq('rol', 'recurrencia')
      .eq('cuota_mes', currentMonth)
      .limit(1)

    if (existing && existing.length > 0) continue

    // Same-person rule (FR-010): if the originating Hunter is already
    // commissioning on this invoice (e.g. acting as KAM/closer), do NOT also
    // pay the 1% — the two never stack for the same person.
    //
    // FIX 3: vendor_commissions has no vendedor_id FK — comparison is by name.
    // We fetch all non-recurrencia commissions for this invoice and compare with
    // normalizeName() on both sides to guard against diacritics / whitespace
    // drift (e.g. "Simón" vs "Simon"). A UUID-based check would be strictly
    // stronger but requires a schema migration to add vendedor_id to
    // vendor_commissions; the name normalisation is the best available guard
    // with the current schema.
    // The invoice's commissions can live in BOTH tables: legacy/aliado rows in
    // vendor_commissions AND per-item rows in invoice_item_commissions (the
    // current create path only writes item commissions — "item commissions are
    // the source of truth"). Checking only vendor_commissions would miss the
    // closer's item commission and wrongly stack the 1% for the same person.
    const [{ data: invoiceComms }, { data: invoiceItemComms }] = await Promise.all([
      (supabase as any)
        .from('vendor_commissions')
        .select('beneficiario_nombre')
        .eq('income_invoice_id', inv.id)
        .neq('rol', 'recurrencia'),
      (supabase as any)
        .from('invoice_item_commissions')
        .select('beneficiario_nombre')
        .eq('income_invoice_id', inv.id),
    ])

    const normalizedOriginador = normalizeName(originador)
    const isSamePerson = [...(invoiceComms || []), ...(invoiceItemComms || [])].some(
      (c: any) => normalizeName(c.beneficiario_nombre || '') === normalizedOriginador
    )
    if (isSamePerson) continue

    // Create 1% recurring commission on the recurring portion in USD.
    // recurringAmountUsd converts ONLY monto_recurrente via the invoice's implied
    // rate (total_usd / total_moneda_local), guarding against zero/missing totals.
    const recurringUsd = recurringAmountUsd(inv)
    if (recurringUsd <= 0) continue
    const comision = recurringUsd * 0.01
    const baseUsd = recurringUsd

    const { error } = await (supabase as any)
      .from('vendor_commissions')
      .insert({
        income_invoice_id: inv.id,
        tipo: 'vendedor',
        beneficiario_nombre: originador,
        porcentaje: 1,
        monto_base: baseUsd,
        monto_comision: comision,
        moneda_comision: 'USD',
        monto_comision_usd: comision,
        monto_pagado: 0,
        status: 'pendiente',
        sociedad: inv.sociedad,
        cliente_nombre: inv.razon_social_cliente,
        rol: 'recurrencia',
        cuota_mes: currentMonth,
        cuota_numero: null,
      })

    if (!error) created++
  }

  revalidatePath('/comisiones')
  return { created }
}

/**
 * Generate link de pago commission (2% of first invoice that switches to payment link)
 * Called when a Stripe payment link is created for a client
 */
export async function createLinkPagoCommission(data: {
  income_invoice_id?: string
  vendedor_nombre: string
  monto_base_usd: number
  sociedad: string
  cliente_nombre: string
}) {
  // UI-only: must be called from a context with an authenticated user session
  // (RLS on vendor_commissions requires `authenticated`). For server-to-server
  // callers, use createServiceClient() like generateRecurringCommissions above.
  const supabase = await createClient()
  const comision = data.monto_base_usd * 0.02 // 2% of first invoice

  const { error } = await (supabase as any)
    .from('vendor_commissions')
    .insert({
      income_invoice_id: data.income_invoice_id || null,
      tipo: 'vendedor',
      beneficiario_nombre: data.vendedor_nombre,
      porcentaje: 2,
      monto_base: data.monto_base_usd,
      monto_comision: comision,
      moneda_comision: 'USD',
      monto_comision_usd: comision,
      monto_pagado: 0,
      status: 'pendiente',
      sociedad: data.sociedad,
      cliente_nombre: data.cliente_nombre,
      rol: 'link_pago',
    })

  if (error) throw new Error(error.message)
  revalidatePath('/comisiones')
}
