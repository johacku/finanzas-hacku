/* eslint-disable @typescript-eslint/no-explicit-any */
"use server"

import { createClient } from "@/lib/supabase/server"

export interface HackuCliente {
  id: string
  nombre: string
  created_at: string
  hunter_originador_id?: string | null
  es_negocio_nuevo_originado?: boolean
}

/**
 * Get all hackU Clientes (sorted by name)
 */
export async function getHackuClientes(): Promise<HackuCliente[]> {
  const supabase = await createClient()

  const { data, error } = await (supabase as any)
    .from("hacku_clientes")
    .select("*")
    .order("nombre", { ascending: true })

  if (error) {
    console.error("Error fetching hackU clientes:", error)
    return []
  }

  return (data || []) as HackuCliente[]
}

/**
 * Create a new hackU Cliente
 */
export async function createHackuCliente(nombre: string): Promise<HackuCliente | null> {
  const supabase = await createClient()

  const trimmed = nombre.trim()
  if (!trimmed) return null

  const { data, error } = await (supabase as any)
    .from("hacku_clientes")
    .insert([{ nombre: trimmed }])
    .select()
    .single()

  if (error) {
    // If unique constraint violated, try to fetch existing
    if (error.code === "23505") {
      return getHackuClienteByName(trimmed)
    }
    console.error("Error creating hackU cliente:", error)
    return null
  }

  return data as HackuCliente
}

/**
 * Get or create a hackU Cliente by name
 */
export async function getOrCreateHackuCliente(nombre: string): Promise<HackuCliente | null> {
  const existing = await getHackuClienteByName(nombre)
  if (existing) return existing

  return createHackuCliente(nombre)
}

/**
 * Attribute a client to the Hunter that originated it (new business).
 *
 * The 1% recurring commission follows this Hunter in perpetuity, even after a
 * KAM takes over the account (specs/001-comisiones-por-origen, US3/US4).
 *
 * FR-011: the attribution is NEVER silently overwritten. Once a client has a
 * `hunter_originador_id`, later calls preserve the original one (a warning is
 * logged if a different Hunter is proposed). Only a first-time attribution
 * writes the field.
 *
 * Returns the effective attribution after the call.
 */
export async function setHunterOriginador(
  hackuClienteId: string,
  hunterOriginadorId: string,
): Promise<{ hunter_originador_id: string | null; changed: boolean }> {
  const supabase = await createClient()

  // Guard: only a vendedor with rol='Hunter' can be attributed as originador.
  // Centralized here so EVERY call-site (create, edit, future flows) is
  // protected — a canal='hunter' invoice whose selected vendedor is a KAM must
  // NOT silently attribute the KAM as the perpetual-1% beneficiary.
  const { data: vendedor } = await (supabase as any)
    .from("vendedores")
    .select("rol, nombre")
    .eq("id", hunterOriginadorId)
    .maybeSingle()

  if (vendedor?.rol !== "Hunter") {
    console.warn(
      `[HunterOriginador] vendedor ${hunterOriginadorId} (${vendedor?.nombre || "desconocido"}) tiene rol "${vendedor?.rol || "desconocido"}", no Hunter. No se atribuye originador.`,
    )
    return { hunter_originador_id: null, changed: false }
  }

  const { data: existing } = await (supabase as any)
    .from("hacku_clientes")
    .select("hunter_originador_id")
    .eq("id", hackuClienteId)
    .maybeSingle()

  // Already attributed → preserve the original originator (do not overwrite).
  if (existing?.hunter_originador_id) {
    if (existing.hunter_originador_id !== hunterOriginadorId) {
      console.warn(
        `[HunterOriginador] cliente ${hackuClienteId} ya tiene originador ${existing.hunter_originador_id}; se ignora ${hunterOriginadorId} (FR-011)`,
      )
    }
    return { hunter_originador_id: existing.hunter_originador_id, changed: false }
  }

  const { error } = await (supabase as any)
    .from("hacku_clientes")
    .update({
      hunter_originador_id: hunterOriginadorId,
      es_negocio_nuevo_originado: true,
    })
    .eq("id", hackuClienteId)

  if (error) {
    console.error("[HunterOriginador] update error:", error.message)
    return { hunter_originador_id: existing?.hunter_originador_id ?? null, changed: false }
  }

  return { hunter_originador_id: hunterOriginadorId, changed: true }
}

/**
 * Get a hackU Cliente by name (case-insensitive)
 */
async function getHackuClienteByName(nombre: string): Promise<HackuCliente | null> {
  const supabase = await createClient()

  // Use maybeSingle() instead of single(): single() errors on 0 rows, which
  // causes the caller to silently discard the error and fall through to a
  // duplicate insert. maybeSingle() returns null data without an error when
  // no row matches, giving the caller an accurate "not found" signal.
  const { data, error } = await (supabase as any)
    .from("hacku_clientes")
    .select("*")
    .ilike("nombre", nombre.trim())
    .maybeSingle()

  if (error || !data) return null
  return data as HackuCliente
}
