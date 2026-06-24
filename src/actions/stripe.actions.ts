/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

/**
 * Stripe Payment Links integration
 * Creates product → price → payment link for invoice requests
 */

const STRIPE_API = 'https://api.stripe.com/v1'

async function stripeFetch(endpoint: string, body: Record<string, any>) {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    console.error('[Stripe] STRIPE_SECRET_KEY not configured')
    return { success: false, error: 'Stripe no configurado' }
  }

  try {
    // Convert nested objects to form-urlencoded format
    const formBody = new URLSearchParams()
    const flatten = (obj: any, prefix = ''): void => {
      for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}[${key}]` : key
        if (value !== null && value !== undefined) {
          if (typeof value === 'object' && !Array.isArray(value)) {
            flatten(value, fullKey)
          } else {
            formBody.append(fullKey, String(value))
          }
        }
      }
    }
    flatten(body)

    const res = await fetch(`${STRIPE_API}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formBody.toString(),
    })

    const data = await res.json()
    if (!res.ok) {
      console.error(`[Stripe] ${endpoint} error:`, data.error?.message || data)
      return { success: false, error: data.error?.message || 'Stripe error' }
    }

    return { success: true, data }
  } catch (e: any) {
    console.error('[Stripe] Exception:', e.message)
    return { success: false, error: e.message }
  }
}

// Currency to smallest unit multiplier
const CURRENCY_MULTIPLIER: Record<string, number> = {
  usd: 100,
  cop: 100,
  mxn: 100,
}

/**
 * Create a Stripe payment link for an invoice
 */
export async function createStripePaymentLink(data: {
  clientName: string
  clientEmail?: string
  description: string
  amount: number // In the currency's standard unit (e.g., 100.50 USD)
  currency: string // USD, COP, MXN
  sociedad: string
  invoiceNumber?: string
}) {
  const currency = data.currency.toLowerCase()
  const multiplier = CURRENCY_MULTIPLIER[currency] || 100
  const unitAmount = Math.round(data.amount * multiplier)

  if (unitAmount <= 0) {
    return { success: false, error: 'El monto debe ser mayor a 0' }
  }

  // Step 1: Create product
  const productResult = await stripeFetch('/products', {
    name: data.description || `Factura ${data.clientName}`,
    metadata: {
      sociedad: data.sociedad,
      client_name: data.clientName,
      invoice_number: data.invoiceNumber || '',
    },
  })

  if (!productResult.success) {
    return { success: false, error: `Producto: ${productResult.error}` }
  }

  const productId = productResult.data.id

  // Step 2: Create price
  const priceResult = await stripeFetch('/prices', {
    currency,
    unit_amount: unitAmount,
    product: productId,
  })

  if (!priceResult.success) {
    return { success: false, error: `Precio: ${priceResult.error}` }
  }

  const priceId = priceResult.data.id

  // Step 3: Create payment link
  // Stripe requires array notation for line_items, so we build URLSearchParams directly
  const secretKey = process.env.STRIPE_SECRET_KEY
  try {
    const formBody = new URLSearchParams()
    formBody.append('line_items[0][price]', priceId)
    formBody.append('line_items[0][quantity]', '1')
    if (data.invoiceNumber) {
      formBody.append('metadata[invoice_number]', data.invoiceNumber)
    }
    formBody.append('metadata[sociedad]', data.sociedad)
    formBody.append('metadata[client_name]', data.clientName)

    const res = await fetch(`${STRIPE_API}/payment_links`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formBody.toString(),
    })

    const linkData = await res.json()
    if (!res.ok) {
      return { success: false, error: `Link: ${linkData.error?.message || 'Error'}` }
    }

    return {
      success: true,
      paymentUrl: linkData.url,
      productId,
      priceId,
      linkId: linkData.id,
    }
  } catch (e: any) {
    return { success: false, error: `Link: ${e.message}` }
  }
}
