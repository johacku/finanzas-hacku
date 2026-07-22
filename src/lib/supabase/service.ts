import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

/**
 * createServiceClient — returns a Supabase client authenticated with the
 * service-role key, which bypasses Row Level Security entirely.
 *
 * IMPORTANT SECURITY CONSTRAINTS:
 *   - This client MUST only be used in trusted server-side contexts (API routes,
 *     server actions called from those routes, or background jobs).
 *   - It must NEVER be imported by browser code or any route reachable without
 *     prior authentication/authorisation (e.g. a public GET endpoint).
 *   - The SUPABASE_SERVICE_ROLE_KEY env var must never be exposed to the client
 *     bundle (it intentionally lacks the NEXT_PUBLIC_ prefix).
 *
 * Because this client is stateless and carries no user session, we disable
 * session persistence and token auto-refresh — both are meaningless (and
 * slightly wasteful) for a service-role connection.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) {
    throw new Error(
      '[supabase/service] NEXT_PUBLIC_SUPABASE_URL is not configured. ' +
        'Ensure this environment variable is set in Vercel (all environments).'
    )
  }

  if (!serviceRoleKey) {
    throw new Error(
      '[supabase/service] SUPABASE_SERVICE_ROLE_KEY is not configured. ' +
        'Ensure this secret is set in Vercel (Production + Preview) and is NOT ' +
        'prefixed with NEXT_PUBLIC_.'
    )
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      // Service-role clients are stateless — no user session to persist or refresh.
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
