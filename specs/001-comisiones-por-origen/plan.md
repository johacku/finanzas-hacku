# Comisiones por origen del negocio — Implementation Plan

**Spec:** 001-comisiones-por-origen/spec.md
**Created:** 2026-07-26
**Status:** Draft

---

## 1. Technical Context

| Aspect | Decision |
|--------|----------|
| Language/Framework | Next.js 14 (App Router) + React 18 + TypeScript strict |
| Database | Supabase (PostgreSQL) via `@supabase/ssr` |
| Data Layer | Server Actions (`src/actions/*.actions.ts`, `'use server'`) + Supabase queries |
| Migrations | Manual SQL en `supabase/migrations/NNN_*.sql`, aplicadas a mano en el SQL Editor (sin CLI). Regenerar `src/types/database.types.ts` a mano tras cada cambio. |
| Testing | No hay test runner de app. Hay tests puros de la lógica de comisiones: `src/lib/commission-math.test.ts` (patrón a seguir para lógica nueva). |
| Cron | `vercel.json` → `/api/cron/*`; self-guard con `CRON_SECRET`. Recurrencia mensual ya existe. |
| Key Conventions | Español en dominio/UI/columnas. `Ü` en sociedades. Server-side resuelve tasas (nunca confiar en frontend). Service-role en crons/backfill para saltar RLS (ver commits recientes). |

## 2. Constitution Compliance

> No existe `specs/constitution.md`. N/A.

## 3. Phase 0 — Hallazgos de research (resuelve los [NEEDS CLARIFICATION] del spec)

**Modelo de datos actual relevante:**
- `income_invoices`: tiene `items jsonb`, `monto_recurrente`, `monto_no_recurrente`, `porcentaje_comision`, `vendedor`/`vendedor_id`. (`034`, `database.types.ts:476-555`)
- `planes` + `plan_commission_ranges` (`038`): rangos por precio/moneda por plan → **licencias/planes recurrentes**.
- `item_commission_config` + `item_commission_ranges` (`032`): rangos por precio por ítem Alegra genérico.
- `invoice_item_commissions` (`034`): comisión por ítem, con `porcentaje`, `rol` (closer/…), `beneficiario_nombre`, base en USD.
- `vendedores.rol` ∈ {KAM, Hunter} (`014`).
- `channel_commission_config` (`039`): tasas por canal de adquisición (Directo/Referido/Aliado/…). **Reutilizable como semilla del concepto "canal", pero el requerimiento define un eje nuevo `hacku`/`hunter`.**
- Recurrencia 1% Hunter: `recurring-commissions.actions.ts` + cron mensual. Hoy dispara por `vendedor.rol='Hunter'` + `monto_recurrente>0`. **Debe migrar a disparar por `cliente.hunter_originador_id`.**
- Lógica pura: `src/lib/commission-math.ts` (`commissionPercentForPrice`, `recurringAmountUsd`, `DEFAULT_COMMISSION_PERCENT=5`).

**Resoluciones:**
- **Recurrente vs one-time:** NO existe un campo explícito `tipo_negocio`. Hoy se infiere del ítem/plan. **Decisión:** clasificar a nivel de **item de comisión** con un campo `tipo_negocio` derivado del plan/ítem (recurrente si el ítem está ligado a un `plan` con `frecuencia_recurrencia != 'one-time'`; one-time en caso contrario), persistido en `invoice_item_commissions` para trazabilidad. Ver ADR-2.
- **Implementación vs primer mes recurrente:** `income_invoices` ya separa `monto_no_recurrente` (implementación/one-time) y `monto_recurrente` (mensualidad). La tasa de negocio nuevo (20/25/30/35) aplica a **ambos** montos de la factura del cliente nuevo, tal como dice la política ("X% del valor de la implementación + X% del primer mes"). El 1% perpetuo aplica solo a `monto_recurrente` en meses ≥ 2.

## 4. Architecture Decisions

### ADR-1: Motor de resolución de tasa por reglas, server-side, con precedencia explícita
- **Context:** Hoy la tasa sale de rangos por precio. El requerimiento añade ejes: `es_cliente_nuevo`, `canal_origen`, `meses_facturados`, `tipo_negocio`. Necesitamos un punto único de decisión.
- **Options:**
  - A: Ampliar `commission-math.ts` con una función pura `resolveCommissionRate(context)` que reciba todo el contexto y devuelva `{ porcentaje, regla }`. — Testeable, un solo lugar, sigue el patrón existente.
  - B: Esparcir condicionales en `item-commissions.actions.ts` y `recurring-commissions.actions.ts`. — Rápido pero frágil y no testeable.
- **Decision:** A.
- **Rationale:** `commission-math.ts` ya es el hogar de la lógica pura y tiene tests. Concentrar la precedencia (cliente nuevo por canal ⟶ override; si no, rangos por precio) en una función pura elimina ambigüedad y da trazabilidad (`regla`).

**Precedencia de la tasa (recurrente):**
1. `es_cliente_nuevo == true` y `tipo_negocio == 'recurrente'` → tasa por canal: `hacku` = 20%, `hunter` = 25%; si `meses_facturados >= 6` → 30% / 35%.
2. `es_cliente_nuevo == true` y `tipo_negocio == 'one_time'` → `hacku` = 10%, `hunter` = 15%; `+3%` si `proyecto_corto_hunter`.
3. En cualquier otro caso → **lógica actual de rangos por precio/ARPU** (sin cambios).

### ADR-2: `tipo_negocio` derivado y persistido en `invoice_item_commissions`
- **Context:** Se necesita distinguir recurrente/one-time por ítem para elegir la rama de tasa.
- **Decision:** Añadir `tipo_negocio text` (recurrente | one_time) y `proyecto_corto_hunter boolean` a `invoice_item_commissions`, poblados al calcular. Derivar el default del plan/ítem; permitir override manual en el editor (P2).
- **Rationale:** Mantiene la decisión trazable por ítem y no obliga a normalizar el catálogo de ítems ahora.

### ADR-3: Atribución del Hunter originador a nivel de cliente
- **Context:** El 1% perpetuo debe seguir al Hunter aunque cambie el gestor; no puede vivir en la factura ni en el rol del vendedor.
- **Decision:** Añadir `hunter_originador_id` (FK a `vendedores`) y `es_negocio_nuevo_originado boolean` en la tabla de clientes (`hacku_clientes`). El cron de recurrencia pasa a disparar por este campo, no por `vendedor.rol`.
- **Rationale:** Es el único lugar estable. Persistente ante cambios de gestor. Excepción cuenta-existente = `es_negocio_nuevo_originado=false`.

### ADR-4: Regla "misma persona Hunter+KAM no suma"
- **Context:** Si el originador es también participante KAM de la factura, solo se paga KAM.
- **Decision:** En la generación del 1% recurrente, si el `hunter_originador_id` coincide (por vendedor) con un participante que ya comisiona como KAM/closer en la facturación de ese mes, **suprimir** la fila del 1%.
- **Rationale:** Evita doble pago a la misma persona (FR-010). Se resuelve en el generador de recurrencia comparando identidades.

## 5. Files to Create/Modify

```
# Migraciones (nuevas, aplicar a mano en Supabase SQL Editor)
supabase/migrations/041_invoice_origin_fields.sql          # income_invoices: es_cliente_nuevo, canal_origen, meses_facturados
supabase/migrations/042_client_hunter_originador.sql       # hacku_clientes: hunter_originador_id, es_negocio_nuevo_originado
supabase/migrations/043_item_commission_tipo_negocio.sql   # invoice_item_commissions: tipo_negocio, proyecto_corto_hunter, regla_aplicada

# Tipos
src/types/database.types.ts                                # regenerar/editar a mano con las columnas nuevas

# Lógica pura (núcleo)
src/lib/commission-math.ts                                 # + resolveCommissionRate(context) => { porcentaje, regla }
src/lib/commission-math.test.ts                            # + casos por origen (20/25/30/35, 10/15/+3, fallback rangos)

# Server actions
src/actions/item-commissions.actions.ts                    # usar resolveCommissionRate en saveItemCommissions/recalculate
src/actions/recurring-commissions.actions.ts               # disparar 1% por hunter_originador_id; regla no-suma (ADR-4); excepción cuenta existente
src/actions/commissions.actions.ts                         # exponer regla_aplicada en lecturas
src/actions/<clientes>.actions.ts                          # set/preserve hunter_originador (no sobrescribir)

# UI
src/components/alegra/alegra-invoice-request-form.tsx      # flags: cliente nuevo + canal (hacku/hunter) + meses_facturados (ya hay UI parcial en Slack screenshot)
src/components/comisiones/comisiones-client.tsx            # mostrar regla_aplicada (FR-014, P2)
src/components/comisiones/commission-participants-editor.tsx # (P2) override tipo_negocio/proyecto corto por ítem

# Cron (sin archivo nuevo; ajustar lógica invocada)
src/app/api/cron/recurring-commissions/route.ts            # usa la nueva atribución por cliente
```

## 6. Implementation Phases

### Phase 1: Data & Contracts
- Migración `041`: `income_invoices.es_cliente_nuevo boolean default false`, `canal_origen text` (`hacku`|`hunter`, nullable), `meses_facturados int nullable`.
- Migración `042`: `hacku_clientes.hunter_originador_id uuid references vendedores(id)`, `es_negocio_nuevo_originado boolean default false`.
- Migración `043`: `invoice_item_commissions.tipo_negocio text`, `proyecto_corto_hunter boolean default false`, `regla_aplicada text`.
- Regenerar `database.types.ts`.

### Phase 2: Core Logic
- `resolveCommissionRate(context)` en `commission-math.ts` con precedencia de ADR-1 + tests.
- Integrar en `item-commissions.actions.ts` (`saveItemCommissions`, `recalculateInvoiceCommissions`): resolver tasa por ítem según flags de la factura y `tipo_negocio`; poblar `regla_aplicada`. Preservar rama de rangos cuando no es cliente nuevo.
- `recurring-commissions.actions.ts`: disparar el 1% por `cliente.hunter_originador_id` + `es_negocio_nuevo_originado=true`; aplicar ADR-4 (no-suma) y excepción cuenta existente.
- Set/preserve `hunter_originador_id` al crear factura "cliente nuevo — hunter".

### Phase 3: Interface Layer
- Form de solicitud/factura: checkbox "cliente nuevo", selector canal (`Traído por hackÜ 20%` / `Traído por Hunter 25%`), input `meses_facturados`. Validar canal requerido si cliente nuevo (edge case).
- Enviar solo flags al server (FR-015).

### Phase 4: Quality & Polish
- Tests de `resolveCommissionRate` (todos los ramos + SC-005 regresión).
- Mostrar `regla_aplicada` en la vista de comisiones (FR-014).
- Backfill opcional de `hunter_originador_id` para clientes existentes marcados como negocio nuevo (script one-off tipo `backfill-*`, service-role).

## 7. Complexity Check

| Component | Complexity | Justification |
|-----------|-----------|---------------|
| `resolveCommissionRate` (pura) | Medium | Concentra toda la precedencia; sustituye condicionales dispersos. Testeable. |
| Migraciones | Simple | Columnas aditivas con defaults seguros; no rompen facturas existentes. |
| Atribución Hunter originador | Medium | Nuevo eje persistente + ajuste del cron. Necesario para el 1% perpetuo. |
| Regla no-suma (ADR-4) | Medium | Comparación de identidades en el generador de recurrencia; hay que definir "misma persona" (por `vendedor_id`). |
| UI form | Simple | Flags + selector; parte ya existe. |

> Anti-complejidad: la clasificación recurrente/one-time se deriva con un default simple y se permite override sólo en P2. No se normaliza el catálogo de ítems ahora.

## 8. Migration & Rollback

- **Deploy steps:** aplicar `041`→`042`→`043` en SQL Editor → regenerar tipos → merge de código → correr backfill opcional.
- **Rollback:** las columnas son aditivas con default; el código nuevo cae al camino de rangos por precio cuando `es_cliente_nuevo=false`. Revertir el código restaura el comportamiento actual sin tocar datos. Drops de columnas solo si es imprescindible.
- **Data migration:** backfill de `hunter_originador_id` es opcional y no destructivo.

## 9. Risks

| Risk | Impact | Prob | Mitigation |
|------|--------|------|------------|
| Regresión en facturas "cliente existente" | H | M | SC-005: tests de regresión comparando salida antes/después; el default `es_cliente_nuevo=false` conserva la rama de rangos. |
| Doble pago misma persona (Hunter+KAM) | M | M | ADR-4 explícito + test dedicado. |
| Clasificación recurrente/one-time incorrecta | M | M | Default derivado + override manual (P2) + `regla_aplicada` para auditar. |
| Cron recurrente genera 1% donde no debe (cuenta existente) | M | M | Disparar solo con `es_negocio_nuevo_originado=true`; test del caso cuenta existente. |
| `database.types.ts` desincronizado | M | M | Regenerar/editar a mano tras cada migración (convención repo). |
