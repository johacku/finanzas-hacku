/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { requireCronSecret } from "@/lib/api-auth"

/**
 * GET /api/fix-commission-vendedores
 * Updates "Sin asignar" commissions with the correct vendedor from income_invoices
 */
export async function GET(request: Request) {
  const denied = requireCronSecret(request)
  if (denied) return denied

  const supabase = createServiceClient()

  // Get all "Sin asignar" commissions
  const { data: unassigned, error } = await (supabase as any)
    .from('vendor_commissions')
    .select('id, income_invoice_id, cliente_nombre, beneficiario_nombre')
    .eq('beneficiario_nombre', 'Sin asignar')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let fixed = 0
  let notFound = 0

  for (const c of unassigned || []) {
    let vendedor = null

    // Try by income_invoice_id first
    if (c.income_invoice_id) {
      const { data: inv } = await (supabase as any)
        .from('income_invoices')
        .select('vendedor, vendedores:vendedor_id(nombre)')
        .eq('id', c.income_invoice_id)
        .single()

      vendedor = inv?.vendedor || inv?.vendedores?.nombre
    }

    // Try by cliente_nombre if no FK
    if (!vendedor && c.cliente_nombre) {
      const { data: inv } = await (supabase as any)
        .from('income_invoices')
        .select('vendedor, vendedores:vendedor_id(nombre)')
        .eq('razon_social_cliente', c.cliente_nombre)
        .not('vendedor', 'is', null)
        .limit(1)
        .single()

      vendedor = inv?.vendedor || inv?.vendedores?.nombre
    }

    if (vendedor && vendedor !== 'Sin asignar') {
      await (supabase as any)
        .from('vendor_commissions')
        .update({ beneficiario_nombre: vendedor })
        .eq('id', c.id)
      fixed++
    } else {
      notFound++
    }
  }

  return NextResponse.json({
    totalUnassigned: unassigned?.length || 0,
    fixed,
    notFound,
  })
}
