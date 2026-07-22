import { NextResponse } from "next/server"

export async function GET() {
  const botToken = process.env.SLACK_BOT_TOKEN
  if (!botToken) {
    return NextResponse.json({ error: "SLACK_BOT_TOKEN not configured" }, { status: 500 })
  }

  const channelId = "C04JUTJQ7AN"

  try {
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: channelId,
        text: "🧪 Test desde finanzas-hacku — Slack está funcionando correctamente.",
      }),
    })

    const data = await res.json()
    return NextResponse.json({ ok: data.ok, error: data.error || null, token_prefix: botToken.substring(0, 10) + "..." })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 })
  }
}
