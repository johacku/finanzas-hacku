# División de comisiones entre participantes (reparto por share) — Especificación

**ID:** 003-division-comisiones-reparto
**Created:** 2026-07-28
**Status:** Draft

---

## 1. Problem Statement

En el formulario de factura de ingreso (y en la solicitud de factura Alegra), la sección
**"Comisiones por KAM/Aliado"** permite asignar varios beneficiarios a una factura, cada uno
con un porcentaje. Hoy ese porcentaje se interpreta mal: la herramienta le aplica a **cada**
participante la **tasa completa** de comisión resuelta para el item, en lugar de **repartir**
una única comisión entre ellos.

Ejemplo real reportado (Simón Bravo, feedback del equipo):
- Item `hackÜ PRO`, subtotal 1.000.000 COP, tasa de comisión resuelta = 5% → comisión = 50.000 COP.
- Se asignan Mateo (50%) y Paola (50%), con la intención de **repartir** esos 50.000 (25k y 25k).
- **Resultado actual (incorrecto):** Mateo recibe 5% (50.000) y Paola 5% (50.000) → total 100.000 COP.
- **Resultado esperado:** Mateo 25.000 + Paola 25.000 → total 50.000 COP (2,5% + 2,5% efectivo).

Causa raíz confirmada en código: en `calculateItemCommissions`
(`src/actions/item-commissions.actions.ts:112-117`) el `%` del participante (`p.porcentaje`)
se **ignora** y se usa `pct = itemPct` (la tasa completa del item) para cada participante.
El mismo error se repite al persistir en `saveItemCommissions`
(`src/actions/item-commissions.actions.ts:225-227`), que recalcula `subtotal * verifiedPct/100`
por fila sin aplicar ningún reparto. No existe hoy una columna que distinga la **tasa del item**
del **share de reparto** del participante.

Impacto: todas las facturas con 2+ participantes duplican (o multiplican por N) el gasto de
comisiones registrado, tanto en el preview como en los datos persistidos y en los reportes de la
vista de comisiones.

## 2. User Scenarios & Stories

### US1: Repartir una comisión entre varios beneficiarios por porcentaje seleccionable — Priority: P1

**As a** persona de finanzas/comercial que registra una factura,
**I want** repartir la comisión ya resuelta de cada item entre varios participantes con
porcentajes que yo elijo (no forzados a 50/50),
**so that** el gasto total de comisión sea el mismo (la tasa del item) y solo cambie cómo se
divide entre las personas.

**Acceptance Criteria:**
- **Given** un item con subtotal 1.000.000 COP y tasa resuelta 5% (comisión = 50.000 COP),
  **When** asigno Mateo 50% y Paola 50%,
  **Then** el desglose muestra Mateo 25.000 COP y Paola 25.000 COP, y el total de comisiones del
  item es 50.000 COP (no 100.000).
- **Given** ese mismo item,
  **When** digito Simón 70% y Pilar 30%,
  **Then** Simón recibe 35.000 COP y Pilar 15.000 COP, total 50.000 COP.
- **Given** el ejemplo del hunter que gana 20% y quiere repartir,
  **When** asigno Simón 75% y Pilar 25% (equivalente a "Simón 15%, Pilar 5%" de un 20%),
  **Then** los montos reparten exactamente la comisión del 20% del item, sin exceder ese total.

### US2: Validar que el reparto siempre sume 100% — Priority: P1

**As a** persona que registra la factura,
**I want** que la herramienta me exija que los porcentajes de los participantes sumen 100%,
**so that** la comisión resuelta se reparta completa, sin sobrar ni faltar y sin duplicarla.

**Acceptance Criteria:**
- **Given** participantes cuyos porcentajes suman ≠ 100% (p.ej. 50% + 40% = 90%, o 60% + 60% = 120%),
  **When** intento guardar la factura,
  **Then** la herramienta bloquea el guardado y muestra un aviso claro indicando que el reparto
  debe sumar 100%.
- **Given** participantes cuyos porcentajes suman exactamente 100%,
  **When** guardo,
  **Then** el guardado procede.
- **Given** el editor con la suma actual,
  **When** la suma es distinta de 100%,
  **Then** el indicador "Total comisión" se muestra en estado de error (rojo/aviso) en vivo.

### US3: Ver el reparto correcto en el preview y en los datos guardados — Priority: P1

**As a** persona de finanzas,
**I want** que el desglose por item, los montos por participante y el "Total comisiones" reflejen
el reparto correcto tanto en el preview como en lo persistido,
**so that** los reportes de comisiones y el gasto no queden inflados.

**Acceptance Criteria:**
- **Given** una factura guardada con reparto 50/50 sobre una comisión de 50.000 COP,
  **When** consulto la vista de comisiones,
  **Then** veo dos filas de 25.000 COP cada una (no 50.000), y la suma de filas del item = 50.000.
- **Given** el preview en el formulario,
  **When** cambio los porcentajes de reparto,
  **Then** los montos por participante y el "Total comisiones" se actualizan y el total del item
  permanece igual a la comisión resuelta (subtotal × tasa).

### US4: Migrar/corregir comisiones ya registradas con el reparto inflado — Priority: P2

**As a** administrador de finanzas,
**I want** que las comisiones existentes con 2+ participantes que hoy están infladas se corrijan,
**so that** los reportes históricos reflejen el gasto real.

**Acceptance Criteria:**
- **Given** filas existentes de un item con N participantes donde cada uno tiene la tasa completa,
  **When** se ejecuta la corrección,
  **Then** cada fila queda con su monto reparteado y la suma por item = subtotal × tasa del item.
- **Given** una comisión con un solo participante,
  **When** se ejecuta la corrección,
  **Then** su monto no cambia (share = 100%).

> **Priority guide:** P1 = MVP (el reparto correcto y su validación). P2 = corrección de históricos.

## 3. Functional Requirements

| ID | Requirement | Priority | Story |
|----|-------------|----------|-------|
| FR-001 | El `%` del participante representa su **share** del reparto de la comisión del item, NO una tasa sobre el subtotal. | P1 | US1 |
| FR-002 | Para cada item, la comisión total = `subtotal × tasa_resuelta_del_item` (la tasa la sigue resolviendo `resolveCommissionRate`, sin cambios). | P1 | US1 |
| FR-003 | El monto de cada participante = `comisión_total_del_item × (share_participante / 100)`, en moneda local y USD. | P1 | US1 |
| FR-004 | Los shares de los participantes de un mismo item deben sumar exactamente 100%; en caso contrario, el guardado se bloquea con aviso. | P1 | US2 |
| FR-005 | Los shares se **digitan libremente** por participante en un campo numérico (el usuario escribe cuánto va para un KAM y cuánto para el otro, p.ej. 70 y 30, 60 y 40); no son opciones fijas ni 50/50 forzado. Única regla: deben sumar 100%. | P1 | US1 |
| FR-006 | El indicador "Total comisión" del editor muestra el estado de la suma de shares en vivo (OK a 100%, error si ≠ 100%). | P1 | US2 |
| FR-007 | El desglose por item y el "Total comisiones" del preview reflejan los montos reparteados; el total por item no cambia al variar el reparto. | P1 | US3 |
| FR-008 | La persistencia (`saveItemCommissions`) guarda por participante el monto reparteado y su share; la suma de filas por item = comisión total del item. | P1 | US3 |
| FR-009 | La tasa del item se sigue resolviendo server-side y nunca se confía en un valor de tasa enviado por el frontend (se mantiene FR-015 de la spec 001). El frontend solo aporta los **shares**. | P1 | US1 |
| FR-010 | La vista de comisiones muestra los montos reparteados; ninguna suma por item excede la comisión resuelta. | P1 | US3 |
| FR-011 | El comportamiento debe ser idéntico en el formulario de factura de ingreso y en el formulario de solicitud de factura Alegra (ambos usan `calculateItemCommissions`). | P1 | US1 |
| FR-012 | Un backfill corrige las filas existentes infladas de forma idempotente (re-ejecutable sin volver a dividir). | P2 | US4 |
| FR-013 | El `1%` perpetuo al originador (Hunter) y demás reglas de canal existentes NO se alteran; solo cambia cómo se reparte el monto entre participantes. | P1 | US1 |

## 4. Key Entities

| Entity | Description | Key Attributes |
|--------|-------------|----------------|
| Participante de comisión | Un beneficiario asignado a la comisión de un item de la factura. | beneficiario_nombre, rol, **share (%) del reparto** |
| Comisión de item (fila persistida) | Registro por (item × participante) en la comisión. | item, subtotal, tasa del item, **share**, monto reparteado (local/USD), rol, regla_aplicada |

## 5. Success Criteria

| ID | Criteria | How to Measure |
|----|----------|----------------|
| SC-001 | Con 2 participantes al 50/50 sobre 5% de 1.000.000 COP, el total del item = 50.000 COP. | Preview y filas guardadas suman 50.000 (25k + 25k). |
| SC-002 | Con shares 70/30, montos = 35.000 / 15.000 y suman la comisión del item. | Prueba en formulario + fila persistida. |
| SC-003 | Guardar con shares que no suman 100% queda bloqueado con aviso. | Intento de guardado devuelve error/aviso, no persiste. |
| SC-004 | Para 1 solo participante, el monto = comisión completa del item (share 100%). | Regresión: casos de 1 participante no cambian. |
| SC-005 | Tras el backfill, ninguna factura tiene suma de comisiones por item > subtotal × tasa. | Query de auditoría sobre `invoice_item_commissions`. |

## 6. Edge Cases & Error Handling

| Scenario | Expected Behavior |
|----------|-------------------|
| Un solo participante | Share = 100%; recibe la comisión completa del item. |
| Shares suman < 100% (p.ej. 90%) | Bloquear guardado con aviso "el reparto debe sumar 100%". |
| Shares suman > 100% (p.ej. 120%) | Bloquear guardado con el mismo aviso. |
| Participante con share 0% | Se ignora (no genera fila) o se marca inválido; no aporta al reparto. |
| Item con costo_directo (comisión sobre margen) | La base es el margen (price − cost); el reparto se aplica sobre esa comisión, misma regla. |
| Redondeo del reparto | Redondear cada monto a 2 decimales y asignar el residuo (comisión_total − Σmontos) al **último participante**, de modo que la suma cuadre EXACTO con la comisión del item (confirmado por el usuario, 2026-07-28). |
| Factura con varios items | El reparto por shares se aplica item por item; los mismos participantes/shares aplican a cada item (comportamiento actual del editor, sin cambios). |

## 7. Assumptions & Constraints

- La **tasa** de comisión del item se resuelve exactamente como hoy (`resolveCommissionRate`: canal/rangos, bumps 6m, one-time, etc.). Este cambio NO toca esas reglas.
- El editor de participantes aplica el mismo conjunto de participantes/shares a todos los items de la factura (igual que hoy); no se pide reparto distinto por item en este alcance.
- No hay suite de tests automatizada del proyecto salvo `src/lib/commission-math.test.ts` (pura). El nuevo cálculo de reparto debería ser una función pura testeable.
- Migraciones se aplican a mano en el SQL Editor de Supabase (sin CLI), numeradas secuencialmente.

## 8. Out of Scope

- Cambiar las reglas de la **tasa** de comisión (canal, rangos, bumps, 1% perpetuo del originador).
- Reparto distinto por item dentro de una misma factura (cada item con su propio set de shares).
- Cambiar el flujo de pagos/estados de comisiones (pendiente/pagado).

## 9. Dependencies

- Spec 001 (comisiones por origen del negocio) y su `resolveCommissionRate` como fuente de la tasa.
- Tablas `invoice_item_commissions` y `plan_commission_ranges`.
- Componentes `CommissionParticipantsEditor`, `income-invoice-form.tsx`, `alegra-invoice-request-form.tsx`.

## 10. Security & Performance

- La tasa se resuelve server-side; el frontend solo envía shares. El backend valida que los shares sumen 100% antes de persistir (no confiar en la validación de UI).
- Sin impacto de performance relevante (cálculo aritmético en memoria).
