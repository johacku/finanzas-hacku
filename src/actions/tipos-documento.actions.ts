/* eslint-disable @typescript-eslint/no-explicit-any */
"use server"

import { createClient } from "@/lib/supabase/server"

export interface TipoDocumento {
  id: string
  nombre: string
  orden: number
  activo: boolean
}

/**
 * Get all active tipos de documento (sorted by orden)
 */
export async function getTiposDocumento(): Promise<TipoDocumento[]> {
  const supabase = await createClient()

  const { data, error } = await (supabase as any)
    .from("tipos_documento")
    .select("*")
    .eq("activo", true)
    .order("orden", { ascending: true })

  if (error) {
    console.error("Error fetching tipos documento:", error)
    return []
  }

  return (data || []) as TipoDocumento[]
}

/**
 * Create a new tipo de documento
 */
export async function createTipoDocumento(nombre: string): Promise<TipoDocumento | null> {
  const supabase = await createClient()

  const trimmed = nombre.trim()
  if (!trimmed) return null

  // Get max orden
  const { data: maxOrden } = await (supabase as any)
    .from("tipos_documento")
    .select("orden")
    .order("orden", { ascending: false })
    .limit(1)
    .single()

  const nextOrden = (maxOrden?.orden ?? 0) + 1

  const { data, error } = await (supabase as any)
    .from("tipos_documento")
    .insert([{ nombre: trimmed, orden: nextOrden }])
    .select()
    .single()

  if (error) {
    if (error.code === "23505") {
      // Already exists, fetch it
      const { data: existing } = await (supabase as any)
        .from("tipos_documento")
        .select("*")
        .ilike("nombre", trimmed)
        .single()
      return existing as TipoDocumento | null
    }
    console.error("Error creating tipo documento:", error)
    return null
  }

  return data as TipoDocumento
}
