'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Database } from '@/types/database.types'

type PayrollInsert = Database['public']['Tables']['payroll']['Insert']
type PayrollUpdate = Database['public']['Tables']['payroll']['Update']
type SociedadEnum = Database['public']['Enums']['sociedad_enum']
type AreaEnum = string
type CostSgaEnum = string

export async function getPayroll(filters?: {
  sociedad?: SociedadEnum
  area?: AreaEnum
  active?: boolean
  costSga?: CostSgaEnum
}) {
  const supabase = await createClient()

  let query = supabase
    .from('payroll')
    .select('*')
    .order('nombre', { ascending: true })

  if (filters?.sociedad) query = query.eq('sociedad', filters.sociedad)
  if (filters?.area) query = query.eq('area', filters.area)
  if (filters?.active !== undefined) query = query.eq('active', filters.active)
  if (filters?.costSga) query = query.eq('cost_sga', filters.costSga)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data
}

export async function createPayrollEntry(data: PayrollInsert) {
  const supabase = await createClient()
  const { error } = await supabase.from('payroll').insert(data)
  if (error) throw new Error(error.message)
  revalidatePath('/payroll')
}

export async function updatePayrollEntry(id: string, data: PayrollUpdate) {
  const supabase = await createClient()
  const { error } = await supabase.from('payroll').update(data).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/payroll')
}

export async function deletePayrollEntry(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('payroll').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/payroll')
}
