# Vercel Deployment Setup

## Opción 1: Setup Manual (Recomendado - 2 minutos)

### 1. Conectar GitHub a Vercel
1. Ve a [vercel.com](https://vercel.com)
2. Haz login o crea una cuenta
3. Haz clic en "New Project"
4. Selecciona "Import Git Repository"
5. Busca y selecciona `johacku/finanzas-hacku`
6. Haz clic en "Import"

### 2. Configurar Variables de Entorno
Después de importar, verás una pantalla de configuración:

1. En "Environment Variables", agrega:
   - **Key**: `OPENAI_API_KEY`
   - **Value**: (tu API key)
   - **Environments**: Selecciona "Production" y "Preview"

2. También agrega (si no están):
   - `NEXT_PUBLIC_SUPABASE_URL`: `https://zipgcfmwvvjtmjwvrywz.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: `sb_publishable_4SHDVysHMSJdVhrUuZvhMw_iKPSstMp`

3. Haz clic en "Deploy"

### 3. Verificar Deploy
- El proyecto comenzará a deployarse automáticamente
- Espera a que termine (toma ~2-3 minutos)
- Verás una URL como `https://finanzas-hacku.vercel.app`

---

## Opción 2: Configuración Automática (CLI)

Si tienes Vercel CLI instalado:

```bash
# 1. Instalar Vercel CLI (si no está instalado)
npm i -g vercel

# 2. Login a Vercel
vercel login

# 3. Link al proyecto
vercel link

# 4. Configurar variables de entorno
vercel env add OPENAI_API_KEY
# Pega tu API key cuando se pida

# 5. Deploy a producción
vercel --prod
```

---

## Después del Deploy

✅ Vercel automáticamente:
- Deployará cada push a `main`
- Los PRs crearán "Preview Deployments"
- Las variables de entorno estarán disponibles en todas las funciones serverless

### Monitorear Deployments
- Ve a tu dashboard en [vercel.com/dashboard](https://vercel.com/dashboard)
- Verás todos los deployments
- Los logs estarán disponibles para cada deploy
