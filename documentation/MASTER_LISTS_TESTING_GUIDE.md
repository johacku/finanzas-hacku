# ✅ Master Lists - Guía de Prueba Completa

## Resumen de Cambios Completados

### ✅ Completed:
1. **Migration 014** ejecutada en Supabase
2. **Master Lists Page** (`/settings/master-lists`) con CRUD completo
3. **Income Invoice Form** actualizado:
   - ✅ Plan de Servicio (plan_id) - Select dropdown
   - ✅ Vendedor (vendedor_id) - Select dropdown con rol KAM/Hunter
   - ✅ Aliado/Reseller (aliado_id) - Select dropdown con comisión %
   - ⚠️ Legacy fields kept for backward compatibility

4. **Expense Invoice Form** actualizado:
   - ✅ Concepto de Gasto (concepto_id) - Select dropdown
   - ✅ Tipo de Pago (tipo_pago_id) - Select dropdown
   - ✅ Prioridad de Pago (prioridad_id) - Select dropdown unificado
   - ⚠️ Legacy fields kept for backward compatibility

---

## 🧪 Test Plan Paso a Paso

### Fase 1: Verificar que los Master Lists cargan correctamente

**Test 1.1: Income Invoice Form Load**
1. Navega a `/income-invoices`
2. Click en "Nueva Factura"
3. Espera a que el formulario cargue
4. Verifica que los selects muestren:
   - ✅ Plans (hackÜ PRO, Starter, Comms, Others, Content production, Concurrencia)
   - ✅ Vendedores (vacío inicialmente, pero puedes agregar desde /settings/master-lists)
   - ✅ Aliados (vacío inicialmente, pero puedes agregar desde /settings/master-lists)

**Test 1.2: Expense Invoice Form Load**
1. Navega a `/expense-invoices`
2. Click en "Nueva Factura"
3. Espera a que el formulario cargue
4. Verifica que los selects muestren:
   - ✅ Conceptos de Gasto (Salarios, Software, Hosting, Marketing, Viáticos, etc.)
   - ✅ Tipos de Pago (Efectivo, Transferencia, Tarjeta de Crédito, Cheque, Plataforma Digital)
   - ✅ Prioridades (Crítico, Alto, Normal, Bajo, Diferido)

---

### Fase 2: Crear datos en Master Lists

**Test 2.1: Crear Vendedores**
1. Ve a `/settings/master-lists`
2. Tab "Vendedores (KAMs/Hunters)"
3. Agregar:
   - Nombre: "Carlos Ramírez", Rol: "KAM"
   - Nombre: "Sofia López", Rol: "Hunter"
4. Verifica que aparezcan en la lista
5. Cierra y re-abre el formulario de Income Invoice
6. Deberías ver los vendedores nuevos en el select

**Test 2.2: Crear Aliados**
1. Tab "Aliados"
2. Agregar:
   - Nombre: "Tech Partners", Comisión: 12%
   - Nombre: "Global Solutions", Comisión: 8%
3. Verifica que aparezcan en la lista
4. Cierra y re-abre el formulario de Income Invoice
5. Deberías ver los aliados nuevos en el select

---

### Fase 3: Crear Facturas con Master Lists

**Test 3.1: Crear Income Invoice**
1. Ve a `/income-invoices`
2. Click "Nueva Factura"
3. Llena datos básicos:
   - Sociedad: "hackÜ SAS"
   - Razón Social Cliente: "Acme Corp"
   - Moneda: "USD"
   - Fechas: Hoy y próximas 30 días
   - Monto Recurrente: 5000
4. **Selecciona desde los nuevos dropdowns:**
   - Plan: "hackÜ PRO"
   - Vendedor: "Carlos Ramírez" (KAM)
   - Aliado: "Tech Partners"
5. Click "Crear Factura"
6. Verifica en la base de datos:
   - Abre Supabase → SQL Editor
   - Ejecuta: `SELECT plan_id, aliado_id, vendedor_id FROM income_invoices ORDER BY created_at DESC LIMIT 1;`
   - Deberías ver 3 UUIDs (no NULL)

**Test 3.2: Crear Expense Invoice**
1. Ve a `/expense-invoices`
2. Click "Nueva Factura"
3. Llena datos básicos:
   - Sociedad: "hackÜ SAS"
   - Tipo: "Operacional"
   - Área: "Tecnología"
   - Monto: 2000
4. **Selecciona desde los nuevos dropdowns:**
   - Concepto: "Software"
   - Tipo de Pago: "Transferencia Bancaria"
   - Prioridad: "Alto"
5. Click "Crear Gasto"
6. Verifica en la base de datos:
   - Ejecuta: `SELECT concepto_id, tipo_pago_id, prioridad_id FROM expense_invoices ORDER BY created_at DESC LIMIT 1;`
   - Deberías ver 3 UUIDs (no NULL)

---

### Fase 4: Verificar Backward Compatibility

**Test 4.1: Legacy Fields Still Work**
1. Los campos legacy están ocultos pero funcionales
2. Si hay datos antiguos sin master list IDs, la app no debería fallar
3. Los campos legacy (`vendedor`, `porcentaje_comision`, etc.) siguen disponibles para edición

---

## 🔍 Verificación Final en Supabase

### Income Invoices
```sql
SELECT
  id,
  razon_social_cliente,
  plan_id,
  vendedor_id,
  aliado_id,
  monto_recurrente,
  created_at
FROM public.income_invoices
ORDER BY created_at DESC
LIMIT 5;
```

**Deberías ver:**
- plan_id: UUID o NULL (si no lo seleccionaste)
- vendedor_id: UUID o NULL
- aliado_id: UUID o NULL

### Expense Invoices
```sql
SELECT
  id,
  nombre_proveedor_concepto,
  concepto_id,
  tipo_pago_id,
  prioridad_id,
  monto_sin_impuestos,
  created_at
FROM public.expense_invoices
ORDER BY created_at DESC
LIMIT 5;
```

**Deberías ver:**
- concepto_id: UUID
- tipo_pago_id: UUID
- prioridad_id: UUID

---

## ✅ Checklist de Finalización

- [ ] Migration 014 ejecutada (verificado con "Success")
- [ ] `/settings/master-lists` funciona y carga datos
- [ ] Crear/editar/eliminar items en master lists funciona
- [ ] Income Invoice Form carga planes, vendedores, aliados
- [ ] Expense Invoice Form carga conceptos, tipos de pago, prioridades
- [ ] Crear income invoice con plan/vendedor/aliado funciona
- [ ] Crear expense invoice con concepto/tipo_pago/prioridad funciona
- [ ] Datos se guardan en las nuevas columnas (verificado en Supabase)
- [ ] Legacy fields no interfieren con nuevos datos
- [ ] Formularios aún funcionan si no llenan los nuevos fields

---

## 🚀 Próximas Fases (Opcional)

Después de confirmar que todo funciona:

1. **Validación en Schema**: Actualizar `income-invoice.schema` y `expense-invoice.schema` para incluir validaciones de los nuevos campos

2. **UI Improvements**:
   - Mostrar nombre del plan/concepto en listados
   - Agregar filtros por plan/vendedor/aliado en la tabla de income invoices
   - Agregar filtros por concepto/prioridad en la tabla de expense invoices

3. **Reporting**:
   - Dashboard con ingresos por plan
   - Dashboard con gastos por concepto
   - Comisiones a pagar por aliado
   - Generación por vendedor (KAM vs Hunter)

4. **Automation**:
   - Cuando se crea una factura con aliado, calcular automáticamente `porcentaje_comision_aliado` desde el registro de aliado
   - Cuando se crea una factura con vendedor, mostrar su rol (KAM/Hunter) como información

---

## 🆘 Troubleshooting

### "Plan/Vendedor/Aliado no aparecen en los selects"
- ✓ Verifica que has agregado items en `/settings/master-lists`
- ✓ Comprueba que `activo = true` en la base de datos
- ✓ Recarga la página (F5) para limpiar cache

### "Error al guardar factura: columna desconocida"
- ✓ Migration 014 no se ejecutó correctamente
- ✓ Verifica en Supabase que las columnas existan:
  ```sql
  SELECT column_name FROM information_schema.columns
  WHERE table_name='income_invoices' AND column_name LIKE '%_id';
  ```

### "Los fields legacy están tomando valores incorrectos"
- ✓ Estos son campos por backward compatibility
- ✓ Los nuevos fields (plan_id, aliado_id, etc.) tienen prioridad
- ✓ Puedes dejarlos vacíos si usas los nuevos fields

---

## 📊 Base de Datos - Referencia de Relaciones

```
income_invoices
├── plan_id → planes.nombre
├── vendedor_id → vendedores.nombre (rol: KAM/Hunter)
└── aliado_id → aliados.nombre (con % comisión)

expense_invoices
├── concepto_id → conceptos_gasto.nombre
├── tipo_pago_id → tipos_pago.nombre
└── prioridad_id → prioridades_pago.nombre (con nivel)
```

---

**¡Listo para probar! Ejecuta los tests y cuéntame cuál es el resultado. 🚀**
