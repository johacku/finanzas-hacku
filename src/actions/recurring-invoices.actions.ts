/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createRecurringTemplate(data: {
  alegra_client_id?: string
  alegra_client_name: string
  sociedad: string
  moneda: string
  dia_recurrencia: number
  dias_vencimiento: number
  observaciones?: string
  anotaciones?: string
  items: any[]
  total: number
  total_usd?: number
  solicitante_email: string
  solicitante_nombre: string
  vendedor_nombre?: string
  oc_numero?: string
  porcentaje_comision?: number
  tipo_documento?: string
}) {
  const supabase = await createClient()
  const { data: created, error } = await (supabase as any)
    .from('recurring_invoice_templates')
    .insert(data)
    .select()
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/alegra-invoices')
  return created
}

export async function getRecurringTemplates() {
  try {
    const supabase = await createClient()
    const { data, error } = await (supabase as any)
      .from('recurring_invoice_templates')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) { console.warn('[Recurring]', error.message); return [] }
    return data || []
  } catch { return [] }
}

export async function toggleRecurringTemplate(id: string, activo: boolean) {
  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('recurring_invoice_templates')
    .update({ activo })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/alegra-invoices')
}

export async function deleteRecurringTemplate(id: string) {
  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('recurring_invoice_templates')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/alegra-invoices')
}
