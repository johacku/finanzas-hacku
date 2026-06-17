/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server"

export async function GET() {
  const steps: any[] = []

  // Step 1: Check env vars
  steps.push({
    step: 'env',
    SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'MISSING',
    SUPABASE_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'MISSING',
    SLACK_TOKEN: process.env.SLACK_BOT_TOKEN ? 'SET' : 'MISSING',
    ALEGRA_EMAIL: process.env.ALEGRA_API_EMAIL ? 'SET' : 'MISSING',
  })

  // Step 2: Create Supabase client
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    steps.push({ step: 'supabase_client', status: 'OK' })

    // Step 3: Auth
    try {
      const { data, error } = await supabase.auth.getUser()
      steps.push({ step: 'auth', status: error ? 'ERROR' : 'OK', error: error?.message, user: data?.user?.email })
    } catch (e: any) {
      steps.push({ step: 'auth', status: 'EXCEPTION', error: e.message })
    }

    // Step 4: Query
    try {
      const { data, error } = await (supabase as any)
        .from('alegra_invoice_requests')
        .select('id, status, alegra_client_name, total, created_at')
        .order('created_at', { ascending: false })
        .limit(3)
      steps.push({ step: 'query', status: error ? 'ERROR' : 'OK', error: error?.message, count: data?.length })
    } catch (e: any) {
      steps.push({ step: 'query', status: 'EXCEPTION', error: e.message })
    }

    // Step 5: Try rendering the actual page function
    try {
      const { getAlegraInvoiceRequests } = await import('@/actions/alegra.actions')
      const requests = await getAlegraInvoiceRequests()
      steps.push({ step: 'getAlegraInvoiceRequests', status: 'OK', count: requests?.length })
    } catch (e: any) {
      steps.push({ step: 'getAlegraInvoiceRequests', status: 'EXCEPTION', error: e.message, stack: e.stack?.split('\n').slice(0, 3) })
    }

  } catch (e: any) {
    steps.push({ step: 'supabase_client', status: 'EXCEPTION', error: e.message })
  }

  return NextResponse.json({ steps })
}
