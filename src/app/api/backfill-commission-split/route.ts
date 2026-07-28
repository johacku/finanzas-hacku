/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { requireCronSecret } from "@/lib/api-auth"
import { splitItemCommission } from "@/lib/commission-math"

/**
 * GET /api/backfill-commission-split
 *
 * Corrige comisiones históricas de `invoice_item_commissions` que quedaron
 * INFLADAS por el bug del reparto (spec 003): cuando un item tenía N
 * participantes, a cada uno se le aplicó la TASA COMPLETA del item, de modo que
 * la suma por item = N × (subtotal × tasa) en vez de una sola comisión.
 *
 * Estrategia (idempotente):
 *   - Agrupa las filas por (income_invoice_id | alegra_request_id, alegra_item_id).
 *   - Grupos de 1 fila → ya correctos (share 100%); se saltan.
 *   - Para grupos de N filas, la comisión del item = subtotal × porcentaje/100
 *     (la tasa vive en `porcentaje` y no cambia). Si la suma de `monto_comision`
 *     ya es ≤ esa comisión (± tolerancia), el grupo ya fue corregido → se salta.
 *   - Si está inflado, se reparte en partes iguales (los históricos no guardaban
 *     share explícito) con residuo al último participante, y se setea
 *     `share_reparto = 100/N` en cada fila.
 *
 * Parámetros:
 *   ?dry=1  → no escribe; solo reporta cuántos grupos/filas se corregirían.
 */
export async function GET(request: Request) {
  const denied = requireCronSecret(request)
  if (denied) return denied

  const dryRun = new URL(request.url).searchParams.get("dry") === "1"
  const supabase = createServiceClient()

  const { data: all, error } = await (supabase as any)
    .from("invoice_item_commissions")
    .select(
      "id, income_invoice_id, alegra_request_id, alegra_item_id, item_subtotal, item_subtotal_usd, porcentaje, share_reparto, monto_comision, monto_comision_usd"
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Group by owner (invoice or request) + item.
  const groups = new Map<string, any[]>()
  for (const row of all || []) {
    const owner = row.income_invoice_id || row.alegra_request_id || "none"
    const key = `${owner}::${row.alegra_item_id}`
    const list = groups.get(key) || []
    list.push(row)
    groups.set(key, list)
  }

  let groupsFixed = 0
  let rowsFixed = 0
  let groupsSkipped = 0
  const updates: Array<{ id: string; monto_comision: number; monto_comision_usd: number; share_reparto: number }> = []

  for (const [, rows] of Array.from(groups.entries())) {
    if (rows.length <= 1) { groupsSkipped++; continue }

    const rate = Number(rows[0].porcentaje) || 0
    const subtotal = Number(rows[0].item_subtotal) || 0
    const subtotalUsd = Number(rows[0].item_subtotal_usd) || 0
    const comisionLocal = subtotal * (rate / 100)
    const comisionUsd = subtotalUsd * (rate / 100)

    const sumaActual = rows.reduce((a: number, r: any) => a + (Number(r.monto_comision) || 0), 0)

    // Ya corregido: la suma no supera la comisión del item (± 1 unidad de tolerancia).
    if (sumaActual <= comisionLocal + 1) { groupsSkipped++; continue }

    // Reparto en partes iguales (los históricos no guardaban share explícito).
    const equalShare = 100 / rows.length
    const split = splitItemCommission(
      comisionLocal,
      comisionUsd,
      rows.map((r: any) => ({ beneficiario_nombre: r.id, rol: "closer", share: equalShare }))
    )

    split.forEach((s, i) => {
      updates.push({
        id: rows[i].id,
        monto_comision: s.monto_comision_local,
        monto_comision_usd: s.monto_comision_usd,
        share_reparto: equalShare,
      })
    })
    groupsFixed++
    rowsFixed += rows.length
  }

  if (dryRun) {
    return NextResponse.json({ dryRun: true, groupsFixed, rowsFixed, groupsSkipped })
  }

  // Aplicar updates fila por fila (upsert por id).
  let applied = 0
  for (const u of updates) {
    const { error: upErr } = await (supabase as any)
      .from("invoice_item_commissions")
      .update({
        monto_comision: u.monto_comision,
        monto_comision_usd: u.monto_comision_usd,
        share_reparto: u.share_reparto,
      })
      .eq("id", u.id)
    if (upErr) {
      return NextResponse.json({ error: upErr.message, appliedBeforeError: applied }, { status: 500 })
    }
    applied++
  }

  return NextResponse.json({ dryRun: false, groupsFixed, rowsFixed, rowsUpdated: applied, groupsSkipped })
}
