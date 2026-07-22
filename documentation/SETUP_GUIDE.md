# 🚀 Guía de Setup - hackÜ Cash Flow Enhancements

Este documento guía los pasos finales para completar todas las nuevas características.

---

## 1️⃣ Ejecutar Migración 013 - Storage Bucket

### Pasos:

1. **Abre Supabase Dashboard**
   - Ve a: https://app.supabase.com/
   - Selecciona tu proyecto: `zipgcfmwvvjtmjwvrywz`

2. **Abre SQL Editor**
   - Click en "SQL Editor" en la barra lateral izquierda
   - Click en "New Query"

3. **Copia y Ejecuta la Migración**
   ```sql
   -- Migration 013: Setup Supabase Storage bucket

   INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
   VALUES (
     'invoice-documents',
     'invoice-documents',
     false,
     true,
     10485760,
     ARRAY[
       'application/pdf',
       'image/jpeg',
       'image/png',
       'image/webp',
       'application/msword',
       'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
       'application/vnd.ms-excel',
       'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
     ]
   )
   ON CONFLICT (id) DO NOTHING;

   -- Enable RLS
   ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

   -- Políticas RLS
   CREATE POLICY "Authenticated users can upload invoices"
   ON storage.objects
   FOR INSERT
   TO authenticated
   WITH CHECK (
     bucket_id = 'invoice-documents' AND
     auth.role() = 'authenticated'
   );

   CREATE POLICY "Authenticated users can view invoices"
   ON storage.objects
   FOR SELECT
   TO authenticated
   USING (
     bucket_id = 'invoice-documents' AND
     auth.role() = 'authenticated'
   );

   CREATE POLICY "Authenticated users can update invoices"
   ON storage.objects
   FOR UPDATE
   TO authenticated
   USING (
     bucket_id = 'invoice-documents' AND
     auth.role() = 'authenticated'
   )
   WITH CHECK (
     bucket_id = 'invoice-documents' AND
     auth.role() = 'authenticated'
   );

   CREATE POLICY "Authenticated users can delete invoices"
   ON storage.objects
   FOR DELETE
   TO authenticated
   USING (
     bucket_id = 'invoice-documents' AND
     auth.role() = 'authenticated'
   );
   ```

4. **Ejecuta**
   - Press `Ctrl+Enter` o click "Run"
   - Deberías ver: "Query succeeded" (0-1 filas)

✅ **Completado** - El bucket está listo para recibir facturas.

---

## 2️⃣ Obtener OpenAI API Key

### Para Procesar PDFs con IA:

1. **Ve a OpenAI Platform**
   - https://platform.openai.com/api-keys
   - Inicia sesión con tu cuenta

2. **Crea una Nueva API Key**
   - Click "Create new secret key"
   - Dale un nombre: "hackÜ Cash Flow"
   - Copia la key completa (comienza con `sk-`)

3. **Usa en la App**
   - Cuando cargues un PDF en una factura, podrás ingresar tu API Key
   - **La key NUNCA se almacena** - solo se usa en tu navegador

⚠️ **Seguridad**:
- La API Key nunca se envía a nuestros servidores
- Se usa solo en tu navegador para llamadas a OpenAI
- Se descarta después de procesar el PDF

💰 **Costo**: ~$0.10-0.30 por factura (se carga a tu cuenta OpenAI)

---

## 3️⃣ Nuevas Rutas de la Aplicación

Las siguientes páginas están ahora disponibles:

### Flujo de Caja Semanal
```
URL: /cashflow
Descripción: Análisis auto-calculado de ingresos/egresos semanales
Características:
  ✓ Auto-cálculo desde facturas
  ✓ Detección de déficit
  ✓ Ajustes manuales
  ✓ Desglose por categoría
```

### Gestión de Proveedores
```
URL: /proveedores
Descripción: CRUD para proveedores y servicios
Características:
  ✓ Crear/editar/eliminar proveedores
  ✓ Filtrar por tipo (Software, Payroll, etc.)
  ✓ Contacto directo (email/teléfono)
  ✓ Info de banco y cuenta
```

### Pasivos Financieros
```
URL: /financial-liabilities
Descripción: Gestión de créditos, TDCs, préstamos
Características:
  ✓ Crear líneas de crédito, tarjetas rotativas, préstamos
  ✓ Registrar movimientos (draws, pagos, intereses)
  ✓ Seguimiento de pagos programados
  ✓ Cálculo automático de intereses
```

---

## 4️⃣ Tipos de Cambio en Vivo

La app obtiene tipos de cambio automáticamente:

### Fuente:
- **Primaria**: exchangerate-api.com (1500 reqs/mes gratis)
- **Fallback**: Tasas predeterminadas

### Tasas Soportadas:
- **USD**: Base (1.0)
- **COP**: TRM actual (obtenida del API)
- **MXN**: ~17.0 (aproximado)
- **VEF**: ~2,500,000 (aproximado)

### Cómo Funciona:
1. Cuando necesitas una conversión, se llama a `/api/exchange-rates`
2. Si existe en caché (Supabase), se usa la tasa cacheada
3. Si no, se obtiene del API externo y se cachea
4. Si el API falla, usa tasas predeterminadas

---

## 5️⃣ Funciones Inteligentes de Facturas

### PDF Upload + OpenAI Vision

Cuando cargas un PDF de factura:
1. El PDF se sube a Supabase Storage
2. OpenAI Vision extrae automáticamente:
   - Fecha de emisión
   - Cliente/Proveedor
   - Monto
   - Moneda
   - Concepto/Descripción
   - Fecha de vencimiento

3. Los campos del formulario se auto-completan
4. Si el cliente/proveedor no existe, se crea automáticamente

### Ejemplo Flujo:
```
Usuario: Carga PDF de factura
  ↓
App: Pregunta por OpenAI API Key
  ↓
Usuario: Proporciona API Key (solo en navegador)
  ↓
OpenAI: Procesa el PDF (en tu navegador)
  ↓
App: Auto-completa formulario con datos extraídos
  ↓
Usuario: Revisa y guarda
```

---

## 6️⃣ Testing End-to-End

### Flujo de Prueba Completo:

#### A. Crear un Cliente/Proveedor:
1. Ve a `/proveedores`
2. Click "Agregar Proveedor"
3. Llena datos de ejemplo
4. Guarda

#### B. Crear Factura con PDF (Opcional):
1. Ve a "Facturas de Ingreso" o "Facturas de Gasto"
2. Click "Nueva Factura"
3. En la sección "Cargar PDF":
   - Sube un PDF de factura
   - Ingresa tu OpenAI API Key
   - Click "Procesar PDF con IA"
   - Revisa campos auto-completados

#### C. Crear Pasivos:
1. Ve a `/financial-liabilities`
2. Click "Agregar Pasivo"
3. Crea una "TDC Visa" con:
   - Monto total: $10,000
   - Monto disponible: $8,000
   - Tasa: 1.5%
4. Guarda

#### D. Registrar Movimientos:
1. Ve a `/financial-liabilities` → Editar Pasivo
2. Click "Registrar Movimiento"
3. Registra un draw de $2,000
4. Verifica que `monto_disponible` se actualizó

#### E. Ver Flujo de Caja:
1. Crea algunas facturas de ingreso
2. Crea algunos gastos
3. Ve a `/cashflow`
4. Selecciona una semana
5. Verifica:
   - Auto-cálculo de ingresos
   - Auto-cálculo de egresos
   - Saldo final
   - Alertas de déficit/superávit

---

## 7️⃣ Arquitectura de APIs

### Endpoints Creados:

#### POST `/api/invoice-processor`
```
Procesa PDFs con OpenAI Vision

Entrada:
{
  "documentUrl": "data:image/jpeg;base64,...",
  "invoiceType": "income" | "expense",
  "userApiKey": "sk-proj-..."
}

Salida:
{
  "success": true,
  "extracted_data": {
    "fecha": "2024-03-02",
    "nombre_cliente_proveedor": "ACME Corp",
    "monto": 1500.00,
    "moneda": "USD",
    ...
  }
}
```

#### GET `/api/exchange-rates`
```
Obtiene tipos de cambio actuales

Parámetros:
?date=2024-03-02&currency=COP

Salida:
{
  "success": true,
  "source": "cache" | "external",
  "rates": {
    "USD": 1,
    "COP": 4200,
    "MXN": 17,
    "VEF": 2500000
  }
}
```

---

## 8️⃣ Base de Datos - Resumen de Cambios

| Migration | Cambio |
|-----------|--------|
| 001-006   | Tablas originales (clientes, facturas, nómina, etc.) |
| 007       | PDF + cliente_id linking + currency tracking |
| 008       | Financial liabilities (3 nuevas tablas) |
| 009       | Cashflow adjustments + déficit flags |
| 010       | Proveedores (vendors) |
| 011       | monto_usd fields |
| 012       | Enhanced expense categories |
| 013       | Storage bucket + RLS policies |

---

## ✅ Verificación Final

Después de completar todos los pasos:

- [ ] Migración 013 ejecutada en Supabase
- [ ] Bucket "invoice-documents" creado
- [ ] OpenAI API Key obtenida
- [ ] Rutas nuevas accesibles:
  - [ ] `/cashflow`
  - [ ] `/proveedores`
  - [ ] `/financial-liabilities`
- [ ] Tipos de cambio funcionando
- [ ] PDF upload + OpenAI Vision funcionando
- [ ] Testing e2e completado

---

## 🆘 Troubleshooting

### "API key inválida" al procesar PDF
- ✓ Verifica que la key comience con `sk-`
- ✓ Que tengas créditos en tu cuenta OpenAI
- ✓ Que la key no esté desactivada en la plataforma

### Storage bucket no creado
- ✓ Verifica que ejecutaste la SQL en Supabase
- ✓ Comprueba que no hay errores de sintaxis
- ✓ Ve a Storage → Buckets para verificar

### Tipos de cambio desactualizados
- ✓ Los datos se cachean por 1 hora
- ✓ El API externo tiene límite de 1500 reqs/mes
- ✓ Si falla, usa tasas predeterminadas automáticamente

---

## 📚 Documentación Adicional

- [OpenAI Vision Guide](https://platform.openai.com/docs/guides/vision)
- [Supabase Storage Docs](https://supabase.com/docs/guides/storage)
- [Exchange Rate API](https://exchangerate-api.com)

---

**¡Listo! Tu aplicación hackÜ Cash Flow ahora tiene todas las capacidades avanzadas. 🎉**
