# Tipo de negocio por ítem — Plan + Tasks

**Spec:** 002-tipo-negocio-por-item/spec.md · **Created:** 2026-07-27

> Plan y tasks combinados: feature acotado de wiring FE sobre infraestructura server ya existente. Sin migraciones (los campos viven en el JSON de ítems y en `invoice_item_commissions`, ya migrado en 044).

## Decisiones técnicas

- **ADR-1 — Sin migración:** `tipo_negocio`/`proyecto_corto_hunter` viajan en el JSON `items` de la factura (columna `items jsonb` existente) y se persisten por comisión en `invoice_item_commissions` (migración 044). No se toca el catálogo.
- **ADR-2 — Default derivado en el form:** al mapear `getPlanes()` a `availableItems`, se incluye `tipo_negocio_default` (= `frecuencia_recurrencia === 'one-time' ? 'one_time' : 'recurrente'`). Al seleccionar un ítem se setea `items.${index}.tipo_negocio` con ese default (editable). El server sigue teniendo su propia derivación como red de seguridad.
- **ADR-3 — Visibilidad condicional:** los controles solo se renderizan cuando la factura está marcada cliente nuevo (la tasa one-time solo existe en esa rama del motor). El checkbox proyecto corto solo cuando tipo=one_time.

## Files to Modify

```
src/lib/validations/alegra-invoice.schema.ts   # + tipo_negocio, proyecto_corto_hunter en item schema
src/lib/validations/income-invoice.schema.ts   # ídem
src/components/alegra-invoices/alegra-invoice-request-form.tsx  # default en mapeo de planes, controles por ítem, preview
src/components/income-invoices/income-invoice-form.tsx          # ídem
```

## Tasks

- **T001** [INFRA] Añadir `tipo_negocio: z.enum(['recurrente','one_time']).optional()` y `proyecto_corto_hunter: z.boolean().optional()` a `alegraInvoiceItemSchema` e `incomeInvoiceItemSchema`.
- **T002** [US1] Alegra form: mapear `tipo_negocio_default` desde `frecuencia_recurrencia` en `availableItems`; setearlo en `handleSelectItem`; render Select "Tipo de negocio" + checkbox "Proyecto corto (Hunter)" por ítem (solo `esClienteNuevo`); pasar ambos campos al preview (`itemsWithRanges`). Depende de T001.
- **T003** [US1] Income form: mismos cambios (estado `esNuevaFactura` como condición de visibilidad). Depende de T001.
- **T004** [INFRA] Verificación: `npx tsc --noEmit`, `npx vitest run`, lint de los 4 archivos. Prueba de humo del cálculo: one_time+hunter → 15, +proyecto corto → 18 (ya cubierto por tests del motor).

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| El JSON de ítems no llegue con los campos al recálculo | `recalculateInvoiceCommissions` ya lee `item.tipo_negocio`/`item.proyecto_corto_hunter` (fix #3); los schemas los validan y el form los envía en `data.items`. |
| Regresión en facturas no-cliente-nuevo | Campos opcionales; sin valor → default recurrente → misma salida actual (SC-002). |
