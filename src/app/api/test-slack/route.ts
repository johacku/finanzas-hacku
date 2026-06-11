import { NextResponse } from "next/server"

export async function GET() {
  const token = process.env.SLACK_BOT_TOKEN
  const hasToken = !!token
  const tokenPreview = token ? `${token.substring(0, 10)}...${token.substring(token.length - 5)}` : 'NOT SET'

  // Try sending a test message if token exists
  if (token) {
    try {
      const res = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          channel: 'C04JUTJQ7AN',
          text: '✅ Test de conexión Slack desde finanzas-hacku — el token funciona correctamente.',
        }),
      })
      const result = await res.json()
      return NextResponse.json({ hasToken, tokenPreview, slackResult: result.ok ? 'SUCCESS' : result.error })
    } catch (e: any) {
      return NextResponse.json({ hasToken, tokenPreview, error: e.message })
    }
  }

  return NextResponse.json({ hasToken, tokenPreview, message: 'SLACK_BOT_TOKEN is not set in environment' })
}
