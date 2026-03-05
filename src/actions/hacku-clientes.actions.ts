/* eslint-disable @typescript-eslint/no-explicit-any */
"use server"

import { createClient } from "@/lib/supabase/server"

export interface HackuCliente {
  id: string
  nombre: string
  created_at: string
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
 * Get a hackU Cliente by name (case-insensitive)
 */
async function getHackuClienteByName(nombre: string): Promise<HackuCliente | null> {
  const supabase = await createClient()

  const { data, error } = await (supabase as any)
    .from("hacku_clientes")
    .select("*")
    .ilike("nombre", nombre.trim())
    .single()

  if (error || !data) return null
  return data as HackuCliente
}
