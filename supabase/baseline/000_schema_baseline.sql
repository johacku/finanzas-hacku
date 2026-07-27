


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."alegra_invoice_status" AS ENUM (
    'borrador',
    'pendiente_aprobacion',
    'aprobada',
    'facturada',
    'rechazada',
    'anulada'
);


ALTER TYPE "public"."alegra_invoice_status" OWNER TO "postgres";


CREATE TYPE "public"."bank_account_type" AS ENUM (
    'ahorros',
    'corriente',
    'tdc'
);


ALTER TYPE "public"."bank_account_type" OWNER TO "postgres";


CREATE TYPE "public"."commission_status" AS ENUM (
    'pendiente',
    'por_pagar',
    'pagada',
    'anulada'
);


ALTER TYPE "public"."commission_status" OWNER TO "postgres";


CREATE TYPE "public"."commission_type" AS ENUM (
    'vendedor',
    'aliado'
);


ALTER TYPE "public"."commission_type" OWNER TO "postgres";


CREATE TYPE "public"."cost_sga" AS ENUM (
    'Cost',
    'SGA'
);


ALTER TYPE "public"."cost_sga" OWNER TO "postgres";


CREATE TYPE "public"."currency_pair" AS ENUM (
    'USDCOP',
    'USDMXN',
    'USDBRL',
    'USDPEN',
    'USDEUR'
);


ALTER TYPE "public"."currency_pair" OWNER TO "postgres";


CREATE TYPE "public"."expense_area" AS ENUM (
    'Global',
    'Growth',
    'Tech & Product',
    'Operation & Finance',
    'Student Success',
    'Learning'
);


ALTER TYPE "public"."expense_area" OWNER TO "postgres";


CREATE TYPE "public"."expense_categoria" AS ENUM (
    'Software',
    'Payroll',
    'Office',
    'Marketing',
    'Legal',
    'Accounting',
    'Travel',
    'Other'
);


ALTER TYPE "public"."expense_categoria" OWNER TO "postgres";


CREATE TYPE "public"."expense_tipo" AS ENUM (
    'Cost',
    'SGA'
);


ALTER TYPE "public"."expense_tipo" OWNER TO "postgres";


CREATE TYPE "public"."frecuencia_recurrencia" AS ENUM (
    'monthly',
    'quarterly',
    'annual',
    'one-time'
);


ALTER TYPE "public"."frecuencia_recurrencia" OWNER TO "postgres";


CREATE TYPE "public"."invoice_estado" AS ENUM (
    'Pagada',
    'Pendiente',
    'Anulada',
    'Vencida',
    'Factoring'
);


ALTER TYPE "public"."invoice_estado" OWNER TO "postgres";


CREATE TYPE "public"."liability_status" AS ENUM (
    'active',
    'paid_off',
    'suspended',
    'defaulted'
);


ALTER TYPE "public"."liability_status" OWNER TO "postgres";


CREATE TYPE "public"."liability_type" AS ENUM (
    'line_of_credit',
    'rotating_card',
    'loan',
    'other'
);


ALTER TYPE "public"."liability_type" OWNER TO "postgres";


CREATE TYPE "public"."logica_prioridad" AS ENUM (
    'Urgente',
    'Media',
    'Baja'
);


ALTER TYPE "public"."logica_prioridad" OWNER TO "postgres";


CREATE TYPE "public"."moneda_enum" AS ENUM (
    'COP',
    'USD',
    'MXN',
    'BRL',
    'EUR',
    'PEN'
);


ALTER TYPE "public"."moneda_enum" OWNER TO "postgres";


CREATE TYPE "public"."rol_vendedor" AS ENUM (
    'KAM',
    'Hunter'
);


ALTER TYPE "public"."rol_vendedor" OWNER TO "postgres";


CREATE TYPE "public"."sociedad_enum" AS ENUM (
    'hackÜ SAS',
    'hackÜ LLC',
    'hackÜ MEX',
    'hackÜ PER',
    'hackÜ BRA'
);


ALTER TYPE "public"."sociedad_enum" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."liability_movements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "liability_id" "uuid" NOT NULL,
    "fecha_movimiento" "date" NOT NULL,
    "tipo_movimiento" "text" NOT NULL,
    "monto" numeric(18,2) NOT NULL,
    "descripcion" "text",
    "balance_despues" numeric(18,2),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."liability_movements" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_liability_movement"("p_liability_id" "uuid", "p_fecha_movimiento" "text", "p_tipo_movimiento" "text", "p_monto" numeric, "p_descripcion" "text" DEFAULT NULL::"text") RETURNS SETOF "public"."liability_movements"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_old_balance   NUMERIC;
  v_new_balance   NUMERIC;
  v_movement_row  public.liability_movements;
BEGIN
  -- Lock the liability row for the duration of this transaction so that
  -- concurrent calls cannot read a stale balance before we write back.
  SELECT monto_disponible
    INTO v_old_balance
    FROM public.financial_liabilities
   WHERE id = p_liability_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Liability % not found', p_liability_id;
  END IF;

  v_old_balance := COALESCE(v_old_balance, 0);
  v_new_balance := v_old_balance;

  -- Adjust balance based on movement type
  IF p_tipo_movimiento = 'draw' THEN
    v_new_balance := v_old_balance - p_monto;
    IF v_new_balance < 0 THEN
      RAISE EXCEPTION 'Insufficient available balance for draw (available: %, requested: %)',
        v_old_balance, p_monto;
    END IF;
  ELSIF p_tipo_movimiento = 'payment' THEN
    v_new_balance := v_old_balance + p_monto;
  ELSIF p_tipo_movimiento = 'interest_charge' THEN
    v_new_balance := v_old_balance - p_monto;
  ELSE
    RAISE EXCEPTION 'Unknown tipo_movimiento: %', p_tipo_movimiento;
  END IF;

  -- Update the liability balance atomically within this transaction
  UPDATE public.financial_liabilities
     SET monto_disponible = v_new_balance,
         updated_at       = NOW()
   WHERE id = p_liability_id;

  -- Insert movement row and return it
  INSERT INTO public.liability_movements (
    liability_id,
    fecha_movimiento,
    tipo_movimiento,
    monto,
    descripcion,
    balance_despues
  ) VALUES (
    p_liability_id,
    p_fecha_movimiento::DATE,
    p_tipo_movimiento,
    p_monto,
    p_descripcion,
    v_new_balance
  )
  RETURNING * INTO v_movement_row;

  RETURN NEXT v_movement_row;
END;
$$;


ALTER FUNCTION "public"."record_liability_movement"("p_liability_id" "uuid", "p_fecha_movimiento" "text", "p_tipo_movimiento" "text", "p_monto" numeric, "p_descripcion" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$                                                                             
  BEGIN NEW.updated_at = now(); RETURN NEW; END;            
  $$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."alegra_invoice_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "alegra_invoice_id" "text",
    "alegra_client_id" "text" NOT NULL,
    "alegra_client_name" "text" NOT NULL,
    "sociedad" "text" NOT NULL,
    "moneda" "text" DEFAULT 'COP'::"text" NOT NULL,
    "fecha_emision" "date" NOT NULL,
    "fecha_vencimiento" "date" NOT NULL,
    "observaciones" "text",
    "anotaciones" "text",
    "items" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "subtotal" numeric(18,2) DEFAULT 0 NOT NULL,
    "impuestos" numeric(18,2) DEFAULT 0 NOT NULL,
    "total" numeric(18,2) DEFAULT 0 NOT NULL,
    "total_usd" numeric(18,2),
    "currency_exchange_rate" numeric(18,6),
    "status" "public"."alegra_invoice_status" DEFAULT 'borrador'::"public"."alegra_invoice_status" NOT NULL,
    "solicitante_email" "text" NOT NULL,
    "solicitante_nombre" "text" NOT NULL,
    "aprobado_por" "text",
    "fecha_aprobacion" timestamp with time zone,
    "oc_numero" "text",
    "oc_url" "text",
    "alegra_pdf_url" "text",
    "alegra_numero_factura" "text",
    "fecha_facturacion" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "vendedor_nombre" "text",
    "es_cliente_nuevo" boolean DEFAULT false NOT NULL,
    "canal_origen" "text",
    "meses_facturados" integer,
    CONSTRAINT "alegra_invoice_requests_canal_origen_check" CHECK ((("canal_origen" IS NULL) OR ("canal_origen" = ANY (ARRAY['hacku'::"text", 'hunter'::"text"]))))
);


ALTER TABLE "public"."alegra_invoice_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."aliados" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "email" "text",
    "telefono" "text",
    "porcentaje_comision" numeric(5,2),
    "activo" boolean DEFAULT true,
    "notas" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."aliados" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bank_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "banco" "text" NOT NULL,
    "tipo" "public"."bank_account_type" NOT NULL,
    "numero" "text" NOT NULL,
    "sociedad" "text" NOT NULL,
    "moneda" "text" DEFAULT 'COP'::"text" NOT NULL,
    "titular" "text",
    "activo" boolean DEFAULT true NOT NULL,
    "notas" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bank_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."channel_commission_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "canal" "text" NOT NULL,
    "porcentaje_comision" numeric DEFAULT 5 NOT NULL,
    "descripcion" "text",
    "activo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."channel_commission_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_razon_social_map" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "razon_social" "text" NOT NULL,
    "hacku_cliente_nombre" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."client_razon_social_map" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."commission_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "commission_id" "uuid",
    "action" "text" NOT NULL,
    "details" "text",
    "performed_by" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."commission_audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conceptos_gasto" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "categoria" "text",
    "es_comun" boolean DEFAULT false,
    "frecuencia_uso" integer DEFAULT 0,
    "activo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."conceptos_gasto" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre_cliente" "text" NOT NULL,
    "sociedad_cliente" "text",
    "pais" "text",
    "ciudad" "text",
    "industria" "text",
    "kam_responsable" "text",
    "plan_actual" "text",
    "tiene_factoraje" boolean DEFAULT false NOT NULL,
    "comentarios_factoraje" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "hacku_cliente_id" "uuid",
    "email" "text",
    "emails_adicionales" "text"[],
    "pronto_pago" boolean DEFAULT false,
    "dias_pago" integer,
    "razones_sociales" "text"[] DEFAULT '{}'::"text"[],
    "sociedades_hacku" "text"[] DEFAULT '{}'::"text"[],
    "moneda_default" "text" DEFAULT 'COP'::"text",
    "notas" "text"
);


ALTER TABLE "public"."customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daily_bank_balances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "fecha" "date" NOT NULL,
    "bank_account_id" "uuid" NOT NULL,
    "saldo_inicial" numeric(18,2) DEFAULT 0 NOT NULL,
    "saldo_inicial_usd" numeric(18,2),
    "saldo_cierre" numeric(18,2),
    "saldo_cierre_usd" numeric(18,2),
    "registrado_por" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."daily_bank_balances" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."expense_invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sociedad" "public"."sociedad_enum" NOT NULL,
    "tipo" "public"."expense_tipo" NOT NULL,
    "area" "public"."expense_area" NOT NULL,
    "fecha_emision" "date" NOT NULL,
    "nombre_proveedor_concepto" "text" NOT NULL,
    "moneda" "public"."moneda_enum" NOT NULL,
    "monto_sin_impuestos" numeric(18,2) NOT NULL,
    "categoria" "public"."expense_categoria" NOT NULL,
    "recurrente" boolean DEFAULT false NOT NULL,
    "frecuencia_recurrencia" "public"."frecuencia_recurrencia",
    "como_se_pagara" "text",
    "fecha_pago_o_cobro" "date",
    "moneda_pago" "public"."moneda_enum",
    "monto_pago" numeric(18,2),
    "prioridad_pago" integer,
    "logica_prioridad" "public"."logica_prioridad",
    "expectativa_pago" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "documento_url" "text",
    "proveedor_id" "uuid",
    "currency_exchange_rate" numeric(18,6),
    "local_currency_amount" numeric(18,2),
    "monto_usd" numeric(18,2),
    "categoria_nivel_2" "text",
    "centro_costo" "text",
    "proyecto" "text",
    "tags" "jsonb" DEFAULT '{}'::"jsonb",
    "concepto_id" "uuid",
    "tipo_pago_id" "uuid",
    "prioridad_id" "uuid",
    "estado" "text" DEFAULT 'Pendiente'::"text",
    CONSTRAINT "expense_invoices_estado_check" CHECK (("estado" = ANY (ARRAY['Pendiente'::"text", 'Pagada'::"text", 'Anulada'::"text"]))),
    CONSTRAINT "expense_invoices_prioridad_pago_check" CHECK (("prioridad_pago" = ANY (ARRAY[1, 2, 3])))
);


ALTER TABLE "public"."expense_invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."financial_liabilities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sociedad" "public"."sociedad_enum" NOT NULL,
    "nombre" "text" NOT NULL,
    "tipo" "public"."liability_type" NOT NULL,
    "banco" "text",
    "moneda" "public"."moneda_enum" NOT NULL,
    "monto_total" numeric(18,2),
    "monto_disponible" numeric(18,2),
    "tasa_interes" numeric(5,3),
    "fecha_inicio" "date",
    "fecha_vencimiento" "date",
    "status" "public"."liability_status" DEFAULT 'active'::"public"."liability_status" NOT NULL,
    "notas" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."financial_liabilities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hacku_clientes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "hunter_originador_id" "uuid",
    "es_negocio_nuevo_originado" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."hacku_clientes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."income_invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sociedad" "public"."sociedad_enum" NOT NULL,
    "razon_social_cliente" "text" NOT NULL,
    "hacku_cliente" "text",
    "tipo_documento" "text",
    "numero_documento" "text",
    "estado" "public"."invoice_estado" DEFAULT 'Pendiente'::"public"."invoice_estado" NOT NULL,
    "moneda" "public"."moneda_enum" NOT NULL,
    "fecha_creacion" "date" NOT NULL,
    "fecha_vencimiento" "date" NOT NULL,
    "dia_pago_cliente" integer DEFAULT 0 NOT NULL,
    "dia_adelanto_factoraje" integer,
    "tiene_factoraje" boolean DEFAULT false NOT NULL,
    "monto_no_recurrente" numeric(18,2) DEFAULT 0 NOT NULL,
    "monto_creacion_contenido" numeric(18,2) DEFAULT 0 NOT NULL,
    "monto_recurrente" numeric(18,2) DEFAULT 0 NOT NULL,
    "total_moneda_local" numeric(18,2) GENERATED ALWAYS AS ((("monto_no_recurrente" + "monto_creacion_contenido") + "monto_recurrente")) STORED,
    "total_usd" numeric(18,2),
    "meses_causados" integer,
    "fecha_inicio_causacion" "date",
    "fecha_fin_causacion" "date",
    "vendedor" "text",
    "porcentaje_comision" numeric(5,2),
    "comision_aliado" boolean DEFAULT false NOT NULL,
    "porcentaje_comision_aliado" numeric(5,2),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "documento_url" "text",
    "cliente_id" "uuid",
    "factoring_week_start" "date",
    "currency_exchange_rate" numeric(18,6),
    "local_currency_amount" numeric(18,2),
    "monto_usd" numeric(18,2),
    "plan_id" "uuid",
    "aliado_id" "uuid",
    "vendedor_id" "uuid",
    "customer_id" "uuid",
    "fecha_factoraje" "date",
    "fecha_pago_o_cobro" "date",
    "items" "jsonb" DEFAULT '[]'::"jsonb",
    "es_cliente_nuevo" boolean DEFAULT false NOT NULL,
    "canal_origen" "text",
    "meses_facturados" integer,
    "hacku_cliente_id" "uuid",
    CONSTRAINT "income_invoices_canal_origen_check" CHECK ((("canal_origen" IS NULL) OR ("canal_origen" = ANY (ARRAY['hacku'::"text", 'hunter'::"text"]))))
);


ALTER TABLE "public"."income_invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoice_commission_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "alegra_request_id" "uuid",
    "income_invoice_id" "uuid",
    "beneficiario_nombre" "text" NOT NULL,
    "rol" "text" DEFAULT 'closer'::"text" NOT NULL,
    "porcentaje" numeric(5,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."invoice_commission_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoice_item_commissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "income_invoice_id" "uuid",
    "alegra_request_id" "uuid",
    "alegra_item_id" "text" NOT NULL,
    "item_nombre" "text" NOT NULL,
    "item_precio" numeric DEFAULT 0 NOT NULL,
    "item_cantidad" numeric DEFAULT 1 NOT NULL,
    "item_subtotal" numeric DEFAULT 0 NOT NULL,
    "item_moneda" "text" DEFAULT 'COP'::"text",
    "item_subtotal_usd" numeric DEFAULT 0 NOT NULL,
    "beneficiario_nombre" "text" NOT NULL,
    "rol" "text" DEFAULT 'closer'::"text",
    "porcentaje" numeric DEFAULT 5 NOT NULL,
    "monto_comision" numeric DEFAULT 0 NOT NULL,
    "monto_comision_usd" numeric DEFAULT 0 NOT NULL,
    "monto_pagado" numeric DEFAULT 0,
    "status" "text" DEFAULT 'pendiente'::"text",
    "fecha_pago" timestamp with time zone,
    "pagado_por" "text",
    "sociedad" "text",
    "cliente_nombre" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "costo_directo" numeric DEFAULT 0,
    "tipo_negocio" "text",
    "proyecto_corto_hunter" boolean DEFAULT false NOT NULL,
    "regla_aplicada" "text"
);


ALTER TABLE "public"."invoice_item_commissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."item_commission_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "alegra_item_id" "text" NOT NULL,
    "nombre" "text" NOT NULL,
    "activo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "moneda" "text" DEFAULT 'COP'::"text",
    "precio_default" numeric(18,2)
);


ALTER TABLE "public"."item_commission_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."item_commission_ranges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "item_config_id" "uuid" NOT NULL,
    "precio_desde" numeric(18,2) DEFAULT 0 NOT NULL,
    "precio_hasta" numeric(18,2),
    "porcentaje_comision" numeric(5,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "moneda" "text" DEFAULT 'COP'::"text"
);


ALTER TABLE "public"."item_commission_ranges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."liability_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "liability_id" "uuid" NOT NULL,
    "fecha_pago" "date" NOT NULL,
    "monto_pago" numeric(18,2) NOT NULL,
    "monto_capital" numeric(18,2),
    "monto_interes" numeric(18,2),
    "estado" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "notas" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."liability_payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payroll" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "rol" "text" NOT NULL,
    "pais" "text" NOT NULL,
    "area" "public"."expense_area" NOT NULL,
    "moneda_pago" "public"."moneda_enum" NOT NULL,
    "sociedad" "public"."sociedad_enum" NOT NULL,
    "cost_sga" "public"."cost_sga" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "monthly_amounts" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "monto_usd_monthly" "jsonb" DEFAULT '{}'::"jsonb",
    "ultimo_pago" numeric(18,2) DEFAULT 0
);


ALTER TABLE "public"."payroll" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plan_commission_ranges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "plan_id" "uuid" NOT NULL,
    "moneda" "text" DEFAULT 'COP'::"text",
    "precio_desde" numeric DEFAULT 0 NOT NULL,
    "precio_hasta" numeric,
    "porcentaje_comision" numeric DEFAULT 5 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."plan_commission_ranges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."planes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "descripcion" "text",
    "activo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "alegra_item_id" "text"
);


ALTER TABLE "public"."planes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."prioridades_pago" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "nivel" integer NOT NULL,
    "descripcion" "text",
    "activo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."prioridades_pago" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."proveedores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre_proveedor" "text" NOT NULL,
    "sociedad_proveedor" "text",
    "pais" "text",
    "ciudad" "text",
    "tipo_proveedor" "text",
    "contacto_principal" "text",
    "email" "text",
    "telefono" "text",
    "banco_pago" "text",
    "cuenta_pago" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "es_comun" boolean DEFAULT false,
    "frecuencia_uso" integer DEFAULT 0
);


ALTER TABLE "public"."proveedores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recurring_invoice_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "alegra_client_id" "text",
    "alegra_client_name" "text" NOT NULL,
    "sociedad" "text" NOT NULL,
    "moneda" "text" DEFAULT 'COP'::"text" NOT NULL,
    "dia_recurrencia" integer NOT NULL,
    "dias_vencimiento" integer DEFAULT 30 NOT NULL,
    "observaciones" "text",
    "anotaciones" "text",
    "items" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "total" numeric(18,2) DEFAULT 0 NOT NULL,
    "total_usd" numeric(18,2),
    "solicitante_email" "text" NOT NULL,
    "solicitante_nombre" "text" NOT NULL,
    "vendedor_nombre" "text",
    "oc_numero" "text",
    "porcentaje_comision" numeric(5,2) DEFAULT 5,
    "tipo_documento" "text" DEFAULT 'factura'::"text",
    "activo" boolean DEFAULT true NOT NULL,
    "ultima_ejecucion" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "recurring_invoice_templates_dia_recurrencia_check" CHECK ((("dia_recurrencia" >= 1) AND ("dia_recurrencia" <= 28)))
);


ALTER TABLE "public"."recurring_invoice_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tipos_documento" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "orden" integer DEFAULT 0 NOT NULL,
    "activo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tipos_documento" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tipos_pago" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "descripcion" "text",
    "activo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tipos_pago" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trm_rates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "par" "public"."currency_pair" NOT NULL,
    "fecha" "date" NOT NULL,
    "tasa_cierre" numeric(18,6) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."trm_rates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vendedores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "email" "text",
    "rol" "public"."rol_vendedor" NOT NULL,
    "activo" boolean DEFAULT true,
    "notas" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."vendedores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vendor_commissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "income_invoice_id" "uuid",
    "tipo" "public"."commission_type" DEFAULT 'vendedor'::"public"."commission_type" NOT NULL,
    "beneficiario_nombre" "text" NOT NULL,
    "porcentaje" numeric(5,2) NOT NULL,
    "monto_base" numeric(18,2) NOT NULL,
    "monto_comision" numeric(18,2) NOT NULL,
    "moneda_comision" "text" DEFAULT 'USD'::"text" NOT NULL,
    "monto_comision_usd" numeric(18,2),
    "cuota_mes" "text",
    "cuota_numero" integer,
    "status" "public"."commission_status" DEFAULT 'pendiente'::"public"."commission_status" NOT NULL,
    "fecha_pago" timestamp with time zone,
    "pagado_por" "text",
    "notas" "text",
    "sociedad" "text",
    "cliente_nombre" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "quincena_corte" "text",
    "participant_id" "uuid",
    "rol" "text",
    "monto_pagado" numeric(18,2) DEFAULT 0
);


ALTER TABLE "public"."vendor_commissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."weekly_cashflow_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "week_start_date" "date" NOT NULL,
    "sociedad" "public"."sociedad_enum" NOT NULL,
    "estimated_cash_in" numeric(18,2) DEFAULT 0 NOT NULL,
    "realtime_cash_in" numeric(18,2),
    "estimated_cash_out" numeric(18,2) DEFAULT 0 NOT NULL,
    "realtime_cash_out" numeric(18,2),
    "net_cash_flow" numeric(18,2) GENERATED ALWAYS AS ((COALESCE("realtime_cash_in", "estimated_cash_in") - COALESCE("realtime_cash_out", "estimated_cash_out"))) STORED,
    "opening_balance" numeric(18,2),
    "closing_balance" numeric(18,2),
    "requires_additional_cash" boolean DEFAULT false NOT NULL,
    "cash_gap_usd" numeric(18,2),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "manual_cash_in_adjustment" numeric(18,2) DEFAULT 0,
    "manual_cash_out_adjustment" numeric(18,2) DEFAULT 0,
    "deficit_projected" boolean DEFAULT false,
    "surplus_projected" boolean DEFAULT false
);


ALTER TABLE "public"."weekly_cashflow_entries" OWNER TO "postgres";


ALTER TABLE ONLY "public"."alegra_invoice_requests"
    ADD CONSTRAINT "alegra_invoice_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."aliados"
    ADD CONSTRAINT "aliados_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bank_accounts"
    ADD CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."channel_commission_config"
    ADD CONSTRAINT "channel_commission_config_canal_key" UNIQUE ("canal");



ALTER TABLE ONLY "public"."channel_commission_config"
    ADD CONSTRAINT "channel_commission_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_razon_social_map"
    ADD CONSTRAINT "client_razon_social_map_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_razon_social_map"
    ADD CONSTRAINT "client_razon_social_map_razon_social_key" UNIQUE ("razon_social");



ALTER TABLE ONLY "public"."commission_audit_log"
    ADD CONSTRAINT "commission_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conceptos_gasto"
    ADD CONSTRAINT "conceptos_gasto_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_bank_balances"
    ADD CONSTRAINT "daily_balances_fecha_account_unique" UNIQUE ("fecha", "bank_account_id");



ALTER TABLE ONLY "public"."daily_bank_balances"
    ADD CONSTRAINT "daily_bank_balances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expense_invoices"
    ADD CONSTRAINT "expense_invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."financial_liabilities"
    ADD CONSTRAINT "financial_liabilities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hacku_clientes"
    ADD CONSTRAINT "hacku_clientes_nombre_key" UNIQUE ("nombre");



ALTER TABLE ONLY "public"."hacku_clientes"
    ADD CONSTRAINT "hacku_clientes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."income_invoices"
    ADD CONSTRAINT "income_invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoice_commission_participants"
    ADD CONSTRAINT "invoice_commission_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoice_item_commissions"
    ADD CONSTRAINT "invoice_item_commissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."item_commission_config"
    ADD CONSTRAINT "item_commission_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."item_commission_ranges"
    ADD CONSTRAINT "item_commission_ranges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."item_commission_config"
    ADD CONSTRAINT "item_config_alegra_id_unique" UNIQUE ("alegra_item_id");



ALTER TABLE ONLY "public"."liability_movements"
    ADD CONSTRAINT "liability_movements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."liability_payments"
    ADD CONSTRAINT "liability_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payroll"
    ADD CONSTRAINT "payroll_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plan_commission_ranges"
    ADD CONSTRAINT "plan_commission_ranges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."planes"
    ADD CONSTRAINT "planes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."prioridades_pago"
    ADD CONSTRAINT "prioridades_pago_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."proveedores"
    ADD CONSTRAINT "proveedores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recurring_invoice_templates"
    ADD CONSTRAINT "recurring_invoice_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tipos_documento"
    ADD CONSTRAINT "tipos_documento_nombre_key" UNIQUE ("nombre");



ALTER TABLE ONLY "public"."tipos_documento"
    ADD CONSTRAINT "tipos_documento_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tipos_pago"
    ADD CONSTRAINT "tipos_pago_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trm_rates"
    ADD CONSTRAINT "trm_rates_par_fecha_unique" UNIQUE ("par", "fecha");



ALTER TABLE ONLY "public"."trm_rates"
    ADD CONSTRAINT "trm_rates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vendedores"
    ADD CONSTRAINT "vendedores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vendor_commissions"
    ADD CONSTRAINT "vendor_commissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."weekly_cashflow_entries"
    ADD CONSTRAINT "weekly_cashflow_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."weekly_cashflow_entries"
    ADD CONSTRAINT "weekly_cashflow_unique" UNIQUE ("sociedad", "week_start_date");



CREATE INDEX "idx_alegra_requests_alegra_id" ON "public"."alegra_invoice_requests" USING "btree" ("alegra_invoice_id");



CREATE INDEX "idx_alegra_requests_created" ON "public"."alegra_invoice_requests" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_alegra_requests_solicitante" ON "public"."alegra_invoice_requests" USING "btree" ("solicitante_email");



CREATE INDEX "idx_alegra_requests_status" ON "public"."alegra_invoice_requests" USING "btree" ("status");



CREATE INDEX "idx_audit_commission" ON "public"."commission_audit_log" USING "btree" ("commission_id");



CREATE INDEX "idx_commissions_beneficiario" ON "public"."vendor_commissions" USING "btree" ("beneficiario_nombre");



CREATE INDEX "idx_commissions_invoice" ON "public"."vendor_commissions" USING "btree" ("income_invoice_id");



CREATE INDEX "idx_commissions_quincena" ON "public"."vendor_commissions" USING "btree" ("quincena_corte");



CREATE INDEX "idx_commissions_status" ON "public"."vendor_commissions" USING "btree" ("status");



CREATE INDEX "idx_crsm_hacku" ON "public"."client_razon_social_map" USING "btree" ("hacku_cliente_nombre");



CREATE INDEX "idx_crsm_razon" ON "public"."client_razon_social_map" USING "btree" ("razon_social");



CREATE INDEX "idx_customers_kam" ON "public"."customers" USING "btree" ("kam_responsable");



CREATE INDEX "idx_customers_sociedad_cliente" ON "public"."customers" USING "btree" ("sociedad_cliente");



CREATE INDEX "idx_customers_tiene_factoraje" ON "public"."customers" USING "btree" ("tiene_factoraje");



CREATE INDEX "idx_daily_balances_account" ON "public"."daily_bank_balances" USING "btree" ("bank_account_id");



CREATE INDEX "idx_daily_balances_fecha" ON "public"."daily_bank_balances" USING "btree" ("fecha" DESC);



CREATE INDEX "idx_expense_invoices_area" ON "public"."expense_invoices" USING "btree" ("area");



CREATE INDEX "idx_expense_invoices_categoria" ON "public"."expense_invoices" USING "btree" ("categoria");



CREATE INDEX "idx_expense_invoices_categoria_nivel_2" ON "public"."expense_invoices" USING "btree" ("categoria_nivel_2");



CREATE INDEX "idx_expense_invoices_centro_costo" ON "public"."expense_invoices" USING "btree" ("centro_costo");



CREATE INDEX "idx_expense_invoices_fecha_emision" ON "public"."expense_invoices" USING "btree" ("fecha_emision");



CREATE INDEX "idx_expense_invoices_prioridad_pago" ON "public"."expense_invoices" USING "btree" ("prioridad_pago");



CREATE INDEX "idx_expense_invoices_proyecto" ON "public"."expense_invoices" USING "btree" ("proyecto");



CREATE INDEX "idx_expense_invoices_sociedad" ON "public"."expense_invoices" USING "btree" ("sociedad");



CREATE INDEX "idx_expense_invoices_tipo" ON "public"."expense_invoices" USING "btree" ("tipo");



CREATE INDEX "idx_financial_liabilities_sociedad" ON "public"."financial_liabilities" USING "btree" ("sociedad");



CREATE INDEX "idx_financial_liabilities_status" ON "public"."financial_liabilities" USING "btree" ("status");



CREATE INDEX "idx_hacku_clientes_hunter_originador" ON "public"."hacku_clientes" USING "btree" ("hunter_originador_id");



CREATE INDEX "idx_iic_alegra_item" ON "public"."invoice_item_commissions" USING "btree" ("alegra_item_id");



CREATE INDEX "idx_iic_alegra_request" ON "public"."invoice_item_commissions" USING "btree" ("alegra_request_id");



CREATE INDEX "idx_iic_beneficiario" ON "public"."invoice_item_commissions" USING "btree" ("beneficiario_nombre");



CREATE INDEX "idx_iic_income_invoice" ON "public"."invoice_item_commissions" USING "btree" ("income_invoice_id");



CREATE INDEX "idx_iic_status" ON "public"."invoice_item_commissions" USING "btree" ("status");



CREATE INDEX "idx_income_invoices_customer_id" ON "public"."income_invoices" USING "btree" ("customer_id");



CREATE INDEX "idx_income_invoices_estado" ON "public"."income_invoices" USING "btree" ("estado");



CREATE INDEX "idx_income_invoices_estado_fecha" ON "public"."income_invoices" USING "btree" ("estado", "fecha_creacion" DESC);



CREATE INDEX "idx_income_invoices_fecha_vencimiento" ON "public"."income_invoices" USING "btree" ("fecha_vencimiento");



CREATE INDEX "idx_income_invoices_hacku_cliente_id" ON "public"."income_invoices" USING "btree" ("hacku_cliente_id");



CREATE INDEX "idx_income_invoices_moneda" ON "public"."income_invoices" USING "btree" ("moneda");



CREATE INDEX "idx_income_invoices_numero_documento" ON "public"."income_invoices" USING "btree" ("numero_documento") WHERE ("numero_documento" IS NOT NULL);



CREATE INDEX "idx_income_invoices_sociedad" ON "public"."income_invoices" USING "btree" ("sociedad");



CREATE INDEX "idx_income_invoices_tiene_factoraje" ON "public"."income_invoices" USING "btree" ("tiene_factoraje");



CREATE INDEX "idx_liability_movements_fecha" ON "public"."liability_movements" USING "btree" ("fecha_movimiento");



CREATE INDEX "idx_liability_movements_liability_id" ON "public"."liability_movements" USING "btree" ("liability_id");



CREATE INDEX "idx_liability_payments_fecha_pago" ON "public"."liability_payments" USING "btree" ("fecha_pago");



CREATE INDEX "idx_liability_payments_liability_id" ON "public"."liability_payments" USING "btree" ("liability_id");



CREATE INDEX "idx_participants_invoice" ON "public"."invoice_commission_participants" USING "btree" ("income_invoice_id");



CREATE INDEX "idx_participants_request" ON "public"."invoice_commission_participants" USING "btree" ("alegra_request_id");



CREATE INDEX "idx_payroll_active" ON "public"."payroll" USING "btree" ("active");



CREATE INDEX "idx_payroll_area" ON "public"."payroll" USING "btree" ("area");



CREATE INDEX "idx_payroll_monthly_amounts" ON "public"."payroll" USING "gin" ("monthly_amounts");



CREATE INDEX "idx_payroll_sociedad" ON "public"."payroll" USING "btree" ("sociedad");



CREATE INDEX "idx_pcr_plan" ON "public"."plan_commission_ranges" USING "btree" ("plan_id");



CREATE INDEX "idx_proveedores_sociedad" ON "public"."proveedores" USING "btree" ("sociedad_proveedor");



CREATE INDEX "idx_proveedores_tipo" ON "public"."proveedores" USING "btree" ("tipo_proveedor");



CREATE INDEX "idx_ranges_item" ON "public"."item_commission_ranges" USING "btree" ("item_config_id");



CREATE INDEX "idx_trm_rates_fecha" ON "public"."trm_rates" USING "btree" ("fecha" DESC);



CREATE INDEX "idx_trm_rates_par" ON "public"."trm_rates" USING "btree" ("par");



CREATE INDEX "idx_vendor_commissions_dedup" ON "public"."vendor_commissions" USING "btree" ("income_invoice_id", "rol", "cuota_mes");



CREATE INDEX "idx_weekly_cashflow_sociedad" ON "public"."weekly_cashflow_entries" USING "btree" ("sociedad");



CREATE INDEX "idx_weekly_cashflow_week_start_date" ON "public"."weekly_cashflow_entries" USING "btree" ("week_start_date" DESC);



CREATE OR REPLACE TRIGGER "alegra_invoice_requests_updated_at" BEFORE UPDATE ON "public"."alegra_invoice_requests" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "bank_accounts_updated_at" BEFORE UPDATE ON "public"."bank_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "daily_bank_balances_updated_at" BEFORE UPDATE ON "public"."daily_bank_balances" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "expense_invoices_updated_at" BEFORE UPDATE ON "public"."expense_invoices" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "income_invoices_updated_at" BEFORE UPDATE ON "public"."income_invoices" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "item_config_updated_at" BEFORE UPDATE ON "public"."item_commission_config" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "payroll_updated_at" BEFORE UPDATE ON "public"."payroll" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "recurring_templates_updated_at" BEFORE UPDATE ON "public"."recurring_invoice_templates" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "update_iic_updated_at" BEFORE UPDATE ON "public"."invoice_item_commissions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "vendor_commissions_updated_at" BEFORE UPDATE ON "public"."vendor_commissions" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "weekly_cashflow_updated_at" BEFORE UPDATE ON "public"."weekly_cashflow_entries" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_hacku_cliente_id_fkey" FOREIGN KEY ("hacku_cliente_id") REFERENCES "public"."hacku_clientes"("id");



ALTER TABLE ONLY "public"."daily_bank_balances"
    ADD CONSTRAINT "daily_bank_balances_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expense_invoices"
    ADD CONSTRAINT "expense_invoices_concepto_id_fkey" FOREIGN KEY ("concepto_id") REFERENCES "public"."conceptos_gasto"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."expense_invoices"
    ADD CONSTRAINT "expense_invoices_prioridad_id_fkey" FOREIGN KEY ("prioridad_id") REFERENCES "public"."prioridades_pago"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."expense_invoices"
    ADD CONSTRAINT "expense_invoices_tipo_pago_id_fkey" FOREIGN KEY ("tipo_pago_id") REFERENCES "public"."tipos_pago"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."expense_invoices"
    ADD CONSTRAINT "fk_expense_invoices_proveedor" FOREIGN KEY ("proveedor_id") REFERENCES "public"."proveedores"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."hacku_clientes"
    ADD CONSTRAINT "hacku_clientes_hunter_originador_id_fkey" FOREIGN KEY ("hunter_originador_id") REFERENCES "public"."vendedores"("id");



ALTER TABLE ONLY "public"."income_invoices"
    ADD CONSTRAINT "income_invoices_aliado_id_fkey" FOREIGN KEY ("aliado_id") REFERENCES "public"."aliados"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."income_invoices"
    ADD CONSTRAINT "income_invoices_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."income_invoices"
    ADD CONSTRAINT "income_invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."income_invoices"
    ADD CONSTRAINT "income_invoices_hacku_cliente_id_fkey" FOREIGN KEY ("hacku_cliente_id") REFERENCES "public"."hacku_clientes"("id");



ALTER TABLE ONLY "public"."income_invoices"
    ADD CONSTRAINT "income_invoices_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."planes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."income_invoices"
    ADD CONSTRAINT "income_invoices_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "public"."vendedores"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invoice_commission_participants"
    ADD CONSTRAINT "invoice_commission_participants_alegra_request_id_fkey" FOREIGN KEY ("alegra_request_id") REFERENCES "public"."alegra_invoice_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoice_commission_participants"
    ADD CONSTRAINT "invoice_commission_participants_income_invoice_id_fkey" FOREIGN KEY ("income_invoice_id") REFERENCES "public"."income_invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoice_item_commissions"
    ADD CONSTRAINT "invoice_item_commissions_alegra_request_id_fkey" FOREIGN KEY ("alegra_request_id") REFERENCES "public"."alegra_invoice_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoice_item_commissions"
    ADD CONSTRAINT "invoice_item_commissions_income_invoice_id_fkey" FOREIGN KEY ("income_invoice_id") REFERENCES "public"."income_invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."item_commission_ranges"
    ADD CONSTRAINT "item_commission_ranges_item_config_id_fkey" FOREIGN KEY ("item_config_id") REFERENCES "public"."item_commission_config"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."liability_movements"
    ADD CONSTRAINT "liability_movements_liability_id_fkey" FOREIGN KEY ("liability_id") REFERENCES "public"."financial_liabilities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."liability_payments"
    ADD CONSTRAINT "liability_payments_liability_id_fkey" FOREIGN KEY ("liability_id") REFERENCES "public"."financial_liabilities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plan_commission_ranges"
    ADD CONSTRAINT "plan_commission_ranges_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."planes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vendor_commissions"
    ADD CONSTRAINT "vendor_commissions_income_invoice_id_fkey" FOREIGN KEY ("income_invoice_id") REFERENCES "public"."income_invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vendor_commissions"
    ADD CONSTRAINT "vendor_commissions_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "public"."invoice_commission_participants"("id") ON DELETE SET NULL;



CREATE POLICY "Allow all for authenticated" ON "public"."channel_commission_config" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all for authenticated" ON "public"."client_razon_social_map" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all for authenticated" ON "public"."invoice_item_commissions" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all for authenticated" ON "public"."plan_commission_ranges" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all for authenticated" ON "public"."planes" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Anyone can manage aliados" ON "public"."aliados" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Anyone can manage conceptos_gasto" ON "public"."conceptos_gasto" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Anyone can manage vendedores" ON "public"."vendedores" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Anyone can read planes" ON "public"."planes" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Anyone can read prioridades_pago" ON "public"."prioridades_pago" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Anyone can read tipos_pago" ON "public"."tipos_pago" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."alegra_invoice_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."aliados" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "auth_all_alegra_requests" ON "public"."alegra_invoice_requests" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_all_audit" ON "public"."commission_audit_log" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_all_bank_accounts" ON "public"."bank_accounts" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_all_commissions" ON "public"."vendor_commissions" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_all_customers" ON "public"."customers" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_all_daily_balances" ON "public"."daily_bank_balances" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_all_expense_invoices" ON "public"."expense_invoices" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_all_financial_liabilities" ON "public"."financial_liabilities" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_all_hacku_clientes" ON "public"."hacku_clientes" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_all_income_invoices" ON "public"."income_invoices" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_all_item_config" ON "public"."item_commission_config" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_all_item_ranges" ON "public"."item_commission_ranges" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_all_liability_movements" ON "public"."liability_movements" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_all_liability_payments" ON "public"."liability_payments" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_all_participants" ON "public"."invoice_commission_participants" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_all_payroll" ON "public"."payroll" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_all_proveedores" ON "public"."proveedores" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_all_recurring_templates" ON "public"."recurring_invoice_templates" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_all_tipos_documento" ON "public"."tipos_documento" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_all_trm_rates" ON "public"."trm_rates" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "auth_all_weekly_cashflow" ON "public"."weekly_cashflow_entries" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."bank_accounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."channel_commission_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_razon_social_map" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commission_audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conceptos_gasto" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_bank_balances" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."expense_invoices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."financial_liabilities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."hacku_clientes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."income_invoices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoice_commission_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoice_item_commissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."item_commission_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."item_commission_ranges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."liability_movements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."liability_payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payroll" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."plan_commission_ranges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."planes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."prioridades_pago" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."proveedores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recurring_invoice_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tipos_documento" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tipos_pago" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trm_rates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vendedores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vendor_commissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."weekly_cashflow_entries" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON TABLE "public"."liability_movements" TO "anon";
GRANT ALL ON TABLE "public"."liability_movements" TO "authenticated";
GRANT ALL ON TABLE "public"."liability_movements" TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_liability_movement"("p_liability_id" "uuid", "p_fecha_movimiento" "text", "p_tipo_movimiento" "text", "p_monto" numeric, "p_descripcion" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_liability_movement"("p_liability_id" "uuid", "p_fecha_movimiento" "text", "p_tipo_movimiento" "text", "p_monto" numeric, "p_descripcion" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_liability_movement"("p_liability_id" "uuid", "p_fecha_movimiento" "text", "p_tipo_movimiento" "text", "p_monto" numeric, "p_descripcion" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


















GRANT ALL ON TABLE "public"."alegra_invoice_requests" TO "anon";
GRANT ALL ON TABLE "public"."alegra_invoice_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."alegra_invoice_requests" TO "service_role";



GRANT ALL ON TABLE "public"."aliados" TO "anon";
GRANT ALL ON TABLE "public"."aliados" TO "authenticated";
GRANT ALL ON TABLE "public"."aliados" TO "service_role";



GRANT ALL ON TABLE "public"."bank_accounts" TO "anon";
GRANT ALL ON TABLE "public"."bank_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."bank_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."channel_commission_config" TO "anon";
GRANT ALL ON TABLE "public"."channel_commission_config" TO "authenticated";
GRANT ALL ON TABLE "public"."channel_commission_config" TO "service_role";



GRANT ALL ON TABLE "public"."client_razon_social_map" TO "anon";
GRANT ALL ON TABLE "public"."client_razon_social_map" TO "authenticated";
GRANT ALL ON TABLE "public"."client_razon_social_map" TO "service_role";



GRANT ALL ON TABLE "public"."commission_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."commission_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."commission_audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."conceptos_gasto" TO "anon";
GRANT ALL ON TABLE "public"."conceptos_gasto" TO "authenticated";
GRANT ALL ON TABLE "public"."conceptos_gasto" TO "service_role";



GRANT ALL ON TABLE "public"."customers" TO "anon";
GRANT ALL ON TABLE "public"."customers" TO "authenticated";
GRANT ALL ON TABLE "public"."customers" TO "service_role";



GRANT ALL ON TABLE "public"."daily_bank_balances" TO "anon";
GRANT ALL ON TABLE "public"."daily_bank_balances" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_bank_balances" TO "service_role";



GRANT ALL ON TABLE "public"."expense_invoices" TO "anon";
GRANT ALL ON TABLE "public"."expense_invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."expense_invoices" TO "service_role";



GRANT ALL ON TABLE "public"."financial_liabilities" TO "anon";
GRANT ALL ON TABLE "public"."financial_liabilities" TO "authenticated";
GRANT ALL ON TABLE "public"."financial_liabilities" TO "service_role";



GRANT ALL ON TABLE "public"."hacku_clientes" TO "anon";
GRANT ALL ON TABLE "public"."hacku_clientes" TO "authenticated";
GRANT ALL ON TABLE "public"."hacku_clientes" TO "service_role";



GRANT ALL ON TABLE "public"."income_invoices" TO "anon";
GRANT ALL ON TABLE "public"."income_invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."income_invoices" TO "service_role";



GRANT ALL ON TABLE "public"."invoice_commission_participants" TO "anon";
GRANT ALL ON TABLE "public"."invoice_commission_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice_commission_participants" TO "service_role";



GRANT ALL ON TABLE "public"."invoice_item_commissions" TO "anon";
GRANT ALL ON TABLE "public"."invoice_item_commissions" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice_item_commissions" TO "service_role";



GRANT ALL ON TABLE "public"."item_commission_config" TO "anon";
GRANT ALL ON TABLE "public"."item_commission_config" TO "authenticated";
GRANT ALL ON TABLE "public"."item_commission_config" TO "service_role";



GRANT ALL ON TABLE "public"."item_commission_ranges" TO "anon";
GRANT ALL ON TABLE "public"."item_commission_ranges" TO "authenticated";
GRANT ALL ON TABLE "public"."item_commission_ranges" TO "service_role";



GRANT ALL ON TABLE "public"."liability_payments" TO "anon";
GRANT ALL ON TABLE "public"."liability_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."liability_payments" TO "service_role";



GRANT ALL ON TABLE "public"."payroll" TO "anon";
GRANT ALL ON TABLE "public"."payroll" TO "authenticated";
GRANT ALL ON TABLE "public"."payroll" TO "service_role";



GRANT ALL ON TABLE "public"."plan_commission_ranges" TO "anon";
GRANT ALL ON TABLE "public"."plan_commission_ranges" TO "authenticated";
GRANT ALL ON TABLE "public"."plan_commission_ranges" TO "service_role";



GRANT ALL ON TABLE "public"."planes" TO "anon";
GRANT ALL ON TABLE "public"."planes" TO "authenticated";
GRANT ALL ON TABLE "public"."planes" TO "service_role";



GRANT ALL ON TABLE "public"."prioridades_pago" TO "anon";
GRANT ALL ON TABLE "public"."prioridades_pago" TO "authenticated";
GRANT ALL ON TABLE "public"."prioridades_pago" TO "service_role";



GRANT ALL ON TABLE "public"."proveedores" TO "anon";
GRANT ALL ON TABLE "public"."proveedores" TO "authenticated";
GRANT ALL ON TABLE "public"."proveedores" TO "service_role";



GRANT ALL ON TABLE "public"."recurring_invoice_templates" TO "anon";
GRANT ALL ON TABLE "public"."recurring_invoice_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."recurring_invoice_templates" TO "service_role";



GRANT ALL ON TABLE "public"."tipos_documento" TO "anon";
GRANT ALL ON TABLE "public"."tipos_documento" TO "authenticated";
GRANT ALL ON TABLE "public"."tipos_documento" TO "service_role";



GRANT ALL ON TABLE "public"."tipos_pago" TO "anon";
GRANT ALL ON TABLE "public"."tipos_pago" TO "authenticated";
GRANT ALL ON TABLE "public"."tipos_pago" TO "service_role";



GRANT ALL ON TABLE "public"."trm_rates" TO "anon";
GRANT ALL ON TABLE "public"."trm_rates" TO "authenticated";
GRANT ALL ON TABLE "public"."trm_rates" TO "service_role";



GRANT ALL ON TABLE "public"."vendedores" TO "anon";
GRANT ALL ON TABLE "public"."vendedores" TO "authenticated";
GRANT ALL ON TABLE "public"."vendedores" TO "service_role";



GRANT ALL ON TABLE "public"."vendor_commissions" TO "anon";
GRANT ALL ON TABLE "public"."vendor_commissions" TO "authenticated";
GRANT ALL ON TABLE "public"."vendor_commissions" TO "service_role";



GRANT ALL ON TABLE "public"."weekly_cashflow_entries" TO "anon";
GRANT ALL ON TABLE "public"."weekly_cashflow_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."weekly_cashflow_entries" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































