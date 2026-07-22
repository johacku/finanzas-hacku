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
 * Alegra does not sign payloads with HMAC; instead it supports a simple
 * shared-secret token that can be embedded either as:
 *   1. An `x-alegra-token` request header, OR
 *   2. A `secret` or `token` field in the JSON body.
 *
 * If ALEGRA_WEBHOOK_SECRET is not set this function returns `true` and emits a
 * console.warn so the live integration continues working while the secret is
 * being configured.  Once the env var is set, any request that does not supply
 * the correct token is rejected.
 *
 * @param request  The incoming NextRequest (headers are read from it).
 * @param body     The already-parsed JSON body (to avoid consuming the stream twice).
 * @returns `true` when the request is authentic (or the env var is unset),
 *          `false` when the secret is set but the token does not match.
 */
export function verifyAlegraWebhook(
  request: Request,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: Record<string, any>
): boolean {
  const secret = process.env.ALEGRA_WEBHOOK_SECRET

  if (!secret) {
    console.warn(
      "[alegra-webhook] ALEGRA_WEBHOOK_SECRET not set — webhook is unauthenticated"
    )
    return true
  }

  // Accept the token from either the header or the body field.
  const headerToken = request.headers.get("x-alegra-token") ?? ""
  const bodyToken = String(body?.secret ?? body?.token ?? "")

  const tokenToCheck = headerToken || bodyToken

  return safeCompare(tokenToCheck, secret)
}
