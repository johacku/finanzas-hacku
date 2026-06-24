/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

const STRIPE_API = 'https://api.stripe.com/v1'

function getAuthHeader(): string {
  const key = process.env.STRIPE_SECRET_KEY || ''
  return 'Basic ' + Buffer.from(key + ':').toString('base64')
}

async function stripePost(endpoint: string, params: Record<string, string>): Promise<{ success: boolean; data?: any; error?: string }> {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    return { success: false, error: 'STRIPE_SECRET_KEY no configurado' }
  }

  try {
    const body = new URLSearchParams(params)

    const res = await fetch(`${STRIPE_API}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': getAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    })

    const data = await res.json()
    if (!res.ok) {
      const errMsg = data.error?.message || JSON.stringify(data.error) || 'Error desconocido'
      console.error(`[Stripe] ${endpoint} ${res.status}:`, errMsg)
      return { success: false, error: errMsg }
    }

    return { success: true, data }
  } catch (e: any) {
    console.error(`[Stripe] ${endpoint} exception:`, e.message)
    return { success: false, error: e.message }
  }
}

const CURRENCY_MULTIPLIER: Record<string, number> = {
  usd: 100,
  cop: 100,
  mxn: 100,
}

export async function createStripePaymentLink(data: {
  clientName: string
  clientEmail?: string
  description: string
  amount: number
  currency: string
  sociedad: string
  invoiceNumber?: string
}): Promise<{ success: boolean; paymentUrl?: string; error?: string }> {
  const currency = data.currency.toLowerCase()
  const multiplier = CURRENCY_MULTIPLIER[currency] || 100
  const unitAmount = Math.round(data.amount * multiplier)

  if (unitAmount <= 0) {
    return { success: false, error: 'El monto debe ser mayor a 0' }
  }

  // Step 1: Create product
  const prod = await stripePost('/products', {
    name: data.description || `Factura ${data.clientName}`,
    'metadata[sociedad]': data.sociedad,
    'metadata[client_name]': data.clientName,
  })

  if (!prod.success) return { success: false, error: `Producto: ${prod.error}` }

  // Step 2: Create price
  const price = await stripePost('/prices', {
    currency,
    unit_amount: String(unitAmount),
    product: prod.data.id,
  })

  if (!price.success) return { success: false, error: `Precio: ${price.error}` }

  // Step 3: Create payment link
  const link = await stripePost('/payment_links', {
    'line_items[0][price]': price.data.id,
    'line_items[0][quantity]': '1',
    'metadata[sociedad]': data.sociedad,
    'metadata[client_name]': data.clientName,
    'metadata[invoice_number]': data.invoiceNumber || '',
  })

  if (!link.success) return { success: false, error: `Link: ${link.error}` }

  console.log('[Stripe] Payment link created:', link.data.url)

  return {
    success: true,
    paymentUrl: link.data.url,
  }
}
