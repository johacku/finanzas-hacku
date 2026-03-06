/* eslint-disable @typescript-eslint/no-empty-object-type */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      customers: {
        Row: {
          id: string
          nombre_cliente: string
          sociedad_cliente: string | null
          pais: string | null
          ciudad: string | null
          industria: string | null
          kam_responsable: string | null
          plan_actual: string | null
          tiene_factoraje: boolean
          comentarios_factoraje: string | null
          created_at: string
        }
        Insert: {
          id?: string
          nombre_cliente: string
          sociedad_cliente?: string | null
          pais?: string | null
          ciudad?: string | null
          industria?: string | null
          kam_responsable?: string | null
          plan_actual?: string | null
          tiene_factoraje?: boolean
          comentarios_factoraje?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          nombre_cliente?: string
          sociedad_cliente?: string | null
          pais?: string | null
          ciudad?: string | null
          industria?: string | null
          kam_responsable?: string | null
          plan_actual?: string | null
          tiene_factoraje?: boolean
          comentarios_factoraje?: string | null
          created_at?: string
        }
        Relationships: []
      }
      expense_invoices: {
        Row: {
          id: string
          sociedad: string
          nombre_proveedor_concepto: string
          estado: string
          monto_presupuestado: number
          monto_real: number | null
          mes: string
          semana: number
          proveedor_id: string | null
          documento_url: string | null
          currency_exchange_rate: number | null
          local_currency_amount: number | null
          monto_usd: number | null
          categoria_nivel_2: string | null
          centro_costo: string | null
          proyecto: string | null
          tags: Json | null
          fecha_pago_o_cobro: string | null
          created_at: string
        }
        Insert: {
          id?: string
          sociedad: string
          nombre_proveedor_concepto: string
          estado?: string
          monto_presupuestado: number
          monto_real?: number | null
          mes: string
          semana: number
          proveedor_id?: string | null
          documento_url?: string | null
          currency_exchange_rate?: number | null
          local_currency_amount?: number | null
          monto_usd?: number | null
          categoria_nivel_2?: string | null
          centro_costo?: string | null
          proyecto?: string | null
          tags?: Json | null
          fecha_pago_o_cobro?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          sociedad?: string
          nombre_proveedor_concepto?: string
          estado?: string
          monto_presupuestado?: number
          monto_real?: number | null
          mes?: string
          semana?: number
          proveedor_id?: string | null
          documento_url?: string | null
          currency_exchange_rate?: number | null
          local_currency_amount?: number | null
          monto_usd?: number | null
          categoria_nivel_2?: string | null
          centro_costo?: string | null
          proyecto?: string | null
          tags?: Json | null
          fecha_pago_o_cobro?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_expense_invoices_proveedor"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          }
        ]
      }
      financial_liabilities: {
        Row: {
          id: string
          sociedad: string
          nombre: string
          tipo: "line_of_credit" | "rotating_card" | "loan" | "other"
          banco: string | null
          moneda: string
          monto_total: number | null
          monto_disponible: number | null
          tasa_interes: number | null
          fecha_inicio: string | null
          fecha_vencimiento: string | null
          status: "active" | "paid_off" | "suspended" | "defaulted"
          notas: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          sociedad: string
          nombre: string
          tipo: "line_of_credit" | "rotating_card" | "loan" | "other"
          banco?: string | null
          moneda: string
          monto_total?: number | null
          monto_disponible?: number | null
          tasa_interes?: number | null
          fecha_inicio?: string | null
          fecha_vencimiento?: string | null
          status?: "active" | "paid_off" | "suspended" | "defaulted"
          notas?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          sociedad?: string
          nombre?: string
          tipo?: "line_of_credit" | "rotating_card" | "loan" | "other"
          banco?: string | null
          moneda?: string
          monto_total?: number | null
          monto_disponible?: number | null
          tasa_interes?: number | null
          fecha_inicio?: string | null
          fecha_vencimiento?: string | null
          status?: "active" | "paid_off" | "suspended" | "defaulted"
          notas?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      liability_movements: {
        Row: {
          id: string
          liability_id: string
          fecha_movimiento: string
          tipo_movimiento: string
          monto: number
          descripcion: string | null
          balance_despues: number | null
          created_at: string
        }
        Insert: {
          id?: string
          liability_id: string
          fecha_movimiento: string
          tipo_movimiento: string
          monto: number
          descripcion?: string | null
          balance_despues?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          liability_id?: string
          fecha_movimiento?: string
          tipo_movimiento?: string
          monto?: number
          descripcion?: string | null
          balance_despues?: number | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "liability_movements_liability_id_fkey"
            columns: ["liability_id"]
            isOneToOne: false
            referencedRelation: "financial_liabilities"
            referencedColumns: ["id"]
          }
        ]
      }
      liability_payments: {
        Row: {
          id: string
          liability_id: string
          fecha_pago: string
          monto_pago: number
          monto_capital: number | null
          monto_interes: number | null
          estado: string
          notas: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          liability_id: string
          fecha_pago: string
          monto_pago: number
          monto_capital?: number | null
          monto_interes?: number | null
          estado?: string
          notas?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          liability_id?: string
          fecha_pago?: string
          monto_pago?: number
          monto_capital?: number | null
          monto_interes?: number | null
          estado?: string
          notas?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "liability_payments_liability_id_fkey"
            columns: ["liability_id"]
            isOneToOne: false
            referencedRelation: "financial_liabilities"
            referencedColumns: ["id"]
          }
        ]
      }
      income_invoices: {
        Row: {
          id: string
          sociedad: string
          razon_social_cliente: string
          estado: string
          moneda: string
          hacku_cliente: string | null
          tipo_documento: string | null
          numero_documento: string | null
          fecha_creacion: string
          fecha_vencimiento: string
          dia_pago_cliente: number
          dia_adelanto_factoraje: number | null
          tiene_factoraje: boolean
          fecha_factoraje: string | null
          monto_no_recurrente: number
          monto_creacion_contenido: number
          monto_recurrente: number
          total_moneda_local: number | null
          fecha_pago_o_cobro: string | null
          total_usd: number | null
          meses_causados: number | null
          fecha_inicio_causacion: string | null
          fecha_fin_causacion: string | null
          vendedor: string | null
          vendedor_id: string | null
          porcentaje_comision: number | null
          comision_aliado: boolean
          porcentaje_comision_aliado: number | null
          semana_pago_factoraje: number | null
          cliente_id: string | null
          documento_url: string | null
          factoring_week_start: string | null
          currency_exchange_rate: number | null
          local_currency_amount: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          sociedad: string
          razon_social_cliente: string
          estado?: string
          moneda: string
          hacku_cliente?: string | null
          tipo_documento?: string | null
          numero_documento?: string | null
          fecha_creacion: string
          fecha_vencimiento: string
          dia_pago_cliente?: number
          dia_adelanto_factoraje?: number | null
          tiene_factoraje?: boolean
          fecha_factoraje?: string | null
          monto_no_recurrente?: number
          monto_creacion_contenido?: number
          monto_recurrente?: number
          fecha_pago_o_cobro?: string | null
          total_usd?: number | null
          meses_causados?: number | null
          fecha_inicio_causacion?: string | null
          fecha_fin_causacion?: string | null
          vendedor?: string | null
          vendedor_id?: string | null
          porcentaje_comision?: number | null
          comision_aliado?: boolean
          porcentaje_comision_aliado?: number | null
          semana_pago_factoraje?: number | null
          cliente_id?: string | null
          documento_url?: string | null
          factoring_week_start?: string | null
          currency_exchange_rate?: number | null
          local_currency_amount?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          sociedad?: string
          razon_social_cliente?: string
          estado?: string
          moneda?: string
          hacku_cliente?: string | null
          tipo_documento?: string | null
          numero_documento?: string | null
          fecha_creacion?: string
          fecha_vencimiento?: string
          dia_pago_cliente?: number
          dia_adelanto_factoraje?: number | null
          tiene_factoraje?: boolean
          fecha_factoraje?: string | null
          monto_no_recurrente?: number
          monto_creacion_contenido?: number
          monto_recurrente?: number
          fecha_pago_o_cobro?: string | null
          total_usd?: number | null
          meses_causados?: number | null
          fecha_inicio_causacion?: string | null
          fecha_fin_causacion?: string | null
          vendedor?: string | null
          vendedor_id?: string | null
          porcentaje_comision?: number | null
          comision_aliado?: boolean
          porcentaje_comision_aliado?: number | null
          semana_pago_factoraje?: number | null
          cliente_id?: string | null
          documento_url?: string | null
          factoring_week_start?: string | null
          currency_exchange_rate?: number | null
          local_currency_amount?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "income_invoices_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          }
        ]
      }
      payroll: {
        Row: {
          id: string
          nombre: string
          rol: string
          pais: string
          area: Database['public']['Enums']['expense_area']
          moneda_pago: Database['public']['Enums']['moneda_enum']
          sociedad: Database['public']['Enums']['sociedad_enum']
          cost_sga: Database['public']['Enums']['cost_sga']
          active: boolean
          monthly_amounts: Json
          ultimo_pago: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nombre: string
          rol: string
          pais: string
          area: Database['public']['Enums']['expense_area']
          moneda_pago: Database['public']['Enums']['moneda_enum']
          sociedad: Database['public']['Enums']['sociedad_enum']
          cost_sga: Database['public']['Enums']['cost_sga']
          active?: boolean
          monthly_amounts?: Json
          ultimo_pago?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nombre?: string
          rol?: string
          pais?: string
          area?: Database['public']['Enums']['expense_area']
          moneda_pago?: Database['public']['Enums']['moneda_enum']
          sociedad?: Database['public']['Enums']['sociedad_enum']
          cost_sga?: Database['public']['Enums']['cost_sga']
          active?: boolean
          monthly_amounts?: Json
          ultimo_pago?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      proveedores: {
        Row: {
          id: string
          nombre_proveedor: string
          sociedad_proveedor: string | null
          pais: string | null
          ciudad: string | null
          tipo_proveedor: string | null
          contacto_principal: string | null
          email: string | null
          telefono: string | null
          banco_pago: string | null
          cuenta_pago: string | null
          created_at: string
        }
        Insert: {
          id?: string
          nombre_proveedor: string
          sociedad_proveedor?: string | null
          pais?: string | null
          ciudad?: string | null
          tipo_proveedor?: string | null
          contacto_principal?: string | null
          email?: string | null
          telefono?: string | null
          banco_pago?: string | null
          cuenta_pago?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          nombre_proveedor?: string
          sociedad_proveedor?: string | null
          pais?: string | null
          ciudad?: string | null
          tipo_proveedor?: string | null
          contacto_principal?: string | null
          email?: string | null
          telefono?: string | null
          banco_pago?: string | null
          cuenta_pago?: string | null
          created_at?: string
        }
        Relationships: []
      }
      trm_rates: {
        Row: {
          id: string
          fecha: string
          usd_cop: number
          created_at: string
        }
        Insert: {
          id?: string
          fecha: string
          usd_cop: number
          created_at?: string
        }
        Update: {
          id?: string
          fecha?: string
          usd_cop?: number
          created_at?: string
        }
        Relationships: []
      }
      weekly_cashflow_entries: {
        Row: {
          id: string
          sociedad: string
          week_start_date: string
          estimated_cash_in: number
          realtime_cash_in: number | null
          estimated_cash_out: number
          realtime_cash_out: number | null
          net_cash_flow: number | null
          opening_balance: number | null
          closing_balance: number | null
          requires_additional_cash: boolean
          cash_gap_usd: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          sociedad: string
          week_start_date: string
          estimated_cash_in?: number
          realtime_cash_in?: number | null
          estimated_cash_out?: number
          realtime_cash_out?: number | null
          opening_balance?: number | null
          closing_balance?: number | null
          requires_additional_cash?: boolean
          cash_gap_usd?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          sociedad?: string
          week_start_date?: string
          estimated_cash_in?: number
          realtime_cash_in?: number | null
          estimated_cash_out?: number
          realtime_cash_out?: number | null
          opening_balance?: number | null
          closing_balance?: number | null
          requires_additional_cash?: boolean
          cash_gap_usd?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {}
    Functions: {}
    Enums: {
      cost_sga: "Cost" | "SGA"
      currency_pair: "USDCOP" | "USDMXN" | "USDBRL" | "USDPEN"
      expense_area: "Global" | "Growth" | "Tech & Product" | "Operation & Finance" | "Student Success" | "Learning"
      expense_categoria: "Software" | "Payroll" | "Office" | "Marketing" | "Legal" | "Accounting" | "Travel" | "Other"
      expense_tipo: "Cost" | "SGA"
      frecuencia_recurrencia: "monthly" | "quarterly" | "annual" | "one-time"
      invoice_estado: "Pagada" | "Pendiente" | "Anulada" | "Vencida"
      liability_status: "active" | "paid_off" | "suspended" | "defaulted"
      liability_type: "line_of_credit" | "rotating_card" | "loan" | "other"
      logica_prioridad: "Urgente" | "Media" | "Baja"
      moneda_enum: "COP" | "USD" | "MXN" | "BRL" | "EUR"
      sociedad_enum: "hackÜ SAS" | "hackÜ LLC" | "hackÜ MEX" | "hackÜ PER" | "hackÜ BRA"
    }
    CompositeTypes: {}
  }
}
