/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()

    // Step 1: test query
    const { data, error } = await (supabase as any)
      .from('alegra_invoice_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5)

    if (error) {
      return NextResponse.json({ step: 'query', error: error.message, details: error })
    }

    // Step 2: test user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError) {
      return NextResponse.json({ step: 'auth', error: userError.message })
    }

    // Step 3: check data shape
    const latest = data?.[0]

    return NextResponse.json({
      success: true,
      totalRequests: data?.length,
      userEmail: user?.email,
      latestRequest: latest ? {
        id: latest.id,
        status: latest.status,
        client: latest.alegra_client_name,
        total: latest.total,
        moneda: latest.moneda,
        items: latest.items ? `${Array.isArray(latest.items) ? latest.items.length : typeof latest.items} items` : 'null',
        itemsSample: Array.isArray(latest.items) ? latest.items[0] : latest.items,
      } : null,
    })
  } catch (e: any) {
    return NextResponse.json({ step: 'exception', error: e.message, stack: e.stack?.split('\n').slice(0, 5) })
  }
}
