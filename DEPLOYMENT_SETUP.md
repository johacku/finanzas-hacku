# Deployment Setup Guide

## Vercel Environment Variables Required

For the application to deploy successfully on Vercel, the following environment variables must be configured:

### Public Variables (NEXT_PUBLIC_*)
These variables are exposed to the browser and are safe to be public:

```
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
```

### Server-Only Variables
These variables run only on the server and are secure:

```
OPENAI_API_KEY=<your-openai-api-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
CRON_SECRET=<random-secret-used-by-vercel-cron-and-admin-endpoints>
ALEGRA_WEBHOOK_SECRET=<shared-secret-configured-in-alegras-webhook-dashboard>
```

**CRON_SECRET** — Required. Must be set before any cron or admin/backfill routes
will accept requests. Vercel Cron sends it automatically as
`Authorization: Bearer <CRON_SECRET>`. Generate with `openssl rand -hex 32`.

**ALEGRA_WEBHOOK_SECRET** — **Required in production.** The
`/api/alegra-webhook` endpoint requires the incoming request to include this
value in either the `x-alegra-token` header or the `secret`/`token` body field.
Configure the same value in Alegra's webhook dashboard. If left unset in a
`NODE_ENV=production` deployment the endpoint will **reject all requests with
401** (fail closed) to prevent unauthenticated mutation of financial records.
In non-production environments (dev/preview/test) the endpoint falls back to
accepting all requests with a console warning so local testing is not blocked.

## Setup Instructions

1. Go to https://vercel.com/dashboard/[your-project]
2. Click **Settings** → **Environment Variables**
3. Add each variable from above
4. Vercel will automatically redeploy with the new variables

## Build Configuration

The `vercel.json` file configures:
- **buildCommand**: `npm run build` - Compiles the Next.js application
- **outputDirectory**: `.next` - Where Next.js outputs the build artifacts
- **framework**: `nextjs` - Tells Vercel this is a Next.js project
- **nodeVersion**: `18.x` - Node.js runtime version

## What's Included

✅ Server-side AI processing (no API key input required from users)
✅ Auto-create customers/vendors when detected in PDFs
✅ Customer selector in income invoice form
✅ Database migrations for customer linking
✅ Proper environment variable configuration for production

## Troubleshooting

If deployment fails with "No Output Directory named 'public' found":
- Ensure `vercel.json` is present in the root directory
- Verify the `outputDirectory` is set to `.next`
- Run `npm run build` locally to verify it builds successfully
