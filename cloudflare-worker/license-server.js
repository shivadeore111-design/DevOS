// Aiden License Server — api.taracod.com
// Free: 100 credits/day | Pro: unlimited | Razorpay payments

const FREE_DAILY_CREDITS = 100
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

// ─── Razorpay config ───────────────────────────────────────
// Plans (set your pricing here):
const PRO_PLAN_INR         = 749    // ₹749/month (regular)
const PRO_PLAN_USD         = 9      // $9/month (regular)
const PRO_PLAN_INR_ANNUAL  = 5999   // ₹5,999/year
const PRO_PLAN_USD_ANNUAL  = 72     // $72/year
const LAUNCH_PLAN_INR      = 499    // ₹499/month (first 100 users)
const LAUNCH_PLAN_USD      = 6      // $6/month (first 100 users)
// ──────────────────────────────────────────────────────────

// ─── Key / Token Generators ──────────────────────────────────

// New format: AIDEN-PRO-xxxxxx-xxxxxx-xxxxxx
function generateProLicenseKey() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const seg = () => Array.from({ length: 6 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('')
  return `AIDEN-PRO-${seg()}-${seg()}-${seg()}`
}

// Legacy format kept for /admin/create backward compat
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

// ─── Response helpers ────────────────────────────────────────

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

// ─── Pro features manifest ───────────────────────────────────

function getProFeatures() {
  return {
    unlimitedCredits:   true,
    unlimitedGoals:     true,
    unlimitedMemories:  true,
    unlimitedRoutines:  true,
    nightMode:          true,
    persistentRules:    true,
    watchdog:           true,
    personaEngine:      true,
    exportBackup:       true,
    maxMachines:        2
  }
}

// ─── Plan detection from payment amount ─────────────────────

function planFromAmount(amount, currency) {
  // amount is in smallest unit (paise / cents)
  if (currency === 'INR') {
    if (amount >= 599900) return { plan: 'pro_annual',  days: 365 }
    if (amount >= 74900)  return { plan: 'pro_monthly', days: 30  }
    return                       { plan: 'pro_launch',  days: 30  }
  }
  // USD / EUR / GBP
  if (amount >= 7200) return { plan: 'pro_annual',  days: 365 }
  if (amount >= 900)  return { plan: 'pro_monthly', days: 30  }
  return                     { plan: 'pro_launch',  days: 30  }
}

// ─── KV helpers ──────────────────────────────────────────────

// Write new-format license + reverse email lookup
async function storeLicense(env, licenseKey, email, plan, days, extra = {}) {
  const now      = new Date().toISOString()
  const expiresAt = new Date(Date.now() + days * 24 * 3600 * 1000).toISOString()

  const record = {
    key:         licenseKey,
    email,
    plan,
    status:      'active',
    createdAt:   now,
    expiresAt,
    maxMachines: 2,
    machines:    [],
    ...extra
  }

  await env.LICENSES.put(`license:${licenseKey}`, JSON.stringify(record))
  await env.LICENSES.put(`email:${email}`, JSON.stringify({
    licenseKey,
    plan,
    expiresAt
  }))

  return record
}

// Rate limit: max 5 activation attempts per key per hour
async function checkRateLimit(env, key) {
  const rlKey  = `ratelimit:${key}`
  const raw    = await env.LICENSES.get(rlKey)
  const count  = raw ? parseInt(raw) : 0
  if (count >= 5) return false
  await env.LICENSES.put(rlKey, String(count + 1), { expirationTtl: 3600 })
  return true
}

// ─── Email ───────────────────────────────────────────────────

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
      Upgrade to Pro — from $6/month
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

async function sendLicenseEmail(env, email, licenseKey, expiresAt) {
  const expiryLabel = expiresAt === 'Never'
    ? 'Never'
    : new Date(expiresAt).toDateString()

  await sendEmail(env, email,
    'Your Aiden Pro License Key', `
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
    <p style="color:#64748b;font-size:11px;margin:0 0 8px;text-transform:uppercase;
      letter-spacing:.06em;">Your License Key</p>
    <code style="font-size:18px;letter-spacing:3px;
      color:#f1f5f9;font-weight:700;word-break:break-all;">${licenseKey}</code>
  </div>
  <p style="color:#94a3b8;font-size:14px;">
    <strong style="color:#e2e8f0;">Expires:</strong> ${expiryLabel}
  </p>
  <div style="background:#1e293b;border-radius:8px;padding:16px;margin-top:20px;">
    <p style="color:#e2e8f0;font-size:13px;font-weight:600;margin:0 0 10px;">
      How to activate:
    </p>
    <ol style="color:#94a3b8;font-size:13px;margin:0;padding-left:20px;line-height:2.2;">
      <li>Open Aiden</li>
      <li>Go to Settings → Pro License</li>
      <li>Paste your license key</li>
      <li>Click Activate</li>
    </ol>
  </div>
  <hr style="border:none;border-top:1px solid #334155;margin:24px 0;">
  <p style="color:#64748b;font-size:12px;">
    <a href="mailto:hello@taracod.com" style="color:#f97316;">
      hello@taracod.com
    </a>
  </p>
</body>
</html>`)
}

// ─── Credit tracking ─────────────────────────────────────────

function todayKey() {
  return new Date().toISOString().split('T')[0]
}

async function getCredits(env, email) {
  // ① Check new-format pro license (license:{key} + email:{email} in LICENSES)
  const newEmailRaw = await env.LICENSES.get(`email:${email}`)
  if (newEmailRaw) {
    const { licenseKey } = JSON.parse(newEmailRaw)
    const licRaw = await env.LICENSES.get(`license:${licenseKey}`)
    if (licRaw) {
      const lic = JSON.parse(licRaw)
      if (lic.status === 'active' && new Date(lic.expiresAt) > new Date()) {
        return { tier: 'pro', remaining: 999999, limit: 999999, resetAt: null, email }
      }
    }
  }

  // ② Check old-format pro license (backward compat — key stored in REGISTRATIONS)
  const emailRaw = await env.REGISTRATIONS.get(`email:${email}`)
  if (emailRaw) {
    const record = JSON.parse(emailRaw)
    if (record.licenseKey) {
      const licRaw = await env.LICENSES.get(record.licenseKey)
      if (licRaw) {
        const lic = JSON.parse(licRaw)
        if (lic.active && (lic.expiry === 0 || Date.now() < lic.expiry)) {
          return { tier: 'pro', remaining: 999999, limit: 999999, resetAt: null, email }
        }
      }
    }
  }

  // ③ Free tier — daily credit counter
  const key    = `credits:${email}:${todayKey()}`
  const usedRaw = await env.REGISTRATIONS.get(key)
  const used    = usedRaw ? parseInt(usedRaw) : 0
  const remaining = Math.max(0, FREE_DAILY_CREDITS - used)
  const tomorrow  = new Date()
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
  const key    = `credits:${email}:${todayKey()}`
  const newUsed = (credits.used || 0) + amount
  await env.REGISTRATIONS.put(key, String(newUsed), { expirationTtl: 25 * 3600 })
  return {
    allowed: true,
    remaining: FREE_DAILY_CREDITS - newUsed,
    tier: 'free'
  }
}

// ─── License endpoints ───────────────────────────────────────

async function handleLicenseActivate(request, env) {
  let body
  try { body = await request.json() } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const key         = (body.key || '').trim()
  const machineId   = (body.machineId || '').trim()
  const machineName = (body.machineName || 'Unknown').trim()

  if (!key || !machineId) {
    return json({ error: 'key and machineId required' }, 400)
  }

  // Rate limit: 5 attempts/key/hour
  if (!await checkRateLimit(env, key)) {
    return json({ error: 'Too many activation attempts. Try again in 1 hour.' }, 429)
  }

  const raw = await env.LICENSES.get(`license:${key}`)
  if (!raw) return json({ error: 'Invalid license key' }, 404)

  const license = JSON.parse(raw)

  if (license.status !== 'active') {
    return json({ error: `License is ${license.status}` }, 403)
  }

  // Expiry check
  if (license.expiresAt && new Date(license.expiresAt) < new Date()) {
    license.status = 'expired'
    await env.LICENSES.put(`license:${key}`, JSON.stringify(license))
    return json({ error: 'License expired' }, 403)
  }

  // Re-activation on same machine — always OK
  if (license.machines.find(m => m.id === machineId)) {
    return json({
      activated: true,
      plan:      license.plan,
      expiresAt: license.expiresAt,
      features:  getProFeatures()
    })
  }

  // Machine limit
  if (license.machines.length >= license.maxMachines) {
    return json({
      error: `Machine limit reached (${license.maxMachines}). Deactivate a device at aiden.taracod.com/account`
    }, 403)
  }

  // Register machine
  license.machines.push({ id: machineId, name: machineName, activatedAt: new Date().toISOString() })
  await env.LICENSES.put(`license:${key}`, JSON.stringify(license))

  return json({
    activated: true,
    plan:      license.plan,
    expiresAt: license.expiresAt,
    features:  getProFeatures()
  })
}

async function handleLicenseVerify(request, env) {
  let body
  try { body = await request.json() } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const key       = (body.key || '').trim()
  const machineId = (body.machineId || '').trim()

  if (!key || !machineId) {
    return json({ valid: false, reason: 'key and machineId required' })
  }

  const raw = await env.LICENSES.get(`license:${key}`)
  if (!raw) return json({ valid: false, reason: 'invalid_key' })

  const license = JSON.parse(raw)

  if (license.status !== 'active') {
    return json({ valid: false, reason: license.status })
  }

  if (license.expiresAt && new Date(license.expiresAt) < new Date()) {
    license.status = 'expired'
    await env.LICENSES.put(`license:${key}`, JSON.stringify(license))
    return json({ valid: false, reason: 'expired' })
  }

  if (!license.machines.find(m => m.id === machineId)) {
    return json({ valid: false, reason: 'machine_not_registered' })
  }

  return json({
    valid:     true,
    plan:      license.plan,
    expiresAt: license.expiresAt,
    features:  getProFeatures()
  })
}

async function handleLicenseDeactivate(request, env) {
  let body
  try { body = await request.json() } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const key       = (body.key || '').trim()
  const machineId = (body.machineId || '').trim()

  if (!key || !machineId) {
    return json({ error: 'key and machineId required' }, 400)
  }

  const raw = await env.LICENSES.get(`license:${key}`)
  if (!raw) return json({ error: 'Invalid license key' }, 404)

  const license = JSON.parse(raw)
  license.machines = license.machines.filter(m => m.id !== machineId)
  await env.LICENSES.put(`license:${key}`, JSON.stringify(license))

  return json({
    deactivated:    true,
    remainingSlots: license.maxMachines - license.machines.length
  })
}

async function handleAccount(request, env) {
  const email = (new URL(request.url).searchParams.get('email') || '').toLowerCase().trim()
  if (!email) return json({ error: 'email required' }, 400)

  const emailRaw = await env.LICENSES.get(`email:${email}`)
  if (!emailRaw) return json({ error: 'No Pro license found for this email' }, 404)

  const { licenseKey } = JSON.parse(emailRaw)
  const licRaw = await env.LICENSES.get(`license:${licenseKey}`)
  if (!licRaw) return json({ error: 'License record not found' }, 404)

  const license = JSON.parse(licRaw)

  return json({
    plan:           license.plan,
    status:         license.status,
    expiresAt:      license.expiresAt,
    machines:       license.machines,
    remainingSlots: license.maxMachines - license.machines.length,
    features:       getProFeatures()
  })
}

async function handleAdminRevoke(request, env) {
  if (request.headers.get('Authorization') !== `Bearer ${env.ADMIN_SECRET}`) {
    return json({ error: 'Unauthorized' }, 401)
  }
  let body
  try { body = await request.json() } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const key = (body.key || '').trim()
  if (!key) return json({ error: 'key required' }, 400)

  const raw = await env.LICENSES.get(`license:${key}`)
  if (!raw) return json({ error: 'License not found' }, 404)

  const license = JSON.parse(raw)
  license.status = 'revoked'
  await env.LICENSES.put(`license:${key}`, JSON.stringify(license))

  return json({ revoked: true, key })
}

// ─── Razorpay payments ───────────────────────────────────────

async function handleCreateOrder(request, env) {
  let body
  try { body = await request.json() } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const email    = (body.email || '').trim().toLowerCase()
  const currency = body.currency || 'INR'
  if (!email || !email.includes('@')) {
    return json({ error: 'Valid email required' }, 400)
  }

  const plan = body.plan || 'monthly'
  let inrAmount, usdAmount
  if (plan === 'annual') {
    inrAmount = PRO_PLAN_INR_ANNUAL * 100
    usdAmount = PRO_PLAN_USD_ANNUAL * 100
  } else if (plan === 'launch') {
    inrAmount = LAUNCH_PLAN_INR * 100
    usdAmount = LAUNCH_PLAN_USD * 100
  } else {
    inrAmount = PRO_PLAN_INR * 100
    usdAmount = PRO_PLAN_USD * 100
  }
  const amount = currency === 'INR' ? inrAmount : usdAmount

  const authStr  = btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`)
  const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { 'Authorization': `Basic ${authStr}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount,
      currency,
      receipt: `aiden_pro_${Date.now()}`,
      notes: { email, product: 'aiden_pro', plan }
    })
  })

  if (!orderRes.ok) {
    const err = await orderRes.text()
    return json({ error: 'Failed to create order', details: err }, 500)
  }

  const order = await orderRes.json()

  return json({
    orderId:  order.id,
    amount:   order.amount,
    currency: order.currency,
    keyId:    env.RAZORPAY_KEY_ID,
    email,
    prefill: { email, method: currency === 'INR' ? 'upi' : 'card' }
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
    email,
    plan: planHint  // passed from frontend
  } = body

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !email) {
    return json({ error: 'Missing payment details' }, 400)
  }

  // Verify Razorpay HMAC signature
  const signaturePayload = `${razorpay_order_id}|${razorpay_payment_id}`
  if (!await verifyHMAC(env.RAZORPAY_KEY_SECRET, signaturePayload, razorpay_signature)) {
    return json({ error: 'Invalid payment signature' }, 400)
  }

  // Fetch order from Razorpay to get actual amount + currency
  const authStr   = btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`)
  const orderData = await fetch(`https://api.razorpay.com/v1/orders/${razorpay_order_id}`, {
    headers: { 'Authorization': `Basic ${authStr}` }
  }).then(r => r.json()).catch(() => null)

  const paidAmount   = orderData?.amount   || 0
  const paidCurrency = orderData?.currency || 'INR'
  const { plan, days } = planFromAmount(paidAmount, paidCurrency)

  // Use planHint from frontend if available and more specific
  const finalPlan = planHint
    ? (planHint === 'annual' ? 'pro_annual' : planHint === 'launch' ? 'pro_launch' : 'pro_monthly')
    : plan

  const emailNorm  = email.toLowerCase()
  const licenseKey = generateProLicenseKey()
  const license    = await storeLicense(env, licenseKey, emailNorm, finalPlan, days, {
    orderId:          razorpay_order_id,
    paymentId:        razorpay_payment_id,
    payment_provider: 'razorpay',
    currency:         paidCurrency,
    amountPaid:       paidAmount
  })

  // Also write into REGISTRATIONS for backward compat (getCredits old path)
  const regRaw    = await env.REGISTRATIONS.get(`email:${emailNorm}`)
  const regRecord = regRaw ? JSON.parse(regRaw) : { email: emailNorm, registeredAt: Date.now(), machineIds: [] }
  regRecord.licenseKey = licenseKey
  regRecord.tier       = 'pro'
  await env.REGISTRATIONS.put(`email:${emailNorm}`, JSON.stringify(regRecord))

  await sendLicenseEmail(env, emailNorm, licenseKey, license.expiresAt)

  return json({
    success:    true,
    licenseKey,
    plan:       finalPlan,
    expiresAt:  license.expiresAt
  })
}

// ─── Razorpay webhook (auto-renewal / subscription.charged) ──

async function handleRazorpayWebhook(request, env) {
  const rawBody = await request.text()
  const sig     = request.headers.get('x-razorpay-signature') || ''

  if (!await verifyHMAC(env.RAZORPAY_WEBHOOK_SECRET, rawBody, sig)) {
    return json({ error: 'Invalid signature' }, 401)
  }

  const event = JSON.parse(rawBody)
  if (event.event !== 'payment.captured' && event.event !== 'subscription.charged') {
    return json({ received: true })
  }

  const payment = event.payload?.payment?.entity || {}
  const email   = (payment.email || '').toLowerCase()
  if (!email) return json({ error: 'No email in payload' }, 400)

  const amount   = payment.amount   || 0
  const currency = payment.currency || 'INR'
  const { plan, days } = planFromAmount(amount, currency)

  const licenseKey = generateProLicenseKey()
  const license    = await storeLicense(env, licenseKey, email, plan, days, {
    orderId:          payment.order_id,
    paymentId:        payment.id,
    payment_provider: 'razorpay',
    currency,
    amountPaid:       amount
  })

  // Backward compat link
  const regRaw = await env.REGISTRATIONS.get(`email:${email}`)
  if (regRaw) {
    const rec    = JSON.parse(regRaw)
    rec.licenseKey = licenseKey
    rec.tier       = 'pro'
    await env.REGISTRATIONS.put(`email:${email}`, JSON.stringify(rec))
  }

  await sendLicenseEmail(env, email, licenseKey, license.expiresAt)

  return json({ received: true, licenseKey })
}

// ─── Registration & download ─────────────────────────────────

async function handleRegister(request, env) {
  let body
  try { body = await request.json() } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }
  const email = (body.email || '').trim().toLowerCase()
  if (!email || !email.includes('@')) {
    return json({ error: 'Valid email required' }, 400)
  }

  const token       = generateToken()
  const tokenRecord = { email, token, createdAt: Date.now(), expiresAt: Date.now() + 48 * 3600 * 1000 }
  const existing    = await env.REGISTRATIONS.get(`email:${email}`)
  const emailRecord = existing
    ? JSON.parse(existing)
    : { email, registeredAt: Date.now(), machineIds: [] }

  emailRecord.lastToken  = token
  emailRecord.updatedAt  = Date.now()

  await env.REGISTRATIONS.put(`token:${token}`, JSON.stringify(tokenRecord), { expirationTtl: 48 * 3600 })
  await env.REGISTRATIONS.put(`email:${email}`, JSON.stringify(emailRecord))
  await sendDownloadEmail(env, email, token)

  return json({ success: true, message: 'Check your email for the download link' })
}

async function handleVerifyInstall(request, env) {
  let body
  try { body = await request.json() } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }
  const email     = (body.email || '').trim().toLowerCase()
  const machineId = (body.machineId || '').trim()
  if (!email || !machineId) {
    return json({ allowed: false, reason: 'Email and machine ID required' })
  }

  const raw = await env.REGISTRATIONS.get(`email:${email}`)
  if (!raw) {
    return json({ allowed: false, reason: 'Email not registered. Get access at aiden.taracod.com' })
  }

  const record = JSON.parse(raw)
  if (!record.machineIds) record.machineIds = []
  if (record.machineIds.includes(machineId)) return json({ allowed: true })
  if (record.machineIds.length < 2) {
    record.machineIds.push(machineId)
    await env.REGISTRATIONS.put(`email:${email}`, JSON.stringify(record))
    return json({ allowed: true })
  }

  return json({ allowed: false, reason: 'Active on 2 machines already. Email hello@taracod.com to transfer.' })
}

async function handleDownload(request, env) {
  const token   = new URL(request.url).pathname.split('/download/')[1]
  if (!token) return json({ error: 'Invalid link' }, 400)

  const raw     = await env.REGISTRATIONS.get(`token:${token}`)
  const expired = !raw || Date.now() > JSON.parse(raw || '{}').expiresAt

  if (expired) return new Response(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='%23FF8C00'/><text x='50%25' y='55%25' dominant-baseline='middle' text-anchor='middle' font-family='monospace' font-weight='bold' font-size='16' fill='white'>A/</text></svg>"></head>
<body style="font-family:system-ui;text-align:center;padding:60px;
  background:#0f172a;color:#e2e8f0;">
  <h1 style="color:#f97316;">Link Expired</h1>
  <p style="color:#94a3b8;">This download link has expired.</p>
  <a href="https://aiden.taracod.com" style="color:#f97316;font-weight:600;">
    Get a new link →
  </a>
</body>
</html>`, { status: 410, headers: { 'Content-Type': 'text/html; charset=utf-8' } })

  const record = JSON.parse(raw)

  return new Response(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Download Aiden v3.1.0</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='%23FF8C00'/><text x='50%25' y='55%25' dominant-baseline='middle' text-anchor='middle' font-family='monospace' font-weight='bold' font-size='16' fill='white'>A/</text></svg>">
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
      <li>Download <strong style="color:#e2e8f0;">Aiden-Setup-3.1.0.exe</strong></li>
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
          From $6/month — ₹499/month →
        </a>
      </p>
    </div>
  </div>

  <a href="https://github.com/taracodlabs/aiden-releases/releases/download/v3.1.0/Aiden-Setup-3.1.0.exe"
    style="background:#f97316;color:#000;padding:16px 48px;
    border-radius:8px;text-decoration:none;font-weight:700;
    font-size:18px;display:inline-block;">
    Download Aiden v3.1.0 (144 MB)
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
</html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

// ─── Legacy /validate (old-format keys, kept for backward compat) ──

async function handleValidate(request, env) {
  let body
  try { body = await request.json() } catch {
    return json({ valid: false, error: 'Invalid JSON' }, 400)
  }
  const key = (body.key || '').trim().toUpperCase()
  if (!key || !/^[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/.test(key)) {
    return json({ valid: false, error: 'Invalid key format' }, 400)
  }
  const raw = await env.LICENSES.get(key)
  if (!raw) return json({ valid: false, error: 'License not found' }, 404)
  const license = JSON.parse(raw)
  if (!license.active) return json({ valid: false, error: 'License deactivated' }, 403)
  if (license.expiry !== 0 && Date.now() > license.expiry) {
    return json({ valid: false, error: 'License expired' }, 403)
  }
  return json({ valid: true, tier: license.tier, email: license.email, expiry: license.expiry })
}

// ─── Admin ───────────────────────────────────────────────────

async function handleAdminCreate(request, env) {
  if (request.headers.get('Authorization') !== `Bearer ${env.ADMIN_SECRET}`) {
    return json({ error: 'Unauthorized' }, 401)
  }
  const body  = await request.json()
  const email = (body.email || '').trim().toLowerCase()
  const days  = body.durationDays ?? 365
  const plan  = body.plan || 'pro_monthly'
  if (!email || !email.includes('@')) {
    return json({ error: 'Valid email required' }, 400)
  }

  const licenseKey = generateProLicenseKey()
  const license    = await storeLicense(env, licenseKey, email, plan,
    days === 0 ? 36500 : days,  // 0 = "forever" → 100 years
    { orderId: `manual_${Date.now()}`, payment_provider: 'manual' }
  )

  // Write into REGISTRATIONS for credit check backward compat
  const regRaw    = await env.REGISTRATIONS.get(`email:${email}`)
  const regRecord = regRaw ? JSON.parse(regRaw) : { email, registeredAt: Date.now(), machineIds: [] }
  regRecord.licenseKey = licenseKey
  regRecord.tier       = 'pro'
  await env.REGISTRATIONS.put(`email:${email}`, JSON.stringify(regRecord))

  if (env.RESEND_API_KEY) {
    const expiresLabel = days === 0 ? 'Never' : license.expiresAt
    await sendLicenseEmail(env, email, licenseKey, expiresLabel)
  }

  return json({ success: true, licenseKey, email, plan, expiresAt: license.expiresAt })
}

// ─── Crypto ──────────────────────────────────────────────────

async function verifyHMAC(secret, payload, signature) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  const hex = Array.from(new Uint8Array(mac))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  return hex === signature.replace('sha256=', '')
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

    // ── License system ──────────────────────────────────────
    if (method === 'POST' && pathname === '/license/activate') {
      return handleLicenseActivate(request, env)
    }
    if (method === 'POST' && pathname === '/license/verify') {
      return handleLicenseVerify(request, env)
    }
    if (method === 'POST' && pathname === '/license/deactivate') {
      return handleLicenseDeactivate(request, env)
    }
    if (method === 'GET' && pathname === '/account') {
      return handleAccount(request, env)
    }

    // ── Registration & download ─────────────────────────────
    if (method === 'POST' && pathname === '/register') {
      return handleRegister(request, env)
    }
    if (method === 'POST' && pathname === '/verify-install') {
      return handleVerifyInstall(request, env)
    }
    if (method === 'GET' && pathname.startsWith('/download/')) {
      return handleDownload(request, env)
    }

    // ── Legacy license validation ───────────────────────────
    if (method === 'POST' && pathname === '/validate') {
      return handleValidate(request, env)
    }

    // ── Credits ─────────────────────────────────────────────
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

    // ── Payments ─────────────────────────────────────────────
    if (method === 'POST' && pathname === '/payment/create-order') {
      return handleCreateOrder(request, env)
    }
    if (method === 'POST' && pathname === '/payment/verify') {
      return handleVerifyPayment(request, env)
    }
    if (method === 'POST' && pathname === '/webhook/razorpay') {
      return handleRazorpayWebhook(request, env)
    }

    // ── Admin ────────────────────────────────────────────────
    if (method === 'POST' && pathname === '/admin/create') {
      return handleAdminCreate(request, env)
    }
    if (method === 'POST' && pathname === '/admin/revoke') {
      return handleAdminRevoke(request, env)
    }

    // ── Update check ─────────────────────────────────────────
    if (method === 'GET' && pathname === '/update/check') {
      return handleUpdateCheck(request, env)
    }

    return json({ error: 'Not found' }, 404)
  }
}

// ─── Update check handler ────────────────────────────────────

async function handleUpdateCheck(request, env) {
  const url     = new URL(request.url)
  const current = (url.searchParams.get('version') || '0.0.0').replace(/^v/, '')

  // Check KV cache (1-hour TTL)
  const CACHE_KEY = 'update:latest'
  const ONE_HOUR  = 60 * 60 * 1000

  let latest = null
  try {
    const cached = await env.LICENSES.get(CACHE_KEY, 'json')
    if (cached && cached.fetchedAt && (Date.now() - cached.fetchedAt) < ONE_HOUR) {
      latest = cached
    }
  } catch { /* ignore cache errors */ }

  if (!latest) {
    try {
      const ghRes = await fetch(
        'https://api.github.com/repos/taracodlabs/aiden-releases/releases/latest',
        { headers: { 'User-Agent': 'Aiden-UpdateChecker/1.0' } }
      )
      if (!ghRes.ok) throw new Error(`GitHub API ${ghRes.status}`)
      const release = await ghRes.json()
      latest = {
        tag:          release.tag_name,
        body:         release.body || '',
        publishedAt:  release.published_at,
        downloadUrl:  (release.assets && release.assets[0]) ? release.assets[0].browser_download_url : '',
        fetchedAt:    Date.now(),
      }
      await env.LICENSES.put(CACHE_KEY, JSON.stringify(latest), { expirationTtl: 7200 })
    } catch (e) {
      return json({ error: 'Failed to fetch release info', detail: e.message }, 502)
    }
  }

  const latestVersion = latest.tag.replace(/^v/, '')

  // Semver compare: split by ".", compare major → minor → patch
  function semverGt(a, b) {
    const pa = a.split('.').map(Number)
    const pb = b.split('.').map(Number)
    for (let i = 0; i < 3; i++) {
      const na = pa[i] || 0, nb = pb[i] || 0
      if (na > nb) return true
      if (na < nb) return false
    }
    return false
  }

  const updateAvailable = semverGt(latestVersion, current)

  return json({
    updateAvailable,
    currentVersion: current,
    latestVersion,
    ...(updateAvailable ? {
      downloadUrl:  latest.downloadUrl,
      releaseNotes: latest.body,
      publishedAt:  latest.publishedAt,
    } : {}),
  })
}
