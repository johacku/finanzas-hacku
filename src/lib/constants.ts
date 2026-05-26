// @ts-nocheck
import type { Database } from '@/types/database.types'

export type Sociedad = Database['public']['Enums']['sociedad_enum']
export type Moneda = Database['public']['Enums']['moneda_enum']
export type InvoiceEstado = Database['public']['Enums']['invoice_estado']
export type ExpenseTipo = Database['public']['Enums']['expense_tipo']
export type ExpenseArea = Database['public']['Enums']['expense_area']
export type ExpenseCategoria = Database['public']['Enums']['expense_categoria']
export type FrecuenciaRecurrencia = Database['public']['Enums']['frecuencia_recurrencia']
export type LogicaPrioridad = Database['public']['Enums']['logica_prioridad']
export type CurrencyPair = Database['public']['Enums']['currency_pair']
export type CostSga = Database['public']['Enums']['cost_sga']

export const SOCIEDADES: Sociedad[] = [
  'hackÜ SAS',
  'hackÜ LLC',
  'hackÜ MEX',
  'hackÜ PER',
  'hackÜ BRA',
]

export const MONEDAS: Moneda[] = ['COP', 'USD', 'MXN', 'BRL', 'EUR']

export const INVOICE_ESTADOS: InvoiceEstado[] = [
  'Pagada',
  'Pendiente',
  'Anulada',
  'Vencida',
]

export const EXPENSE_TIPOS: ExpenseTipo[] = ['Cost', 'SGA']

export const EXPENSE_AREAS: ExpenseArea[] = [
  'Global',
  'Growth',
  'Tech & Product',
  'Operation & Finance',
  'Student Success',
  'Learning',
]

export const EXPENSE_CATEGORIAS: ExpenseCategoria[] = [
  'Software',
  'Payroll',
  'Office',
  'Marketing',
  'Legal',
  'Accounting',
  'Travel',
  'Other',
]

export const FRECUENCIAS: FrecuenciaRecurrencia[] = [
  'monthly',
  'quarterly',
  'annual',
  'one-time',
]

export const LOGICAS_PRIORIDAD: LogicaPrioridad[] = [
  'Urgente',
  'Media',
  'Baja',
]

export const CURRENCY_PAIRS: CurrencyPair[] = [
  'USDCOP',
  'USDMXN',
  'USDBRL',
  'USDPEN',
  'USDEUR',
]

export const COST_SGA: CostSga[] = ['Cost', 'SGA']

export const SOCIEDAD_CURRENCY_MAP: Record<Sociedad, Moneda> = {
  'hackÜ SAS': 'COP',
  'hackÜ LLC': 'USD',
  'hackÜ MEX': 'MXN',
  'hackÜ PER': 'COP', // PEN not in enum, closest
  'hackÜ BRA': 'BRL',
}

export const SOCIEDAD_FLAG_MAP: Record<Sociedad, string> = {
  'hackÜ SAS': '🇨🇴',
  'hackÜ LLC': '🇺🇸',
  'hackÜ MEX': '🇲🇽',
  'hackÜ PER': '🇵🇪',
  'hackÜ BRA': '🇧🇷',
}

export const SOCIEDAD_COLOR_MAP: Record<Sociedad, string> = {
  'hackÜ SAS': 'bg-yellow-100 text-yellow-800',
  'hackÜ LLC': 'bg-blue-100 text-blue-800',
  'hackÜ MEX': 'bg-green-100 text-green-800',
  'hackÜ PER': 'bg-red-100 text-red-800',
  'hackÜ BRA': 'bg-emerald-100 text-emerald-800',
}

export const ESTADO_COLOR_MAP: Record<InvoiceEstado, string> = {
  Pagada: 'bg-green-100 text-green-800',
  Pendiente: 'bg-yellow-100 text-yellow-800',
  Anulada: 'bg-gray-100 text-gray-800',
  Vencida: 'bg-red-100 text-red-800',
}

export const PRIORIDAD_COLOR_MAP: Record<number, string> = {
  1: 'bg-red-100 text-red-800',
  2: 'bg-yellow-100 text-yellow-800',
  3: 'bg-green-100 text-green-800',
}

export const PRIORIDAD_LABEL_MAP: Record<number, string> = {
  1: 'Urgente',
  2: 'Media',
  3: 'Baja',
}
