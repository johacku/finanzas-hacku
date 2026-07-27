# Comisiones por origen del negocio (Hunter / KAM) — Especificación

**ID:** 001-comisiones-por-origen
**Created:** 2026-07-26
**Status:** Review

---

## 1. Problem Statement

El motor de comisiones actual calcula la comisión de las licencias **por rango de precio/ARPU** (4%–5% según el país y el valor de la venta). Esta lógica es correcta para el escenario **KAM sobre cuenta existente**, pero **obvia condicionales críticos** de las políticas de comisiones de hackÜ cuando el negocio es **nuevo**:

- Un mismo ítem (ej. "Licencia PRO" con idéntico pricing) debe comisionar **5% si es una cuenta ya existente** (rango ARPU, gestión KAM) pero **20% ó 25% si es un cliente nuevo** — porque un cliente nuevo se comisiona por política de "negocio nuevo", no por rango de precio.
- La tasa de negocio nuevo depende de **por qué canal ingresó** el cliente: **20% traído por hackÜ**, **25% traído por el Hunter** — **no del rol** de quien lo cierra (un KAM también puede cerrar clientes nuevos).
- Si la factura del cliente nuevo abarca **6 o más meses**, la comisión de implementación sube a **30% (hackÜ)** / **35% (Hunter)**.
- El Hunter que **origina** un cliente nuevo debe comisionar **1% de toda la facturación recurrente futura a perpetuidad** (desde el 2º mes), aunque después la cuenta la gestione un KAM.

Hoy el equipo de Growth calcula estos casos **a mano** o los aproxima mal con los rangos de ARPU, generando comisiones incorrectas y disputas. Esto afecta al **equipo comercial (Hunters y KAMs)** y al **equipo de Growth/Finanzas** que liquida.

> Fuente de verdad (confirmado con negocio, 2026-07-23/26):
> - La tasa de licencias en modo "cliente nuevo" **NO depende del rol** (KAM/Hunter), sino de dos flags: **(a) cliente nuevo** y **(b) canal de origen** (hackÜ vs Hunter).
> - El **1% recurrente perpetuo** sigue al **Hunter originador**, aunque la cuenta pase a un KAM. **NO aplica** si el Hunter factura sobre una **cuenta ya existente** con facturación previa. Si la **misma persona** es Hunter que además funge como KAM, **nunca se suman**: solo se paga la comisión de KAM.

## 2. User Scenarios & Stories

### US1: Facturar un cliente nuevo con comisión fija por canal — Priority: P1

**As a** persona de Growth que crea una solicitud/factura de ingreso,
**I want** marcar una factura como "cliente nuevo" y elegir el canal de origen (hackÜ / Hunter),
**so that** la comisión de negocio recurrente (licencias, planes de asistente, Retos IA) se calcule al 20%/25% en vez del rango de ARPU.

**Acceptance Criteria:**
- **Given** una factura de licencias marcada como "cliente nuevo" con canal = "Traído por hackÜ",
  **When** se calcula la comisión,
  **Then** la tasa aplicada es **20%** sobre el valor de la implementación + 20% del primer mes del plan recurrente, y **NO** se usa el rango de ARPU.
- **Given** la misma factura con canal = "Traído por Hunter",
  **When** se calcula,
  **Then** la tasa aplicada es **25%**.
- **Given** una factura de licencias **NO** marcada como "cliente nuevo",
  **When** se calcula,
  **Then** se mantiene la lógica actual de rango por precio/ARPU (4%–5% por país).

### US2: Bump de comisión por facturas de 6+ meses — Priority: P1

**As a** persona de Growth,
**I want** indicar el número de meses que abarca la factura del cliente nuevo,
**so that** la comisión de negocio nuevo suba automáticamente cuando la factura cubre 6 o más meses.

**Acceptance Criteria:**
- **Given** una factura "cliente nuevo", canal hackÜ, con **meses facturados ≥ 6**,
  **When** se calcula,
  **Then** la tasa es **30%** (en vez de 20%).
- **Given** una factura "cliente nuevo", canal Hunter, con **meses facturados ≥ 6**,
  **When** se calcula,
  **Then** la tasa es **35%** (en vez de 25%).
- **Given** meses facturados < 6 (o sin especificar),
  **When** se calcula,
  **Then** se usan las tasas base 20%/25%.

### US3: 1% recurrente perpetuo al Hunter originador — Priority: P1

**As a** Hunter que originó un cliente nuevo,
**I want** recibir el 1% de toda la facturación recurrente de esa cuenta a perpetuidad desde el 2º mes,
**so that** se me reconozca la originación aunque la cuenta la gestione después un KAM.

**Acceptance Criteria:**
- **Given** un cliente marcado con un **Hunter originador**,
  **When** el cron mensual de recurrencia corre a partir del 2º mes,
  **Then** se genera una comisión de **1% sobre la facturación recurrente** a nombre del Hunter originador, **independientemente de quién gestione la cuenta** en ese momento.
- **Given** una cuenta **ya existente** con facturación previa sobre la que un Hunter factura,
  **When** se evalúa la recurrencia,
  **Then** **NO** se genera el 1% (no es negocio nuevo originado).
- **Given** un cliente cuyo Hunter originador es **la misma persona** que actúa como KAM en la factura,
  **When** se calcula,
  **Then** se paga **solo la comisión de KAM** y **NO** el 1% (nunca se suman para la misma persona).

### US4: Marcar el Hunter originador a nivel de cliente — Priority: P1

**As a** persona de Growth,
**I want** registrar qué Hunter originó cada cliente (y si es negocio nuevo),
**so that** el 1% perpetuo se atribuya de forma persistente aunque cambie el gestor.

**Acceptance Criteria:**
- **Given** un cliente sin Hunter originador,
  **When** creo una factura marcada "cliente nuevo — Hunter",
  **Then** el sistema propone/persiste el Hunter originador en el cliente.
- **Given** un cliente que ya tiene Hunter originador,
  **When** se factura de nuevo,
  **Then** el originador **no** se sobrescribe silenciosamente (se preserva la atribución original).

### US5: Negocios "one time" con reglas de origen — Priority: P2

**As a** persona de Growth,
**I want** que los negocios one-time (producción de contenido, horas de desarrollo, campañas one-time, entrenamientos) usen las tasas de origen correctas,
**so that** se comisionen 10% (hackÜ) / 15% (Hunter), con +3% si es proyecto corto gestionado por el Hunter.

**Acceptance Criteria:**
- **Given** un ítem one-time en factura "cliente nuevo", canal hackÜ,
  **When** se calcula,
  **Then** la tasa es **10%** del valor de la factura.
- **Given** el mismo ítem con canal Hunter,
  **Then** la tasa es **15%**.
- **Given** un one-time marcado como "proyecto corto gestionado por el Hunter",
  **Then** se **suma 3%** a la tasa aplicable en ambos casos (13% / 18%).

### US6: Transparencia del cálculo — Priority: P2

**As a** persona de Growth que revisa la liquidación,
**I want** ver por qué una comisión aplicó una tasa (regla, canal, meses, origen),
**so that** pueda auditar y explicar cada monto al comercial.

**Acceptance Criteria:**
- **Given** una comisión calculada por regla de origen,
  **When** la reviso en la vista de comisiones,
  **Then** veo la **regla aplicada** (ej. "Cliente nuevo · Hunter · 6+ meses → 35%") y la base sobre la que se aplicó.

> **Priority guide:** P1 = MVP (US1–US4: sin esto la feature no tiene valor). P2 = siguiente iteración (US5–US6).

## 3. Functional Requirements

| ID | Requirement | Priority | Story |
|----|------------|----------|-------|
| FR-001 | Una factura de ingreso puede marcarse como **"cliente nuevo"** (flag booleana). | P1 | US1 |
| FR-002 | Una factura "cliente nuevo" tiene un **canal de origen**: `hacku` (20%) o `hunter` (25%). | P1 | US1 |
| FR-003 | Para ítems de **negocio recurrente** (licencias, planes de asistente, Retos IA) en factura "cliente nuevo", la comisión usa la **tasa fija por canal** y **omite** el cálculo por rango de precio/ARPU. | P1 | US1 |
| FR-004 | Si la factura **NO** es "cliente nuevo", se conserva **intacta** la lógica actual de rangos por precio/ARPU. | P1 | US1 |
| FR-005 | Una factura "cliente nuevo" captura el **número de meses facturados**. | P1 | US2 |
| FR-006 | Si meses facturados **≥ 6**, la tasa de negocio recurrente sube a **30% (hacku)** / **35% (hunter)**. | P1 | US2 |
| FR-007 | Un **cliente** puede tener un **Hunter originador** persistente y una marca de **negocio nuevo originado**. | P1 | US4 |
| FR-008 | El proceso mensual de recurrencia genera **1%** sobre la facturación recurrente a nombre del **Hunter originador**, desde el 2º mes, a perpetuidad. | P1 | US3 |
| FR-009 | El 1% recurrente **NO** se genera si la cuenta ya existía con facturación previa (no fue originada como negocio nuevo). | P1 | US3 |
| FR-010 | Si el Hunter originador es la **misma persona** que actúa como KAM/participante en la factura, se paga **solo la comisión de KAM** y **no** el 1% (no se suman). | P1 | US3 |
| FR-011 | La atribución del Hunter originador **no se sobreescribe** una vez fijada. | P1 | US4 |
| FR-012 | Ítems **one-time** en "cliente nuevo" usan **10% (hacku)** / **15% (hunter)**. | P2 | US5 |
| FR-013 | Un ítem one-time puede marcarse como **"proyecto corto gestionado por Hunter"** → **+3%** sobre la tasa. | P2 | US5 |
| FR-014 | La vista de comisiones muestra la **regla/tasa aplicada** y su base para cada comisión calculada por origen. | P2 | US6 |
| FR-015 | El cálculo de comisiones **nunca** confía en el porcentaje enviado por el frontend: la tasa se resuelve en el servidor a partir de las flags. | P1 | US1 |

## 4. Key Entities

| Entity | Description | Key Attributes |
|--------|------------|----------------|
| Factura de ingreso | La factura que dispara comisiones. Ya existe. | `es_cliente_nuevo` (nuevo), `canal_origen` (nuevo), `meses_facturados` (nuevo) |
| Ítem de factura | Línea de la factura; determina el tipo de negocio (recurrente/one-time). | `tipo_negocio` (recurrente / one_time), `proyecto_corto_hunter` (nuevo, one-time) |
| Cliente | Cuenta a la que se factura. Ya existe. | `hunter_originador_id` (nuevo), `es_negocio_nuevo_originado` (nuevo) |
| Vendedor | Persona del equipo comercial. Ya existe con `rol` (KAM/Hunter). | `rol` (existente) |
| Comisión | Registro de comisión calculada. Ya existe. | `regla_aplicada` (nuevo, trazabilidad), `rol` (closer/recurrencia/…) |
| Participante de factura | Beneficiario que comparte comisión. Ya existe. | `beneficiario`, `porcentaje`, `rol` |

## 5. Success Criteria

| ID | Criteria | How to Measure |
|----|----------|----------------|
| SC-001 | Una licencia idéntica comisiona 5% (cliente existente) vs 20%/25% (cliente nuevo) según las flags. | Caso de prueba con dos facturas del mismo ítem y flags distintas → tasas 5% vs 20%/25%. |
| SC-002 | El bump de 6+ meses aplica 30%/35% automáticamente. | Caso de prueba: factura cliente nuevo, 6 meses → 30% (hacku) / 35% (hunter). |
| SC-003 | El 1% perpetuo se atribuye al Hunter originador aunque cambie el gestor. | Caso de prueba: cambiar gestor a KAM, correr cron → comisión 1% sigue al Hunter originador. |
| SC-004 | La misma persona Hunter+KAM nunca recibe 1% + KAM sumados. | Caso de prueba: originador == participante KAM → solo comisión KAM. |
| SC-005 | Facturas "cliente existente" mantienen exactamente las comisiones que producían antes. | Comparar salida del motor antes/después sobre un set de facturas existentes → sin diferencias. |

## 6. Edge Cases & Error Handling

| Scenario | Expected Behavior |
|----------|-------------------|
| Factura "cliente nuevo" sin canal de origen seleccionado | Bloquear guardado / no calcular tasa de origen hasta elegir canal (validación). |
| Factura mixta (ítems recurrentes + one-time) marcada "cliente nuevo" | Cada ítem aplica su regla según su `tipo_negocio` (recurrente → 20/25/30/35; one-time → 10/15 +3%). |
| `meses_facturados` vacío o < 6 en cliente nuevo | Usar tasas base (20/25), sin bump. |
| Cliente nuevo sin Hunter originador pero canal = hunter | Requerir/derivar el Hunter originador desde el vendedor/participante Hunter; si no hay, marcar `[NEEDS CLARIFICATION]` y no generar 1%. |
| Hunter originador ya existe y llega otra factura "cliente nuevo" con otro Hunter | Preservar el originador original; registrar advertencia, no sobrescribir. |
| Cuenta existente con facturación previa facturada por un Hunter | No generar 1% (FR-009). |
| Originador == participante KAM (misma persona) | Solo comisión KAM (FR-010). |
| Recálculo de una factura ya liquidada (status pagada) | No recalcular tasas de comisiones ya pagadas; solo afectar pendientes. |

## 7. Assumptions & Constraints

- El sistema ya tiene: roles `KAM`/`Hunter` en `vendedores`, participantes multi-beneficiario por factura, rangos de comisión por precio, recurrencia Hunter 1% (cron mensual) y bonus link de pago. Esta feature **extiende** ese motor, no lo reemplaza.
- Multi-moneda (COP/USD/MXN/BRL/EUR): las tasas fijas por canal son porcentajes, independientes de moneda; la base se convierte a USD con la lógica de conversión existente.
- El cálculo de tasa se resuelve **en el servidor** (server actions), nunca se confía en el frontend (FR-015).
- La lógica de negocio recurrente vs one-time se determina por el **tipo del ítem/plan**, no por la factura completa.
- [NEEDS CLARIFICATION → RESUELTO] Fuente de verdad de la tasa = flags `es_cliente_nuevo` + `canal_origen`, no el rol.
- [NEEDS CLARIFICATION → RESUELTO] 1% perpetuo sigue al Hunter originador; excepciones: cuenta existente y misma-persona-KAM.
- [NEEDS CLARIFICATION] ¿Cómo se clasifica un ítem como "recurrente" vs "one-time" y "proyecto corto" hoy en el modelo de datos? (Se resolverá en Phase 0 del plan leyendo `item_commission_config`/planes.)
- [NEEDS CLARIFICATION] La política Hunter separa "valor de la implementación" (one-time inicial) del "primer mes del plan recurrente". ¿El modelo de factura hoy distingue implementación vs mensualidad, o llega como `monto_no_recurrente` + `monto_recurrente`? (Se valida en Phase 0.)

## 8. Out of Scope

- Cambiar las políticas de comisiones de KAM/Hunter (son insumo fijo).
- Rediseñar la UI de comisiones más allá de mostrar la regla aplicada (FR-014).
- Comisiones de aliados, pronto pago y link de pago (ya existen; no se modifican salvo que colisionen).
- Recalcular retroactivamente comisiones históricas ya pagadas.
- Reglas de "casos especiales" (5% sobre rentabilidad bruta, Comfama/Bavaria) — ya existe `costo_directo`; no se toca en esta entrega.

## 9. Dependencies

- Tablas y acciones existentes de comisiones (`vendor_commissions`, `invoice_item_commissions`, `plan_commission_ranges`, `channel_commission_config`).
- `vendedores.rol`, `clientes`, `income_invoices`, participantes.
- Cron mensual de recurrencia (`/api/cron/recurring-commissions`).
- Regeneración de `src/types/database.types.ts` tras las migraciones (workflow manual, sin CLI).

## 10. Security & Performance

- La resolución de tasa ocurre server-side; el frontend solo envía flags, nunca el porcentaje final (FR-015).
- Migraciones aplicadas a mano en el SQL Editor de Supabase (convención del repo); columnas nuevas con defaults seguros para no romper facturas existentes.
- Sin impacto de performance relevante: el cálculo es por-factura/por-ítem; el 1% perpetuo corre en el cron mensual ya existente.
- Las facturas "cliente existente" deben producir **exactamente** las mismas comisiones que hoy (SC-005) — evitar regresiones.
