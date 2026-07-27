# Tipo de negocio por ítem (one-time / proyecto corto) — Especificación

**ID:** 002-tipo-negocio-por-item
**Created:** 2026-07-27
**Status:** Approved (cierra el pendiente del fix #3 del code review de 001-comisiones-por-origen)

---

## 1. Problem Statement

El motor de comisiones ya soporta las tasas one-time para cliente nuevo (10% hackÜ / 15% Hunter, +3% proyecto corto gestionado por el Hunter), pero **ningún formulario permite marcar un ítem como one-time ni como proyecto corto**. El backend deriva `tipo_negocio` del plan cuando el ítem es un plan con `frecuencia_recurrencia='one-time'`, pero un ítem one-time sin esa señal cae al default `recurrente` y comisiona 20/25% en vez de 10/15% — **sobrepago ~2x silencioso** en cada venta one-time a cliente nuevo (producción de contenido, horas de desarrollo, entrenamientos).

## 2. User Scenarios & Stories

### US1: Clasificar un ítem como one-time — Priority: P1

**As a** persona de Growth creando una factura/solicitud de cliente nuevo,
**I want** marcar por ítem si es negocio recurrente u one-time,
**so that** la comisión use la tasa correcta (10/15% en vez de 20/25%).

**Acceptance Criteria:**
- **Given** una factura marcada "cliente nuevo", **When** agrego un ítem, **Then** veo un selector "Tipo de negocio" (Recurrente / One-time) por ítem.
- **Given** el ítem es un plan con `frecuencia_recurrencia='one-time'`, **When** lo selecciono, **Then** el selector se pre-llena en "One-time" (derivado del catálogo, editable).
- **Given** un ítem marcado one-time con canal Hunter, **When** se calcula la comisión (preview y guardado), **Then** la tasa es **15%**.
- **Given** la factura NO es cliente nuevo, **When** agrego ítems, **Then** el selector NO aparece (la tasa sale de rangos; el tipo no afecta).

### US2: Marcar proyecto corto gestionado por el Hunter — Priority: P1

**As a** persona de Growth,
**I want** marcar un ítem one-time como "proyecto corto gestionado por el Hunter",
**so that** se sume el +3% (13% hackÜ / 18% Hunter).

**Acceptance Criteria:**
- **Given** un ítem con tipo "One-time" en factura cliente nuevo, **When** lo veo, **Then** aparece un checkbox "Proyecto corto (Hunter)".
- **Given** el checkbox marcado con canal hackÜ, **Then** la tasa es **13%**; con canal Hunter, **18%**.
- **Given** el tipo cambia a "Recurrente", **Then** el checkbox desaparece y no aplica el +3%.

## 3. Functional Requirements

| ID | Requirement | Priority | Story |
|----|------------|----------|-------|
| FR-001 | Cada ítem de factura captura `tipo_negocio` (recurrente/one_time), visible solo cuando la factura es cliente nuevo. | P1 | US1 |
| FR-002 | El default de `tipo_negocio` se deriva del catálogo (plan one-time → one_time; resto → recurrente) y es editable. | P1 | US1 |
| FR-003 | Cada ítem one-time captura `proyecto_corto_hunter` (checkbox, solo visible si tipo=one_time). | P1 | US2 |
| FR-004 | Ambos campos fluyen al preview de comisiones y al guardado (la tasa la resuelve el servidor — FR-015 de 001). | P1 | US1/US2 |
| FR-005 | Ambos campos se persisten en el JSON de ítems de la factura para que el recálculo los respete. | P1 | US1/US2 |
| FR-006 | Aplica a los dos formularios: Solicitud de Factura (Alegra) y Facturas Ingreso. | P1 | US1 |

## 4. Success Criteria

| ID | Criteria | How to Measure |
|----|----------|----------------|
| SC-001 | Ítem one-time + Hunter → 15% (18% con proyecto corto) en preview Y en la comisión guardada. | Prueba manual en ambos forms + regla_aplicada persistida. |
| SC-002 | Ítems sin tocar el selector conservan el comportamiento actual (recurrente). | Sin cambios en tests existentes (41/41 verdes). |

## 5. Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| Factura mixta (recurrente + one-time) cliente nuevo | Cada ítem comisiona por su propio tipo. |
| Ítem "__nuevo__" (item nuevo genérico) | Default recurrente, editable a one_time. |
| Recálculo de factura editada | Lee tipo/proyecto corto del JSON de ítems (ya implementado server-side). |
| proyecto_corto_hunter=true con tipo recurrente | Se ignora (+3% solo aplica a one_time; el motor ya lo garantiza). |

## 6. Out of Scope

- Cambiar el motor `resolveCommissionRate` (ya soporta ambas ramas, con tests).
- Clasificar retroactivamente ítems de facturas históricas.
- Nueva columna en catálogo de ítems Alegra (se usa la señal del plan existente).

## 7. Dependencies

- Feature 001 (motor por origen) implementado — lo está.
- `planes.frecuencia_recurrencia` como fuente del default — existe (`getPlanes` hace `select('*')`).
- Propagación server-side de `tipo_negocio`/`proyecto_corto_hunter` — ya implementada (fix #3).
