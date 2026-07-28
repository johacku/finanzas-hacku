# División de comisiones entre participantes — Implementation Plan

**Spec:** 003-division-comisiones-reparto/spec.md
**Created:** 2026-07-28
**Status:** Draft

---

## 1. Technical Context

| Aspect | Decision |
|--------|----------|
| Language/Framework | Next.js 14 (App Router) + React 18 + TypeScript strict |
| Database | Supabase Postgres |
| Data Layer | Server Actions (`'use server'`) en `src/actions/*.actions.ts` |
| Cálculo puro | `src/lib/commission-math.ts` (testeable con `commission-math.test.ts`) |
| Testing | Sin runner configurado salvo el `.test.ts` puro de commission-math (se ejecuta manual). No asumir `npm test`. |
| Migraciones | Manuales en Supabase SQL Editor, numeradas `NNN_*.sql` (siguiente = 049) |
| Convención | Vocabulario ES; `as any` en actions cuando la tabla no está en types |

## 2. Constitution Compliance

No existe `specs/constitution.md`. N/A.

## 3. Architecture Decisions

### ADR-1: El `%` del participante es un SHARE de reparto, no una tasa

- **Context:** Hoy `calculateItemCommissions` y `saveItemCommissions` aplican la tasa completa del item a cada participante (bug). El equipo confirmó (Slack) que el `%` debe **repartir** la única comisión del item y que los shares se **digitan** y deben sumar 100%.
- **Decisión:** Introducir una función pura `splitItemCommission(comisionTotal, participants)` en `commission-math.ts` que reciba la comisión ya resuelta del item y los shares, y devuelva el monto por participante = `comisionTotal × share/100`.
- **Rationale:** Mantiene `resolveCommissionRate` intacto (la tasa sigue siendo server-side, FR-009) y aísla el reparto en una función testeable.

### ADR-2: Persistir el share en su propia columna (no reutilizar `porcentaje`)

- **Context:** La columna `porcentaje` de `invoice_item_commissions` hoy guarda la **tasa del item**. La vista de comisiones y auditorías la usan como tasa.
- **Opciones:**
  - A: Reusar `porcentaje` para guardar el share → rompe el significado histórico de la columna y las auditorías de tasa.
  - B: Añadir columna `share_reparto numeric` (default 100) y conservar `porcentaje` como la tasa del item.
- **Decisión:** B. Migración 049 añade `share_reparto numeric NOT NULL DEFAULT 100`. `porcentaje` sigue siendo la tasa del item; `monto_comision(_usd)` pasa a ser el monto **reparteado**.
- **Rationale:** Preserva la semántica de `porcentaje` (tasa), hace el reparto auditable y da default 100 que hace correctas por construcción las filas de 1 participante y el backfill.

### ADR-3: Validación de suma = 100% en frontend Y backend

- **Context:** FR-004/FR-009: no confiar en la UI.
- **Decisión:** UI bloquea submit y marca "Total comisión" en rojo si ≠ 100%; `saveItemCommissions` revalida por item y rechaza (o normaliza con error) si la suma de shares ≠ 100%.
- **Rationale:** Defensa en profundidad; la spec exige bloqueo real, no solo visual.

### ADR-4: Redondeo con cuadre al último participante

- **Context:** Edge case de centavos (spec §6, NEEDS CLARIFICATION).
- **Decisión:** Redondear cada monto a 2 decimales y asignar el residuo (comisiónTotal − Σmontos) al último participante, de modo que la suma cuadre exacto con la comisión del item.
- **Estado:** Confirmado por el usuario (2026-07-28).

## 4. Files to Create/Modify

```
supabase/migrations/049_commission_share_reparto.sql          (CREAR)
src/lib/commission-math.ts                                     (MODIFICAR: splitItemCommission)
src/lib/commission-math.test.ts                               (MODIFICAR: tests de reparto)
src/actions/item-commissions.actions.ts                       (MODIFICAR: calculate + save usan share)
src/components/comisiones/commission-participants-editor.tsx  (MODIFICAR: labels, validación 100%)
src/components/income-invoices/income-invoice-form.tsx        (MODIFICAR: bloqueo submit, preview)
src/components/alegra-invoices/alegra-invoice-request-form.tsx(MODIFICAR: mismo comportamiento)
src/types/database.types.ts                                   (MODIFICAR: añadir share_reparto)
src/app/api/backfill-commission-split/route.ts                (CREAR: backfill idempotente P2)
```

## 5. Implementation Phases

### Phase 0: Research & Clarification
- Política de redondeo confirmada (ADR-4: residuo al último participante).
- Confirmar si la vista de comisiones (`commissions.actions.ts` / `comisiones-client.tsx`) muestra `porcentaje` como tasa en algún lugar que deba pasar a mostrar el share o el monto reparteado.

### Phase 1: Data & Contracts
- Migración 049: `ALTER TABLE invoice_item_commissions ADD COLUMN share_reparto numeric NOT NULL DEFAULT 100;`
- Actualizar `database.types.ts` con la nueva columna.
- Definir el contrato de `splitItemCommission` (entrada: comisión total local/USD + participants con share; salida: monto local/USD por participante).

### Phase 2: Core Logic
- `commission-math.ts`: implementar `splitItemCommission` (pura) con validación de suma y redondeo (ADR-4).
- `calculateItemCommissions`: calcular la comisión total del item una vez (`base × itemPct/100`) y repartirla con `splitItemCommission` en lugar de aplicar `itemPct` a cada participante. Añadir `share_reparto` al resultado.
- `saveItemCommissions`: recomputar la comisión total del item server-side, validar que la suma de shares del item = 100%, repartir y persistir `share_reparto` + `monto_comision(_usd)` reparteado. Mantener `porcentaje` = tasa del item.

### Phase 3: Interface Layer
- `CommissionParticipantsEditor`: aclarar copy (el % es "reparto"), mantener input digitable, "Total comisión" en error si ≠ 100%.
- `income-invoice-form.tsx` y `alegra-invoice-request-form.tsx`: bloquear submit con toast si la suma de shares ≠ 100%; preview refleja montos reparteados y total por item constante.

### Phase 4: Quality & Polish
- Tests en `commission-math.test.ts`: 50/50, 70/30, 1 participante (100%), suma ≠ 100% (rechazo), redondeo de centavos, base con costo_directo.
- Backfill `api/backfill-commission-split` (P2): para cada (factura,item) con N filas donde cada `monto_comision` = subtotal×tasa, dividir por N (o por share si existiera) → montos reparteados; idempotente (marca por `regla_aplicada` o comprobación de que ya suma ≤ comisión del item).
- Verificación manual con el caso del screenshot (1M COP, 5%, 50/50 → 50.000 total).

## 6. Complexity Check

| Component | Complexity | Justification |
|-----------|-----------|---------------|
| `splitItemCommission` | Simple | Aritmética pura + validación + residuo. |
| Migración 049 | Simple | Una columna con default. |
| Backfill | Medium | Debe ser idempotente y no re-dividir filas ya corregidas. |
| Cambios de UI | Simple | Validación de suma y copy; el input ya existe. |

## 7. Migration & Rollback

- **Deploy steps:** (1) Aplicar 049 en SQL Editor. (2) Deploy del código. (3) Ejecutar backfill (P2) una vez. 
- **Rollback:** El código nuevo es compatible con `share_reparto` default 100. Para revertir, redeploy del código anterior; la columna nueva es aditiva y no rompe el flujo previo. El backfill NO es reversible automáticamente → snapshot/exportar `invoice_item_commissions` antes de correrlo.
- **Data migration:** backfill idempotente descrito arriba.

## 8. Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Backfill re-divide filas ya correctas | H | M | Idempotencia: verificar que Σmontos por item ≤ comisión del item antes de dividir; correr en dry-run primero. |
| La vista de comisiones asume `porcentaje` = tasa efectiva del participante | M | M | Revisar `comisiones-client.tsx`; mostrar share/monto reparteado donde aplique. |
| Redondeo deja descuadre de centavos | L | M | ADR-4 asigna residuo al último participante. |
| Un solo participante con share ≠ 100% guardado | M | L | Validación server-side de suma = 100%. |
