// @ts-nocheck
"use server"
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

// ============================================
// PLANES
// ============================================
export async function getPlanes() {
  const supabase = await createClient()
  const { data, error } = await (supabase as any)
    .from("planes")
    .select("*, plan_commission_ranges(*)")
    .eq("activo", true)
    .order("nombre")

  if (error) throw new Error(`Failed to fetch planes: ${error.message}`)
  return data
}

export async function createPlan(nombre: string, descripcion?: string) {
  const supabase = await createClient()
  const { data, error } = await (supabase as any)
    .from("planes")
    .insert([{ nombre, descripcion }])
    .select()
    .single()

  if (error) throw new Error(`Failed to create plan: ${error.message}`)
  revalidatePath("/settings/master-lists")
  return data
}

export async function deletePlan(id: string) {
  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from("planes")
    .update({ activo: false })
    .eq("id", id)

  if (error) throw new Error(`Failed to delete plan: ${error.message}`)
  revalidatePath("/settings/master-lists")
}

// Plan commission ranges
export async function addPlanCommissionRange(data: {
  plan_id: string
  moneda?: string
  precio_desde: number
  precio_hasta: number | null
  porcentaje_comision: number
}) {
  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('plan_commission_ranges')
    .insert(data)
  if (error) throw new Error(error.message)
  revalidatePath('/settings/master-lists')
}

export async function removePlanCommissionRange(id: string) {
  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('plan_commission_ranges')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/settings/master-lists')
}

// ============================================
// ALIADOS
// ============================================
export async function getAliados() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("aliados")
    .select("*")
    .eq("activo", true)
    .order("nombre")

  if (error) throw new Error(`Failed to fetch aliados: ${error.message}`)
  return data
}

export async function createAliado(input: {
  nombre: string
  email?: string
  telefono?: string
  porcentaje_comision?: number
  notas?: string
}) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("aliados")
    .insert([input])
    .select()
    .single()

  if (error) throw new Error(`Failed to create aliado: ${error.message}`)
  revalidatePath("/")
  return data
}

export async function updateAliado(
  id: string,
  input: Partial<{
    nombre: string
    email: string
    telefono: string
    porcentaje_comision: number
    notas: string
    activo: boolean
  }>
) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("aliados")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()

  if (error) throw new Error(`Failed to update aliado: ${error.message}`)
  revalidatePath("/")
  return data
}

export async function deleteAliado(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("aliados")
    .update({ activo: false })
    .eq("id", id)

  if (error) throw new Error(`Failed to delete aliado: ${error.message}`)
  revalidatePath("/")
}

// ============================================
// VENDEDORES (KAMs/Hunters)
// ============================================
export async function getVendedores() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("vendedores")
    .select("*")
    .eq("activo", true)
    .order("nombre")

  if (error) throw new Error(`Failed to fetch vendedores: ${error.message}`)
  return data
}

export async function createVendedor(input: {
  nombre: string
  email?: string
  rol: "KAM" | "Hunter"
  notas?: string
}) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("vendedores")
    .insert([input])
    .select()
    .single()

  if (error) throw new Error(`Failed to create vendedor: ${error.message}`)
  revalidatePath("/")
  return data
}

export async function updateVendedor(
  id: string,
  input: Partial<{
    nombre: string
    email: string
    rol: "KAM" | "Hunter"
    notas: string
    activo: boolean
  }>
) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("vendedores")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()

  if (error) throw new Error(`Failed to update vendedor: ${error.message}`)
  revalidatePath("/")
  return data
}

export async function deleteVendedor(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("vendedores")
    .update({ activo: false })
    .eq("id", id)

  if (error) throw new Error(`Failed to delete vendedor: ${error.message}`)
  revalidatePath("/")
}

// ============================================
// TIPOS DE PAGO
// ============================================
export async function getTiposPago() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("tipos_pago")
    .select("*")
    .eq("activo", true)
    .order("nombre")

  if (error) throw new Error(`Failed to fetch tipos_pago: ${error.message}`)
  return data
}

export async function createTipoPago(nombre: string, descripcion?: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("tipos_pago")
    .insert([{ nombre, descripcion }])
    .select()
    .single()

  if (error) throw new Error(`Failed to create tipo_pago: ${error.message}`)
  revalidatePath("/")
  return data
}

export async function deleteTipoPago(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("tipos_pago")
    .update({ activo: false })
    .eq("id", id)

  if (error) throw new Error(`Failed to delete tipo_pago: ${error.message}`)
  revalidatePath("/")
}

// ============================================
// CONCEPTOS DE GASTO
// ============================================
export async function getConceptosGasto() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("conceptos_gasto")
    .select("*")
    .eq("activo", true)
    .order("es_comun", { ascending: false })
    .order("nombre")

  if (error) throw new Error(`Failed to fetch conceptos: ${error.message}`)
  return data
}

export async function createConceptoGasto(input: {
  nombre: string
  categoria?: string
  es_comun?: boolean
}) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("conceptos_gasto")
    .insert([input])
    .select()
    .single()

  if (error) throw new Error(`Failed to create concepto: ${error.message}`)
  revalidatePath("/")
  return data
}

export async function updateConceptoGasto(
  id: string,
  input: Partial<{
    nombre: string
    categoria: string
    es_comun: boolean
    activo: boolean
  }>
) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("conceptos_gasto")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()

  if (error) throw new Error(`Failed to update concepto: ${error.message}`)
  revalidatePath("/")
  return data
}

export async function deleteConcepto(id: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from("conceptos_gasto")
    .update({ activo: false })
    .eq("id", id)

  if (error) throw new Error(`Failed to delete concepto: ${error.message}`)
  revalidatePath("/")
}

// ============================================
// PRIORIDADES DE PAGO
// ============================================
export async function getPrioridades() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("prioridades_pago")
    .select("*")
    .eq("activo", true)
    .order("nivel")

  if (error) throw new Error(`Failed to fetch prioridades: ${error.message}`)
  return data
}

// ============================================
// STATISTICS / REPORTING
// ============================================
export async function getVendedorStats(vendedorId: string) {
  const supabase = await createClient()

  // Get total amount by this vendedor
  const { data: invoices, error } = await supabase
    .from("income_invoices")
    .select("monto_usd, monto")
    .eq("vendedor_id", vendedorId)

  if (error) {
    console.error("Failed to fetch vendedor stats:", error)
    return { total: 0, count: 0, promedio: 0 }
  }

  const total = invoices?.reduce((sum, inv) => sum + (inv.monto_usd || inv.monto || 0), 0) ?? 0
  const count = invoices?.length ?? 0
  const promedio = count > 0 ? total / count : 0

  return { total, count, promedio }
}

export async function getAliadoStats(aliadoId: string) {
  const supabase = await createClient()

  const { data: invoices, error } = await supabase
    .from("income_invoices")
    .select("monto_usd, monto, porcentaje_comision_aliado")
    .eq("aliado_id", aliadoId)

  if (error) {
    console.error("Failed to fetch aliado stats:", error)
    return { total: 0, count: 0, comision_total: 0 }
  }

  const total = invoices?.reduce((sum, inv) => sum + (inv.monto_usd || inv.monto || 0), 0) ?? 0
  const comision_total = invoices?.reduce(
    (sum, inv) =>
      sum + ((inv.monto_usd || inv.monto || 0) * (inv.porcentaje_comision_aliado || 0)) / 100,
    0
  ) ?? 0

  return { total, count: invoices?.length ?? 0, comision_total }
}
