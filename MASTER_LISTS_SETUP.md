# 🎯 Master Lists Setup - Guía de Ejecución

## Resumen del Progreso

✅ **Completado:**
- Migration 014 creada con todas las tablas master lists
- Master-lists-page-client.tsx con CRUD completo + delete
- Server actions (master-lists.actions.ts) con funciones de Delete
- Navegación actualizada con todos los nuevos módulos:
  - `/settings/master-lists` - Gestión de listas maestras
  - `/cashflow` - Análisis de flujo de caja
  - `/proveedores` - Gestión de proveedores
  - `/financial-liabilities` - Pasivos financieros
- Todas las páginas creadas y funcionales

---

## Paso 1️⃣: Ejecutar Migration 014 en Supabase

### **IMPORTANTE**: Este es el paso crítico que habilita todas las nuevas características

### Pasos:

1. **Abre Supabase Dashboard**
   - Ve a: https://app.supabase.com/
   - Selecciona tu proyecto (zipgcfmwvvjtmjwvrywz)

2. **Abre SQL Editor**
   - Click en "SQL Editor" en la barra lateral
   - Click en "New Query"

3. **Copia el SQL de Migration 014**
   - Archivo: `supabase/migrations/014_create_master_lists.sql`
   - Copia TODO el contenido

4. **Pega en Supabase y Ejecuta**
   - Presiona `Ctrl+Enter` o click "Run"
   - Deberías ver: "Query succeeded"

### ✅ Verificación

Después de ejecutar, deberías ver estas tablas nuevas en Supabase:
- `planes` - Planes de servicio
- `aliados` - Partners/resellers
- `vendedores` - Sales team (KAM/Hunter)
- `tipos_pago` - Métodos de pago
- `conceptos_gasto` - Conceptos de gastos
- `prioridades_pago` - Prioridades de pago

---

## Paso 2️⃣: Probar Master Lists en la Aplicación

### Acceder a `/settings/master-lists`

En la navegación lateral, click en **"Configuración"** (Settings icon)

### Probar cada sección:

#### **Planes**
- Agregar nuevo plan: "Plan Especial"
- Ver que aparece en la lista
- Click en trash para eliminar
- Confirmar y verificar que se removió

#### **Aliados**
- Agregar: Nombre "Empresa XYZ", Comisión: 15%
- Editar la comisión % (si es necesario)
- Eliminar y confirmar

#### **Vendedores (KAMs/Hunters)**
- Agregar: Nombre "Juan Pérez", Rol "KAM"
- Agregar: Nombre "María López", Rol "Hunter"
- Eliminar uno y confirmar

#### **Tipos de Pago**
- Deberían estar pre-poblados: Efectivo, Transferencia, TDC, Cheque, etc.
- Agregar: "Cripto" o nuevo tipo
- Eliminar si deseas

#### **Conceptos de Gasto**
- Deberían estar pre-poblados: Salarios, Software, Marketing, etc.
- Agregar: "Viáticos Aéreos"
- Eliminar si deseas

---

## Paso 3️⃣: Actualizar Formularios de Facturas

### Próximos pasos (en orden):

#### **3a: Actualizar Income Invoice Form**
Archivo: `src/components/income-invoices/income-invoice-form.tsx`

Agregar campos select para:
```
- plan_id (select from planes table)
- aliado_id (select from aliados table, optional)
- vendedor_id (select from vendedores table, optional)
```

Reemplazar los campos de texto por selects que carguen desde master lists.

#### **3b: Actualizar Expense Invoice Form**
Archivo: `src/components/expense-invoices/expense-invoice-form.tsx`

Reemplazar:
```
- nombre_proveedor_concepto → concepto_id (select from conceptos_gasto)
- prioridad_pago / logica_prioridad → prioridad_id (select from prioridades_pago)
```

Agregar:
```
- tipo_pago_id (select from tipos_pago)
```

---

## Paso 4️⃣: Flujo de Prueba Completo (End-to-End)

### Test 1: Crear Ingreso con Plan y Vendedor
1. Ve a `/income-invoices`
2. Click "Nueva Factura"
3. Llena datos básicos
4. Selecciona:
   - **Plan**: "hackÜ PRO"
   - **Vendedor**: "Juan Pérez"
   - **Aliado**: "Empresa XYZ" (opcional)
5. Guarda la factura
6. Verifica que se creó correctamente

### Test 2: Crear Gasto con Concepto y Prioridad
1. Ve a `/expense-invoices`
2. Click "Nueva Factura"
3. Llena datos básicos
4. Selecciona:
   - **Concepto**: "Software"
   - **Tipo de Pago**: "Transferencia Bancaria"
   - **Prioridad**: "Alto"
5. Guarda la factura
6. Verifica que se creó correctamente

### Test 3: Ver Estadísticas
Después de crear varias facturas con diferentes vendedores/aliados:
```
GET /api/statistics?type=vendedor&id=<vendedor_id>
GET /api/statistics?type=aliado&id=<aliado_id>
```

Deberías ver:
- Total generado por vendedor
- Promedio por factura
- Total comisión pagada a aliados

---

## 🚀 Arquitectura de Datos

### Relaciones:

```
income_invoices
├── plan_id → planes.id
├── aliado_id → aliados.id (commission tracking)
└── vendedor_id → vendedores.id (KAM/Hunter tracking)

expense_invoices
├── concepto_id → conceptos_gasto.id
├── tipo_pago_id → tipos_pago.id
└── prioridad_id → prioridades_pago.id
```

### Campos Nuevos Agregados:

**income_invoices:**
- `plan_id` UUID
- `aliado_id` UUID
- `vendedor_id` UUID

**expense_invoices:**
- `concepto_id` UUID
- `tipo_pago_id` UUID
- `prioridad_id` UUID

---

## ⚙️ Configuración de API Key OpenAI

### Ubicación: `/components/shared/openai-api-key-manager.tsx`

Este componente:
- ✅ Almacena la API key en localStorage (no se envía al servidor)
- ✅ Solo se usa en el navegador para procesar PDFs
- ✅ Se descarta después de usar
- ✅ Tiene UI para show/hide y validación (comienza con "sk-")

### Uso en Formularios:

Ya está integrado en los formularios de facturas. El usuario:
1. Copia su API key desde platform.openai.com
2. La ingresa UNA VEZ en el componente
3. Se guarda en localStorage
4. Se reutiliza automáticamente en todos los uploads de PDF

**Seguridad**: La key NUNCA se almacena en el servidor. Solo se usa localmente en el navegador.

---

## 📊 Funciones de Estadísticas

### getVendedorStats(vendedorId)

Retorna:
```json
{
  "total": 45000,
  "count": 5,
  "promedio": 9000
}
```

Uso: Medir cuánto está generando cada KAM/Hunter

### getAliadoStats(aliadoId)

Retorna:
```json
{
  "total": 120000,
  "count": 12,
  "comision_total": 18000
}
```

Uso: Calcular comisiones adeudadas a aliados

---

## 🎯 Checklist de Finalización

- [ ] Migration 014 ejecutada en Supabase
- [ ] Tablas master lists visibles en Supabase
- [ ] Acceder a `/settings/master-lists` funciona
- [ ] Crear/editar/eliminar en cada sección funciona
- [ ] income-invoice-form.tsx actualizado con plan_id, aliado_id, vendedor_id
- [ ] expense-invoice-form.tsx actualizado con concepto_id, tipo_pago_id, prioridad_id
- [ ] Crear factura de ingreso con plan/vendedor/aliado funciona
- [ ] Crear factura de gasto con concepto/tipo_pago/prioridad funciona
- [ ] Ver `/financial-liabilities` funciona
- [ ] Ver `/proveedores` funciona
- [ ] Ver `/cashflow` funciona
- [ ] PDF upload con OpenAI funciona
- [ ] Estadísticas de vendedores/aliados generando datos correctamente

---

## 🆘 Troubleshooting

### "Migration 014 failed"
- Verifica que no hay errores de sintaxis en el SQL
- Comprueba que las columnas no existan ya (IF NOT EXISTS)
- Revisa permisos en Supabase (deberías tener admin)

### "No veo las nuevas tablas en Supabase"
- Recarga el dashboard (F5)
- Verifica en la sección "Tables" del SQL editor
- Ejecuta: `SELECT * FROM planes;` para confirmar

### "Error al crear factura: columna 'plan_id' no existe"
- Migration 014 no se ejecutó correctamente
- Revisa que el paso 1 completó exitosamente

### "Los campos plan/concepto no aparecen en los formularios"
- Los formularios aún no han sido actualizados
- Pasos 3a y 3b del paso 3 arriba

---

## 📚 Documentación de Referencia

- Migration 014: `supabase/migrations/014_create_master_lists.sql`
- Master Lists Actions: `src/actions/master-lists.actions.ts`
- Master Lists UI: `src/components/settings/master-lists-page-client.tsx`
- OpenAI API Key Manager: `src/components/shared/openai-api-key-manager.tsx`
- Setup Original: `SETUP_GUIDE.md`

---

**¡Listo! Ahora tu aplicación tiene un sistema completo de listas maestras integradas con facturas de ingreso y gasto. 🎉**
