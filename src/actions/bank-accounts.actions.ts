/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getBankAccounts() {
  const supabase = await createClient()
  const { data, error } = await (supabase as any)
    .from('bank_accounts')
    .select('*')
    .order('banco', { ascending: true })
  if (error) throw new Error(error.message)
  return data
}

export async function createBankAccount(data: {
  nombre: string
  banco: string
  tipo: string
  numero: string
  sociedad: string
  moneda?: string
  titular?: string
  notas?: string
}) {
  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('bank_accounts')
    .insert(data)
  if (error) throw new Error(error.message)
  revalidatePath('/settings/master-lists')
}

export async function updateBankAccount(id: string, data: Record<string, any>) {
  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('bank_accounts')
    .update(data)
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/settings/master-lists')
}

export async function deleteBankAccount(id: string) {
  const supabase = await createClient()
  const { error } = await (supabase as any)
    .from('bank_accounts')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/settings/master-lists')
}
