// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// cloudflare-worker/license-server.ts — Pro license management
//
// Endpoints:
//   POST /validate              — check a license key (client calls this)
//   POST /webhook/razorpay      — Razorpay payment webhook
//   POST /webhook/stripe        — Stripe payment webhook
//   POST /admin/create          — manually create a license key (admin only)
//   GET  /health                — health check
//
// KV schema (key = license key string):
//   { email, tier, createdAt, expiry, orderId, payment_provider, active }

export interface Env {
  LICENSES:                KVNamespace
  RAZORPAY_WEBHOOK_SECRET: string
  STRIPE_WEBHOOK_SECRET:   string
  RESEND_API_KEY:          string
  ADMIN_SECRET:            string
}

// ── Types ─────────────────────────────────────────────────────

interface LicenseRecord {
  email:            string
  tier:             'pro'
  createdAt:        number
  expiry:           number        // Unix ms — 0 = lifetime
  orderId:          string
  payment_provider: 'razorpay' | 'stripe' | 'manual'
  active:           boolean
}

// ── Helpers ───────────────────────────────────────────────────

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

function generateLicenseKey(): string {
  const segment = () =>
    Array.from({ length: 5 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('')
  return `${segment()}-${segment()}-${segment()}-${segment()}`
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type':                'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}

function corsPreflightResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}

// ── Email via Resend ──────────────────────────────────────────

async function sendLicenseEmail(
  env:        Env,
  email:      string,
  licenseKey: string,
  expiryDate: string,
): Promise<void> {
  const body = {
    from:    'DevOS <licenses@taracod.com>',
    to:      [email],
    subject: 'Your DevOS Pro License Key',
    html: `
<!DOCTYPE html>
<html>
<body style="font-family:system-ui,sans-serif;max-width:520px;margin:40px auto;color:#e2e8f0;background:#0f172a;padding:32px;border-radius:12px;">
  <h1 style="color:#a78bfa;margin:0 0 8px;">DevOS Pro — Activated</h1>
  <p style="color:#94a3b8;margin:0 0 24px;">Thank you for your purchase. Your license key is below.</p>

  <div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:20px;text-align:center;margin-bottom:24px;">
    <code style="font-size:22px;letter-spacing:4px;color:#f1f5f9;font-weight:700;">${licenseKey}</code>
  </div>

  <p style="color:#94a3b8;font-size:14px;margin-bottom:8px;">
    <strong style="color:#e2e8f0;">Expires:</strong> ${expiryDate}
  </p>

  <p style="color:#94a3b8;font-size:14px;">
    To activate, open DevOS → <strong>Settings → Pro License</strong> → paste your key → click <em>Activate</em>.
  </p>

  <hr style="border:none;border-top:1px solid #334155;margin:24px 0;">

  <p style="color:#64748b;font-size:12px;">
    Save this email. If you lose your key, reply here and we'll resend it.<br>
    Need help? <a href="mailto:contact@taracod.com" style="color:#a78bfa;">contact@taracod.com</a>
  </p>
</body>
</html>`,
  }

  await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

// ── HMAC signature verification ───────────────────────────────

async function verifyHMAC(
  secret:    string,
  body:      string,
  signature: string,
  algo:      'SHA-256' | 'SHA-1' = 'SHA-256',
): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: algo },
    false,
    ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  const hex = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, '0')).join('')
  return hex === signature.replace('sha256=', '').replace('sha1=', '')
}

// ── Endpoint handlers ─────────────────────────────────────────

// POST /validate
async function handleValidate(request: Request, env: Env): Promise<Response> {
  let body: { key?: string }
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ valid: false, error: 'Invalid JSON' }, 400)
  }

  const key = (body.key || '').trim().toUpperCase()
  if (!key || !/^[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/.test(key)) {
    return jsonResponse({ valid: false, error: 'Invalid key format' }, 400)
  }

  const raw = await env.LICENSES.get(key)
  if (!raw) {
    return jsonResponse({ valid: false, error: 'License key not found' }, 404)
  }

  let license: LicenseRecord
  try {
    license = JSON.parse(raw)
  } catch {
    return jsonResponse({ valid: false, error: 'License data corrupt' }, 500)
  }

  if (!license.active) {
    return jsonResponse({ valid: false, error: 'License deactivated' }, 403)
  }

  // Check expiry (0 = lifetime)
  if (license.expiry !== 0 && Date.now() > license.expiry) {
    return jsonResponse({ valid: false, error: 'License expired' }, 403)
  }

  return jsonResponse({
    valid:     true,
    tier:      license.tier,
    email:     license.email,
    expiry:    license.expiry,
    createdAt: license.createdAt,
  })
}

// POST /webhook/razorpay
async function handleRazorpayWebhook(request: Request, env: Env): Promise<Response> {
  const rawBody  = await request.text()
  const sigHeader = request.headers.get('x-razorpay-signature') || ''

  const valid = await verifyHMAC(env.RAZORPAY_WEBHOOK_SECRET, rawBody, sigHeader)
  if (!valid) {
    return jsonResponse({ error: 'Invalid signature' }, 401)
  }

  let event: any
  try {
    event = JSON.parse(rawBody)
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  // Only process successful payment capture
  if (event.event !== 'payment.captured' && event.event !== 'subscription.charged') {
    return jsonResponse({ received: true, action: 'ignored' })
  }

  const payment  = event.payload?.payment?.entity || event.payload?.subscription?.entity || {}
  const email    = payment.email || payment.customer_email || ''
  const orderId  = payment.order_id || payment.id || `rzp_${Date.now()}`
  const amountIn = payment.amount || 0    // in paise

  if (!email) {
    return jsonResponse({ error: 'No email in payload' }, 400)
  }

  // Determine billing period from amount (INR)
  // ₹999/mo = 99900 paise, ₹9588/yr = 958800 paise (20% off)
  const isAnnual = amountIn >= 900000
  const expiry   = isAnnual
    ? Date.now() + 365 * 24 * 60 * 60 * 1000
    : Date.now() + 31  * 24 * 60 * 60 * 1000

  const licenseKey = generateLicenseKey()
  const record: LicenseRecord = {
    email,
    tier:             'pro',
    createdAt:        Date.now(),
    expiry,
    orderId,
    payment_provider: 'razorpay',
    active:           true,
  }

  await env.LICENSES.put(licenseKey, JSON.stringify(record))
  await sendLicenseEmail(env, email, licenseKey, new Date(expiry).toDateString())

  return jsonResponse({ received: true, licenseKey })
}

// POST /webhook/stripe
async function handleStripeWebhook(request: Request, env: Env): Promise<Response> {
  const rawBody  = await request.text()
  const sigHeader = request.headers.get('stripe-signature') || ''

  // Stripe uses a more complex HMAC-SHA256 with timestamp
  // Format: t=<timestamp>,v1=<sig>
  const parts     = Object.fromEntries(sigHeader.split(',').map(p => p.split('=')))
  const timestamp = parts['t'] || ''
  const v1Sig     = parts['v1'] || ''
  const signedPayload = `${timestamp}.${rawBody}`

  const valid = await verifyHMAC(env.STRIPE_WEBHOOK_SECRET, signedPayload, v1Sig)
  if (!valid) {
    return jsonResponse({ error: 'Invalid signature' }, 401)
  }

  let event: any
  try {
    event = JSON.parse(rawBody)
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  const type = event.type || ''

  // Handle checkout.session.completed (one-time or first subscription payment)
  if (type === 'checkout.session.completed' || type === 'invoice.payment_succeeded') {
    const obj       = event.data?.object || {}
    const email     = obj.customer_email || obj.customer_details?.email || ''
    const sessionId = obj.id || `stripe_${Date.now()}`
    const mode      = obj.mode || 'payment'    // 'payment' or 'subscription'
    const interval  = obj.metadata?.interval || 'monthly'

    if (!email) {
      return jsonResponse({ error: 'No email in payload' }, 400)
    }

    const isAnnual = interval === 'annual' || mode === 'subscription'
    const expiry   = isAnnual
      ? Date.now() + 365 * 24 * 60 * 60 * 1000
      : Date.now() + 31  * 24 * 60 * 60 * 1000

    const licenseKey = generateLicenseKey()
    const record: LicenseRecord = {
      email,
      tier:             'pro',
      createdAt:        Date.now(),
      expiry,
      orderId:          sessionId,
      payment_provider: 'stripe',
      active:           true,
    }

    await env.LICENSES.put(licenseKey, JSON.stringify(record))
    await sendLicenseEmail(env, email, licenseKey, new Date(expiry).toDateString())

    return jsonResponse({ received: true, licenseKey })
  }

  // Handle subscription cancellation or payment failure
  if (type === 'customer.subscription.deleted' || type === 'invoice.payment_failed') {
    // We don't auto-revoke here — we let the expiry handle it gracefully
    return jsonResponse({ received: true, action: 'noted' })
  }

  return jsonResponse({ received: true, action: 'ignored' })
}

// POST /admin/create
async function handleAdminCreate(request: Request, env: Env): Promise<Response> {
  const authHeader = request.headers.get('Authorization') || ''
  if (authHeader !== `Bearer ${env.ADMIN_SECRET}`) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  let body: { email?: string; tier?: string; durationDays?: number; orderId?: string }
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400)
  }

  const email       = (body.email || '').trim()
  const tier        = body.tier || 'pro'
  const days        = body.durationDays ?? 365
  const orderId     = body.orderId || `manual_${Date.now()}`

  if (!email || !email.includes('@')) {
    return jsonResponse({ error: 'Valid email required' }, 400)
  }

  const expiry     = days === 0 ? 0 : Date.now() + days * 24 * 60 * 60 * 1000
  const licenseKey = generateLicenseKey()

  const record: LicenseRecord = {
    email,
    tier:             'pro',
    createdAt:        Date.now(),
    expiry,
    orderId,
    payment_provider: 'manual',
    active:           true,
  }

  await env.LICENSES.put(licenseKey, JSON.stringify(record))

  if (env.RESEND_API_KEY) {
    await sendLicenseEmail(
      env,
      email,
      licenseKey,
      expiry === 0 ? 'Never (Lifetime)' : new Date(expiry).toDateString(),
    )
  }

  return jsonResponse({ success: true, licenseKey, email, expiry })
}

// ── Main fetch handler ────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { method, url } = request
    const { pathname }    = new URL(url)

    // CORS preflight
    if (method === 'OPTIONS') return corsPreflightResponse()

    // Health
    if (method === 'GET' && pathname === '/health') {
      return jsonResponse({ status: 'ok', ts: Date.now() })
    }

    // Validate
    if (method === 'POST' && pathname === '/validate') {
      return handleValidate(request, env)
    }

    // Razorpay webhook
    if (method === 'POST' && pathname === '/webhook/razorpay') {
      return handleRazorpayWebhook(request, env)
    }

    // Stripe webhook
    if (method === 'POST' && pathname === '/webhook/stripe') {
      return handleStripeWebhook(request, env)
    }

    // Admin create
    if (method === 'POST' && pathname === '/admin/create') {
      return handleAdminCreate(request, env)
    }

    return jsonResponse({ error: 'Not found' }, 404)
  },
}
