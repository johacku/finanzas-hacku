import { NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"

/**
 * Constant-time string comparison using node's crypto.timingSafeEqual.
 * Always operates on equal-length buffers; if lengths differ, returns false
 * without revealing which side is shorter (preventing length-based timing attacks).
 */
function safeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  // Pad the shorter buffer so timingSafeEqual can compare equal lengths.
  // We still return false when lengths differ — this just prevents the
  // length comparison from being an early exit that leaks timing info.
  if (aBuf.length !== bBuf.length) {
    // Compare against a dummy buffer of the same length as `a` so we always
    // take the same code path, then unconditionally return false.
    timingSafeEqual(aBuf, Buffer.alloc(aBuf.length))
    return false
  }
  return timingSafeEqual(aBuf, bBuf)
}

/**
 * requireCronSecret — guards cron/admin routes with a shared secret.
 *
 * Vercel Cron automatically sends `Authorization: Bearer <CRON_SECRET>` with
 * every scheduled invocation, so this check is transparent to the scheduler.
 *
 * FAIL CLOSED: if CRON_SECRET is unset or empty the helper returns a 500 rather
 * than allowing the request through (the original bug was a fail-open guard of
 * the form `if (process.env.CRON_SECRET && ...)` which disabled auth entirely
 * when the env var was missing).
 *
 * @returns A NextResponse to return immediately when the request is denied,
 *          or `null` when the caller should proceed normally.
 */
export function requireCronSecret(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET

  if (!secret) {
    console.error("[api-auth] CRON_SECRET is not configured")
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 }
    )
  }

  const authHeader = request.headers.get("authorization") ?? ""
  const expected = `Bearer ${secret}`

  if (!safeCompare(authHeader, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return null
}

/**
 * verifyAlegraWebhook — validates an incoming Alegra webhook request.
 *
 * PRIMARY mechanism: Alegra's API lets you register a webhook URL verbatim, so
 * the secret is embedded as a `?token=<ALEGRA_WEBHOOK_SECRET>` query parameter
 * in the registered URL (e.g. `https://example.com/api/alegra-webhook?token=<secret>`).
 * Alegra reflects that full URL on every POST, so the token arrives automatically
 * without any per-request signing.
 *
 * FALLBACK mechanisms (kept for compatibility / future Alegra improvements):
 *   2. An `x-alegra-token` request header.
 *   3. A `secret` or `token` field in the JSON body.
 *
 * SECURITY NOTE — URL token vs. logs: embedding the secret in the URL means it
 * will appear in server/access logs and Alegra's own webhook logs. This is an
 * accepted tradeoff: Alegra provides no better mechanism (no HMAC signing, no
 * configurable header), and even if the token were intercepted, an attacker
 * could only trigger mutations on rows already keyed by a known alegra_invoice_id,
 * with no privilege escalation or data exfiltration possible from this endpoint.
 * Rotate ALEGRA_WEBHOOK_SECRET (and re-register the webhook URL) if the secret
 * is believed to be compromised.
 *
 * Fail-open on a financial webhook is only acceptable as a non-production
 * convenience (e.g. local dev or preview deployments where the secret has not
 * yet been configured).  In production the secret MUST be present; if it is
 * missing the request is rejected to prevent unauthenticated mutation of
 * financial records.
 *
 * Unset-secret behaviour:
 *   - NODE_ENV === 'production'  → FAIL CLOSED: returns false (→ 401)
 *   - any other environment      → FAIL OPEN:  returns true with a console.warn
 *                                   so local/preview testing is not blocked
 *
 * @param request  The incoming NextRequest (headers and URL are read from it).
 * @param body     The already-parsed JSON body (to avoid consuming the stream twice).
 * @returns `true` when the request is authentic (or in non-prod with no secret set),
 *          `false` when the secret is set but the token does not match, OR when
 *          the secret is unset in a production environment.
 */
export function verifyAlegraWebhook(
  request: Request,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: Record<string, any>
): boolean {
  const secret = process.env.ALEGRA_WEBHOOK_SECRET

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      // Production MUST have the secret configured — reject the request.
      console.error(
        "[alegra-webhook] ALEGRA_WEBHOOK_SECRET is not set in production. " +
          "The webhook will be rejected until the secret is configured. " +
          "Register the webhook in Alegra with a URL containing ?token=<ALEGRA_WEBHOOK_SECRET>."
      )
      return false
    }

    // Non-production (dev / preview / test): allow through with a warning so
    // local and staging testing is not blocked while the secret is being rolled out.
    console.warn(
      "[alegra-webhook] ALEGRA_WEBHOOK_SECRET not set — webhook is unauthenticated " +
        "(acceptable in non-production environments only)"
    )
    return true
  }

  // 1. Primary: token in the ?token= query param of the registered webhook URL.
  const url = new URL(request.url)
  const queryToken = url.searchParams.get("token") ?? ""

  // 2 & 3. Fallbacks: x-alegra-token header or secret/token body field.
  const headerToken = request.headers.get("x-alegra-token") ?? ""
  const bodyToken = String(body?.secret ?? body?.token ?? "")

  const tokenToCheck = queryToken || headerToken || bodyToken

  return safeCompare(tokenToCheck, secret)
}
