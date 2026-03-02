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
          created_at: string
        }
        Insert: {
          id?: string
          sociedad: string
          nombre_proveedor_concepto: string
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
          created_at?: string
        }
        Update: {
          id?: string
          sociedad?: string
          nombre_proveedor_concepto?: string
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
          monto: number
          monto_usd: number | null
          fecha_emision: string
          fecha_pago_proyectada: string
          tiene_factoraje: boolean
          semana_pago_factoraje: number | null
          cliente_id: string | null
          documento_url: string | null
          factoring_week_start: string | null
          currency_exchange_rate: number | null
          local_currency_amount: number | null
          mes: string | null
          semana: number | null
          created_at: string
        }
        Insert: {
          id?: string
          sociedad: string
          razon_social_cliente: string
          monto: number
          monto_usd?: number | null
          fecha_emision: string
          fecha_pago_proyectada: string
          tiene_factoraje?: boolean
          semana_pago_factoraje?: number | null
          cliente_id?: string | null
          documento_url?: string | null
          factoring_week_start?: string | null
          currency_exchange_rate?: number | null
          local_currency_amount?: number | null
          mes?: string | null
          semana?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          sociedad?: string
          razon_social_cliente?: string
          monto?: number
          monto_usd?: number | null
          fecha_emision?: string
          fecha_pago_proyectada?: string
          tiene_factoraje?: boolean
          semana_pago_factoraje?: number | null
          cliente_id?: string | null
          documento_url?: string | null
          factoring_week_start?: string | null
          currency_exchange_rate?: number | null
          local_currency_amount?: number | null
          mes?: string | null
          semana?: number | null
          created_at?: string
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
          sociedad: string
          mes: string
          numero_empleados: number
          salario_promedio: number
          salario_total: number
          salario_usd_monthly: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          sociedad: string
          mes: string
          numero_empleados: number
          salario_promedio: number
          salario_total: number
          salario_usd_monthly?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          sociedad?: string
          mes?: string
          numero_empleados?: number
          salario_promedio?: number
          salario_total?: number
          salario_usd_monthly?: Json | null
          created_at?: string
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
          semana_inicio: string
          saldo_inicial: number
          cash_in: number | null
          cash_out: number | null
          manual_cash_in_adjustment: number | null
          manual_cash_out_adjustment: number | null
          saldo_final: number | null
          requires_additional_cash: boolean | null
          deficit_projected: boolean | null
          surplus_projected: boolean | null
          observaciones: string | null
          created_at: string
        }
        Insert: {
          id?: string
          sociedad: string
          semana_inicio: string
          saldo_inicial: number
          cash_in?: number | null
          cash_out?: number | null
          manual_cash_in_adjustment?: number | null
          manual_cash_out_adjustment?: number | null
          saldo_final?: number | null
          requires_additional_cash?: boolean | null
          deficit_projected?: boolean | null
          surplus_projected?: boolean | null
          observaciones?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          sociedad?: string
          semana_inicio?: string
          saldo_inicial?: number
          cash_in?: number | null
          cash_out?: number | null
          manual_cash_in_adjustment?: number | null
          manual_cash_out_adjustment?: number | null
          saldo_final?: number | null
          requires_additional_cash?: boolean | null
          deficit_projected?: boolean | null
          surplus_projected?: boolean | null
          observaciones?: string | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {}
    Functions: {}
    Enums: {
      expense_tipo: "salarios" | "software" | "operacional" | "otro"
      liability_status: "active" | "paid_off" | "suspended" | "defaulted"
      liability_type: "line_of_credit" | "rotating_card" | "loan" | "other"
      moneda_enum: "USD" | "COP" | "MXN" | "VEF"
      sociedad_enum: "Sociedad 1" | "Sociedad 2" | "Sociedad 3"
    }
    CompositeTypes: {}
  }
}
