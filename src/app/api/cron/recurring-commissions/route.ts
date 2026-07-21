import { NextResponse } from "next/server"
import { generateRecurringCommissions } from "@/actions/recurring-commissions.actions"

/**
 * GET /api/cron/recurring-commissions
 * Monthly cron: generates 1% recurring commissions for Hunter accounts (from 2nd month)
 */
export async function GET() {
  try {
    const result = await generateRecurringCommissions()
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
