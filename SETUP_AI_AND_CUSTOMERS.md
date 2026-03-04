# Setup: IA con API Key del Servidor y Customer IDs

## 1. Ejecutar la migración en Supabase

Copia y ejecuta este SQL en **Supabase Dashboard > SQL Editor**:

```sql
-- Migration 015: Add customer_id to income_invoices
-- Allows linking invoices to customers (who can have multiple sociedad_cliente entries)

ALTER TABLE public.income_invoices
ADD COLUMN customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;

CREATE INDEX idx_income_invoices_customer_id ON public.income_invoices(customer_id);
```

## 2. Configurar Variables de Entorno

### En Vercel:
1. Ve a **Settings → Environment Variables**
2. Agrega esta variable:
   - **Key**: `OPENAI_API_KEY`
   - **Value**: (tu API key)
3. Redeploy el proyecto

### En desarrollo (.env.local):
✅ Ya está configurado con tu API key

## 3. Cambios Realizados

### ✅ `/src/lib/ai-processor.ts`
- Ahora usa `process.env.OPENAI_API_KEY` automáticamente
- No requiere que el usuario proporcione API key en la UI
- Parámetro `userApiKey` ahora es opcional

### ✅ `/src/actions/invoice-processor.actions.ts`
- `processInvoiceWithAI()` ya no requiere `userApiKey`
- Auto-crea clientes cuando detecta uno nuevo
- Auto-crea proveedores cuando detecta uno nuevo

### ✅ `/src/components/income-invoices/income-invoice-form.tsx`
- ❌ Removido: Input de OpenAI API Key
- ✅ Agregado: Carga de clientes desde DB
- El botón "Procesar PDF con IA" funciona automáticamente sin pedir API key

### ✅ `/src/components/expense-invoices/expense-invoice-form.tsx`
- ❌ Removido: Input de OpenAI API Key
- El botón "Procesar PDF con IA" funciona automáticamente sin pedir API key

## 4. Cómo Funciona Ahora

### Flujo de Facturas de Ingreso (Income):
1. Usuario carga un PDF
2. Sistema extrae datos automáticamente con IA (usa API key del servidor)
3. Si encuentra un cliente nuevo → lo crea automáticamente
4. El cliente se puede vincular a la factura via `customer_id`
5. Cada cliente puede tener múltiples `sociedad_cliente` (ej: hackU SAS, hackU LLC, etc.)

### Flujo de Facturas de Gastos (Expense):
1. Usuario carga un PDF
2. Sistema extrae datos automáticamente con IA (usa API key del servidor)
3. Si encuentra un proveedor nuevo → lo crea automáticamente

## 5. Próximos Pasos (Opcionales)

- Agregar UI para vincular cliente + sociedad a las facturas de ingreso
- Crear un selector de customer en el formulario de income invoices
- Agregar un campo sociedad_cliente al form de income invoices
