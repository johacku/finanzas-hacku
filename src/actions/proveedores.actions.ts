/* eslint-disable @typescript-eslint/no-explicit-any */
"use server"

import { createClient } from "@/lib/supabase/server"
import {
  CreateProveedorInput,
  UpdateProveedorInput,
} from "@/lib/validations/proveedor.schema"
import { revalidatePath } from "next/cache"

/**
 * Get all vendors
 */
export async function getProveedores(filters?: {
  sociedad?: string
  tipo_proveedor?: string
}) {
  const supabase = await createClient()

  let query = supabase
    .from("proveedores")
    .select("*")
    .order("nombre_proveedor", { ascending: true })

  if (filters?.sociedad) {
    query = query.eq("sociedad_proveedor", filters.sociedad)
  }

  if (filters?.tipo_proveedor) {
    query = query.eq("tipo_proveedor", filters.tipo_proveedor)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch vendors: ${error.message}`)
  }

  return data
}

/**
 * Get single vendor
 */
export async function getProveedorById(id: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("proveedores")
    .select("*")
    .eq("id", id)
    .single()

  if (error) {
    throw new Error(`Failed to fetch vendor: ${error.message}`)
  }

  return data
}

/**
 * Search vendors by name
 */
export async function searchProveedores(query: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("proveedores")
    .select("*")
    .ilike("nombre_proveedor", `%${query}%`)
    .limit(10)

  if (error) {
    throw new Error(`Failed to search vendors: ${error.message}`)
  }

  return data
}

/**
 * Create new vendor
 */
export async function createProveedor(input: CreateProveedorInput) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("proveedores")
    .insert([input])
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create vendor: ${error.message}`)
  }

  revalidatePath("/proveedores")
  return data
}

/**
 * Update vendor
 */
export async function updateProveedor(
  id: string,
  input: UpdateProveedorInput
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("proveedores")
    .update(input)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update vendor: ${error.message}`)
  }

  revalidatePath("/proveedores")
  return data
}

/**
 * Delete vendor
 */
export async function deleteProveedor(id: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from("proveedores")
    .delete()
    .eq("id", id)

  if (error) {
    throw new Error(`Failed to delete vendor: ${error.message}`)
  }

  revalidatePath("/proveedores")
}

/**
 * Bulk create vendors from a list of names (one per line)
 */
export async function bulkCreateProveedores(names: string[]) {
  const supabase = await createClient()

  const rows = names
    .map((n) => n.trim())
    .filter((n) => n.length > 0)
    .map((nombre_proveedor) => ({ nombre_proveedor }))

  if (rows.length === 0) return { created: 0, skipped: 0 }

  // Get existing names to skip duplicates
  const { data: existing } = await supabase
    .from("proveedores")
    .select("nombre_proveedor")

  const existingNames = new Set(
    (existing || []).map((p: any) => p.nombre_proveedor?.toLowerCase().trim())
  )

  const newRows = rows.filter(
    (r) => !existingNames.has(r.nombre_proveedor.toLowerCase().trim())
  )

  if (newRows.length === 0) {
    revalidatePath("/proveedores")
    return { created: 0, skipped: rows.length }
  }

  const BATCH = 100
  for (let i = 0; i < newRows.length; i += BATCH) {
    const batch = newRows.slice(i, i + BATCH)
    const { error } = await supabase.from("proveedores").insert(batch)
    if (error) throw new Error(`Failed to bulk create vendors: ${error.message}`)
  }

  revalidatePath("/proveedores")
  return { created: newRows.length, skipped: rows.length - newRows.length }
}

/**
 * Get vendor statistics
 */
export async function getProveedorStats(id: string) {
  const supabase = await createClient()

  // Get total expense invoices for this vendor
  const { data: invoices, error } = await supabase
    .from("expense_invoices")
    .select("monto_presupuestado")
    .eq("proveedor_id", id)

  if (error) {
    console.error("Failed to fetch vendor stats:", error)
    return { totalInvoices: 0, totalAmount: 0, invoiceCount: 0 }
  }

  const totalInvoices = invoices?.length ?? 0
  const totalAmount =
    invoices?.reduce((sum, inv) => sum + (inv.monto_presupuestado || 0), 0) ?? 0

  return {
    invoiceCount: totalInvoices,
    totalAmount,
  }
}
