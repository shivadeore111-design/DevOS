// Aiden License Server — api.taracod.com
// Free: 100 credits/day | Pro: unlimited | Razorpay payments

const FREE_DAILY_CREDITS = 100
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

// ─── Razorpay config ───────────────────────────────────────
// Razorpay supports: UPI, GPay, PhonePe, Cards, NetBanking,
// International cards, Wallets — all in one integration
// Plans (set your pricing here):
const PRO_PLAN_INR = 499   // ₹499/month
const PRO_PLAN_USD = 6     // $6/month for international
// ──────────────────────────────────────────────────────────

function generateLicenseKey() {
  const s = () => Array.from({ length: 5 }, () =>
    CHARS[Math.floor(Math.random() * CHARS.length)]
  ).join('')
  return `${s()}-${s()}-${s()}-${s()}`
}

function generateToken() {
  const c = 'abcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from({ length: 32 }, () =>
    c[Math.floor(Math.random() * c.length)]
  ).join('')
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  })
}

function cors() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  })
}

async function sendEmail(env, to, subject, html) {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'Aiden <hello@taracod.com>',
      to: [to],
      subject,
      html
    })
  })
}

async function sendDownloadEmail(env, email, token) {
  const url = `https://api.taracod.com/download/${token}`
  await sendEmail(env, email,
    'Welcome to Aiden — Your Download Link', `
<!DOCTYPE html>
<html>
<body style="font-family:system-ui;max-width:520px;margin:40px auto;
  color:#e2e8f0;background:#0f172a;padding:32px;border-radius:12px;">
  <h1 style="color:#f97316;margin:0 0 8px;">Welcome to Aiden</h1>
  <p style="color:#94a3b8;margin:0 0 16px;">
    Your personal AI OS is ready. Free plan — all features included.
  </p>
  <div style="background:#1e293b;border:1px solid #334155;
    border-radius:8px;padding:16px;margin-bottom:24px;">
    <p style="color:#e2e8f0;font-size:13px;font-weight:600;margin:0 0 8px;">
      Free Plan includes:
    </p>
    <ul style="color:#94a3b8;font-size:13px;margin:0;
      padding-left:20px;line-height:2.2;">
      <li>All 44 features and 31 agents</li>
      <li>100 AI credits per day</li>
      <li>Unlimited local Ollama (no credits used)</li>
      <li>Full memory, skills, workflow view</li>
    </ul>
  </div>
  <div style="text-align:center;margin:32px 0;">
    <a href="${url}"
      style="background:#f97316;color:#000;padding:14px 32px;
      border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;">
      Download Aiden v3.1.0
    </a>
  </div>
  <p style="color:#64748b;font-size:12px;text-align:center;">
    Link expires in 48 hours · Windows 10/11 required
  </p>
  <p style="color:#64748b;font-size:13px;margin-top:8px;text-align:center;">
    ⚠️ Also need Node.js installed?
    <a href="https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi"
      style="color:#f97316;font-weight:600;">
      Download Node.js v20 for Windows →
    </a>
    (Install this first, then run Aiden)
  </p>
  <hr style="border:none;border-top:1px solid #334155;margin:24px 0;">
  <p style="color:#64748b;font-size:12px;">
    Need unlimited credits?
    <a href="https://aiden.taracod.com/#pro" style="color:#f97316;">
      Upgrade to Pro — ₹499/month
    </a>
  </p>
  <p style="color:#64748b;font-size:12px;">
    Questions?
    <a href="mailto:hello@taracod.com" style="color:#f97316;">
      hello@taracod.com
    </a>
  </p>
</body>
</html>`)
}

async function sendLicenseEmail(env, email, licenseKey, expiryDate) {
  await sendEmail(env, email,
    'Aiden Pro — License Key Activated', `
<!DOCTYPE html>
<html>
<body style="font-family:system-ui;max-width:520px;margin:40px auto;
  color:#e2e8f0;background:#0f172a;padding:32px;border-radius:12px;">
  <h1 style="color:#f97316;margin:0 0 8px;">Aiden Pro Activated</h1>
  <p style="color:#94a3b8;margin:0 0 24px;">
    Unlimited credits. No daily limits. Priority support.
  </p>
  <div style="background:#1e293b;border:1px solid #334155;
    border-radius:8px;padding:20px;text-align:center;margin-bottom:24px;">
    <p style="color:#64748b;font-size:11px;margin:0 0 8px;">
      YOUR LICENSE KEY
    </p>
    <code style="font-size:22px;letter-spacing:4px;
      color:#f1f5f9;font-weight:700;">${licenseKey}</code>
  </div>
  <p style="color:#94a3b8;font-size:14px;">
    <strong style="color:#e2e8f0;">Expires:</strong> ${expiryDate}
  </p>
  <p style="color:#94a3b8;font-size:13px;margin-top:12px;">
    Open Aiden → Settings → Pro License → paste key → Activate
  </p>
  <hr style="border:none;border-top:1px solid #334155;margin:24px 0;">
  <p style="color:#64748b;font-size:12px;">
    <a href="mailto:hello@taracod.com" style="color:#f97316;">
      hello@taracod.com
    </a>
  </p>
</body>
</html>`)
}

// ─── Credit Tracking ────────────────────────────────────────

function todayKey() {
  return new Date().toISOString().split('T')[0]
}

async function getCredits(env, email) {
  // Check pro license first
  const emailRaw = await env.REGISTRATIONS.get(`email:${email}`)
  if (emailRaw) {
    const record = JSON.parse(emailRaw)
    if (record.licenseKey) {
      const licRaw = await env.LICENSES.get(record.licenseKey)
      if (licRaw) {
        const lic = JSON.parse(licRaw)
        if (lic.active && (lic.expiry === 0 || Date.now() < lic.expiry)) {
          return {
            tier: 'pro',
            remaining: 999999,
            limit: 999999,
            resetAt: null,
            email
          }
        }
      }
    }
  }

  // Free tier
  const key = `credits:${email}:${todayKey()}`
  const usedRaw = await env.REGISTRATIONS.get(key)
  const used = usedRaw ? parseInt(usedRaw) : 0
  const remaining = Math.max(0, FREE_DAILY_CREDITS - used)
  const tomorrow = new Date()
  tomorrow.setUTCHours(24, 0, 0, 0)

  return {
    tier: 'free',
    remaining,
    limit: FREE_DAILY_CREDITS,
    used,
    resetAt: tomorrow.toISOString(),
    email
  }
}

async function consumeCredit(env, email, amount = 1) {
  const credits = await getCredits(env, email)
  if (credits.tier === 'pro') {
    return { allowed: true, remaining: 999999, tier: 'pro' }
  }
  if (credits.remaining <= 0) {
    return {
      allowed: false,
      remaining: 0,
      tier: 'free',
      message: 'Daily limit reached. Upgrade to Pro for unlimited usage.',
      upgradeUrl: 'https://aiden.taracod.com/#pro'
    }
  }
  const key = `credits:${email}:${todayKey()}`
  const newUsed = (credits.used || 0) + amount
  await env.REGISTRATIONS.put(
    key,
    String(newUsed),
    { expirationTtl: 25 * 3600 }
  )
  return {
    allowed: true,
    remaining: FREE_DAILY_CREDITS - newUsed,
    tier: 'free'
  }
}

// ─── Razorpay Payment ───────────────────────────────────────

async function handleCreateOrder(request, env) {
  let body
  try { body = await request.json() } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const email = (body.email || '').trim().toLowerCase()
  const currency = body.currency || 'INR'
  if (!email || !email.includes('@')) {
    return json({ error: 'Valid email required' }, 400)
  }

  // Amount in smallest unit (paise for INR, cents for USD)
  const amount = currency === 'INR'
    ? PRO_PLAN_INR * 100
    : PRO_PLAN_USD * 100

  // Create Razorpay order
  const authStr = btoa(
    `${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`
  )

  const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${authStr}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      amount,
      currency,
      receipt: `aiden_pro_${Date.now()}`,
      notes: { email, product: 'aiden_pro' }
    })
  })

  if (!orderRes.ok) {
    const err = await orderRes.text()
    return json({ error: 'Failed to create order', details: err }, 500)
  }

  const order = await orderRes.json()

  return json({
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId: env.RAZORPAY_KEY_ID,
    email,
    prefill: {
      email,
      // GPay/UPI prefill
      method: currency === 'INR' ? 'upi' : 'card'
    }
  })
}

async function handleVerifyPayment(request, env) {
  let body
  try { body = await request.json() } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    email
  } = body

  if (!razorpay_order_id || !razorpay_payment_id ||
      !razorpay_signature || !email) {
    return json({ error: 'Missing payment details' }, 400)
  }

  // Verify signature
  const signaturePayload =
    `${razorpay_order_id}|${razorpay_payment_id}`
  const isValid = await verifyHMAC(
    env.RAZORPAY_KEY_SECRET,
    signaturePayload,
    razorpay_signature
  )

  if (!isValid) {
    return json({ error: 'Invalid payment signature' }, 400)
  }

  // Generate and store license
  const expiry = Date.now() + 31 * 24 * 3600 * 1000
  const licenseKey = generateLicenseKey()

  await env.LICENSES.put(licenseKey, JSON.stringify({
    email: email.toLowerCase(),
    tier: 'pro',
    createdAt: Date.now(),
    expiry,
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    payment_provider: 'razorpay',
    active: true
  }))

  // Link to email record
  const emailRaw = await env.REGISTRATIONS.get(
    `email:${email.toLowerCase()}`
  )
  const emailRecord = emailRaw
    ? JSON.parse(emailRaw)
    : { email: email.toLowerCase(), registeredAt: Date.now(), machineIds: [] }

  emailRecord.licenseKey = licenseKey
  emailRecord.tier = 'pro'
  await env.REGISTRATIONS.put(
    `email:${email.toLowerCase()}`,
    JSON.stringify(emailRecord)
  )

  await sendLicenseEmail(
    env,
    email.toLowerCase(),
    licenseKey,
    new Date(expiry).toDateString()
  )

  return json({
    success: true,
    licenseKey,
    tier: 'pro',
    expiry: new Date(expiry).toDateString()
  })
}

// ─── Razorpay Webhook (subscription auto-renewal) ──────────

async function handleRazorpayWebhook(request, env) {
  const rawBody = await request.text()
  const sig = request.headers.get('x-razorpay-signature') || ''

  if (!await verifyHMAC(env.RAZORPAY_WEBHOOK_SECRET, rawBody, sig)) {
    return json({ error: 'Invalid signature' }, 401)
  }

  const event = JSON.parse(rawBody)

  if (event.event !== 'payment.captured' &&
      event.event !== 'subscription.charged') {
    return json({ received: true })
  }

  const payment = event.payload?.payment?.entity || {}
  const email = (payment.email || '').toLowerCase()
  if (!email) return json({ error: 'No email' }, 400)

  const expiry = Date.now() + 31 * 24 * 3600 * 1000
  const licenseKey = generateLicenseKey()

  await env.LICENSES.put(licenseKey, JSON.stringify({
    email, tier: 'pro',
    createdAt: Date.now(), expiry,
    orderId: payment.order_id,
    paymentId: payment.id,
    payment_provider: 'razorpay',
    active: true
  }))

  // Link license to email
  const emailRaw = await env.REGISTRATIONS.get(`email:${email}`)
  if (emailRaw) {
    const emailRecord = JSON.parse(emailRaw)
    emailRecord.licenseKey = licenseKey
    emailRecord.tier = 'pro'
    await env.REGISTRATIONS.put(
      `email:${email}`,
      JSON.stringify(emailRecord)
    )
  }

  await sendLicenseEmail(
    env, email, licenseKey,
    new Date(expiry).toDateString()
  )

  return json({ received: true, licenseKey })
}

// ─── Other Handlers ─────────────────────────────────────────

async function handleRegister(request, env) {
  let body
  try { body = await request.json() } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }
  const email = (body.email || '').trim().toLowerCase()
  if (!email || !email.includes('@')) {
    return json({ error: 'Valid email required' }, 400)
  }

  const token = generateToken()
  const tokenRecord = {
    email, token,
    createdAt: Date.now(),
    expiresAt: Date.now() + 48 * 3600 * 1000
  }
  const existing = await env.REGISTRATIONS.get(`email:${email}`)
  const emailRecord = existing
    ? JSON.parse(existing)
    : { email, registeredAt: Date.now(), machineIds: [] }

  emailRecord.lastToken = token
  emailRecord.updatedAt = Date.now()

  await env.REGISTRATIONS.put(
    `token:${token}`,
    JSON.stringify(tokenRecord),
    { expirationTtl: 48 * 3600 }
  )
  await env.REGISTRATIONS.put(
    `email:${email}`,
    JSON.stringify(emailRecord)
  )
  await sendDownloadEmail(env, email, token)

  return json({
    success: true,
    message: 'Check your email for the download link'
  })
}

async function handleVerifyInstall(request, env) {
  let body
  try { body = await request.json() } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }
  const email = (body.email || '').trim().toLowerCase()
  const machineId = (body.machineId || '').trim()
  if (!email || !machineId) {
    return json({ allowed: false, reason: 'Email and machine ID required' })
  }

  const raw = await env.REGISTRATIONS.get(`email:${email}`)
  if (!raw) {
    return json({
      allowed: false,
      reason: 'Email not registered. Get access at aiden.taracod.com'
    })
  }

  const record = JSON.parse(raw)
  if (!record.machineIds) record.machineIds = []
  if (record.machineIds.includes(machineId)) return json({ allowed: true })
  if (record.machineIds.length < 2) {
    record.machineIds.push(machineId)
    await env.REGISTRATIONS.put(`email:${email}`, JSON.stringify(record))
    return json({ allowed: true })
  }

  return json({
    allowed: false,
    reason: 'Active on 2 machines already. Email hello@taracod.com to transfer.'
  })
}

async function handleDownload(request, env) {
  const token = new URL(request.url).pathname.split('/download/')[1]
  if (!token) return json({ error: 'Invalid link' }, 400)

  const raw = await env.REGISTRATIONS.get(`token:${token}`)
  const expired = !raw || Date.now() > JSON.parse(raw || '{}').expiresAt

  if (expired) return new Response(`<!DOCTYPE html>
<html>
<body style="font-family:system-ui;text-align:center;padding:60px;
  background:#0f172a;color:#e2e8f0;">
  <h1 style="color:#f97316;">Link Expired</h1>
  <p style="color:#94a3b8;">This download link has expired.</p>
  <a href="https://aiden.taracod.com"
    style="color:#f97316;font-weight:600;">
    Get a new link →
  </a>
</body>
</html>`, {
    status: 410,
    headers: { 'Content-Type': 'text/html' }
  })

  const record = JSON.parse(raw)

  return new Response(`<!DOCTYPE html>
<html>
<head>
  <title>Download Aiden v3.1.0</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="font-family:system-ui;text-align:center;padding:60px 20px;
  background:#0f172a;color:#e2e8f0;max-width:600px;margin:0 auto;">
  <div style="width:60px;height:60px;background:#f97316;border-radius:14px;
    margin:0 auto 16px;display:flex;align-items:center;justify-content:center;
    font-size:20px;font-weight:800;color:#000;font-family:monospace;">A/</div>
  <h1 style="color:#f1f5f9;font-size:28px;margin:0 0 8px;">
    Download Aiden v3.1.0
  </h1>
  <p style="color:#94a3b8;margin:0 0 32px;">
    Personal AI OS · 100% local · All features free
  </p>

  <div style="background:#1e293b;border-radius:12px;padding:24px;
    margin-bottom:20px;text-align:left;">
    <p style="color:#e2e8f0;font-weight:600;margin:0 0 12px;">
      Quick setup (2 minutes):
    </p>
    <ol style="color:#94a3b8;line-height:2.4;margin:0;
      padding-left:20px;font-size:14px;">
      <li>Download <strong style="color:#e2e8f0;">
        Aiden-Setup-3.1.0.exe
      </strong></li>
      <li>Run installer → follow wizard</li>
      <li>Launch Aiden from Desktop</li>
      <li>Enter this email when prompted:
        <strong style="color:#f97316;">${record.email}</strong>
      </li>
    </ol>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;
    margin-bottom:28px;text-align:left;">
    <div style="background:#1e293b;border:1px solid #334155;
      border-radius:8px;padding:16px;">
      <p style="color:#94a3b8;font-size:12px;font-weight:700;
        margin:0 0 6px;text-transform:uppercase;letter-spacing:.05em;">
        Free Plan
      </p>
      <p style="color:#64748b;font-size:12px;margin:0;line-height:1.8;">
        All features<br>
        100 AI credits/day<br>
        Unlimited local AI<br>
        <strong style="color:#22c55e;">Free forever</strong>
      </p>
    </div>
    <div style="background:#1e293b;border:1px solid rgba(249,115,22,.3);
      border-radius:8px;padding:16px;">
      <p style="color:#f97316;font-size:12px;font-weight:700;
        margin:0 0 6px;text-transform:uppercase;letter-spacing:.05em;">
        Pro Plan
      </p>
      <p style="color:#64748b;font-size:12px;margin:0;line-height:1.8;">
        Unlimited credits<br>
        Priority support<br>
        Future Pro features<br>
        <a href="https://aiden.taracod.com/#pro"
          style="color:#f97316;font-weight:700;">
          ₹499/month →
        </a>
      </p>
    </div>
  </div>

  <a href="https://github.com/taracodlabs/aiden-releases/releases/download/v3.1.0/Aiden-Setup-3.1.0.exe"
    style="background:#f97316;color:#000;padding:16px 48px;
    border-radius:8px;text-decoration:none;font-weight:700;
    font-size:18px;display:inline-block;">
    Download Aiden v3.1.0 (119 MB)
  </a>

  <p style="color:#475569;font-size:12px;margin-top:16px;">
    Windows 10/11 · Node.js 18+ required
  </p>
  <p style="color:#334155;font-size:11px;margin-top:24px;">
    Registered to: ${record.email}
  </p>
  <p style="color:#334155;font-size:11px;">
    Need help?
    <a href="mailto:hello@taracod.com" style="color:#f97316;">
      hello@taracod.com
    </a>
  </p>
</body>
</html>`, { headers: { 'Content-Type': 'text/html' } })
}

async function handleValidate(request, env) {
  let body
  try { body = await request.json() } catch {
    return json({ valid: false, error: 'Invalid JSON' }, 400)
  }
  const key = (body.key || '').trim().toUpperCase()
  if (!key ||
      !/^[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/.test(key)) {
    return json({ valid: false, error: 'Invalid key format' }, 400)
  }
  const raw = await env.LICENSES.get(key)
  if (!raw) return json({ valid: false, error: 'License not found' }, 404)
  const license = JSON.parse(raw)
  if (!license.active) {
    return json({ valid: false, error: 'License deactivated' }, 403)
  }
  if (license.expiry !== 0 && Date.now() > license.expiry) {
    return json({ valid: false, error: 'License expired' }, 403)
  }
  return json({
    valid: true,
    tier: license.tier,
    email: license.email,
    expiry: license.expiry
  })
}

async function verifyHMAC(secret, payload, signature) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const mac = await crypto.subtle.sign(
    'HMAC', key, new TextEncoder().encode(payload)
  )
  const hex = Array.from(new Uint8Array(mac))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  return hex === signature.replace('sha256=', '')
}

async function handleAdminCreate(request, env) {
  if (request.headers.get('Authorization') !==
      `Bearer ${env.ADMIN_SECRET}`) {
    return json({ error: 'Unauthorized' }, 401)
  }
  const body = await request.json()
  const email = (body.email || '').trim()
  const days = body.durationDays ?? 365
  if (!email || !email.includes('@')) {
    return json({ error: 'Valid email required' }, 400)
  }

  const expiry = days === 0
    ? 0
    : Date.now() + days * 24 * 3600 * 1000
  const licenseKey = generateLicenseKey()

  await env.LICENSES.put(licenseKey, JSON.stringify({
    email, tier: 'pro',
    createdAt: Date.now(), expiry,
    orderId: `manual_${Date.now()}`,
    payment_provider: 'manual',
    active: true
  }))

  if (env.RESEND_API_KEY) {
    await sendLicenseEmail(
      env, email, licenseKey,
      expiry === 0 ? 'Never' : new Date(expiry).toDateString()
    )
  }

  return json({ success: true, licenseKey, email })
}

// ─── Router ─────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const { method } = request
    const { pathname } = new URL(request.url)

    if (method === 'OPTIONS') return cors()

    // Health
    if (method === 'GET' && pathname === '/health') {
      return json({ status: 'ok', ts: Date.now(), version: '3.1.0' })
    }

    // Registration & download
    if (method === 'POST' && pathname === '/register') {
      return handleRegister(request, env)
    }
    if (method === 'POST' && pathname === '/verify-install') {
      return handleVerifyInstall(request, env)
    }
    if (method === 'GET' && pathname.startsWith('/download/')) {
      return handleDownload(request, env)
    }

    // License validation
    if (method === 'POST' && pathname === '/validate') {
      return handleValidate(request, env)
    }

    // Credits
    if (method === 'GET' && pathname === '/credits') {
      const email = new URL(request.url).searchParams.get('email')
      if (!email) return json({ error: 'email required' }, 400)
      return json(await getCredits(env, email.toLowerCase().trim()))
    }
    if (method === 'POST' && pathname === '/credits/consume') {
      let body
      try { body = await request.json() } catch {
        return json({ error: 'Invalid JSON' }, 400)
      }
      const email = (body.email || '').trim().toLowerCase()
      if (!email) return json({ error: 'email required' }, 400)
      return json(await consumeCredit(env, email, body.amount || 1))
    }

    // Razorpay — create order (called from Aiden's payment page)
    if (method === 'POST' && pathname === '/payment/create-order') {
      return handleCreateOrder(request, env)
    }

    // Razorpay — verify payment after checkout
    if (method === 'POST' && pathname === '/payment/verify') {
      return handleVerifyPayment(request, env)
    }

    // Razorpay — webhook for subscriptions/auto-renewal
    if (method === 'POST' && pathname === '/webhook/razorpay') {
      return handleRazorpayWebhook(request, env)
    }

    // Admin
    if (method === 'POST' && pathname === '/admin/create') {
      return handleAdminCreate(request, env)
    }

    return json({ error: 'Not found' }, 404)
  }
}
