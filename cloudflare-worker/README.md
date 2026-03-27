# DevOS License Server — Cloudflare Worker

Handles Pro license key generation, validation, and payment webhooks.
Runs entirely on Cloudflare's edge — no server needed.

---

## One-time Setup

### 1. Install Wrangler

```bash
npm install -g wrangler
wrangler login
```

### 2. Create KV namespace

```bash
wrangler kv:namespace create LICENSES
# Copy the returned `id` into wrangler.toml → kv_namespaces[0].id
```

### 3. Set secrets

```bash
wrangler secret put RAZORPAY_WEBHOOK_SECRET   # from Razorpay Dashboard → Webhooks
wrangler secret put STRIPE_WEBHOOK_SECRET     # from Stripe Dashboard → Webhooks → Signing secret
wrangler secret put RESEND_API_KEY            # from resend.com → API Keys
wrangler secret put ADMIN_SECRET              # choose any strong random string
```

### 4. Deploy

```bash
cd cloudflare-worker
wrangler deploy
# Your worker URL: https://devos-license-server.<your-subdomain>.workers.dev
```

Copy that URL into `core/licenseManager.ts` → `LICENSE_SERVER` constant.

---

## Webhook Setup

### Razorpay

1. Go to Dashboard → Settings → Webhooks → Add New Webhook
2. URL: `https://devos-license-server.<subdomain>.workers.dev/webhook/razorpay`
3. Events: `payment.captured`, `subscription.charged`
4. Copy the webhook secret → `wrangler secret put RAZORPAY_WEBHOOK_SECRET`

### Stripe

1. Go to Dashboard → Developers → Webhooks → Add endpoint
2. URL: `https://devos-license-server.<subdomain>.workers.dev/webhook/stripe`
3. Events: `checkout.session.completed`, `invoice.payment_succeeded`, `customer.subscription.deleted`
4. Copy the Signing secret → `wrangler secret put STRIPE_WEBHOOK_SECRET`

---

## API Reference

### `POST /validate`
Check if a license key is valid.

```json
// Request
{ "key": "XXXXX-XXXXX-XXXXX-XXXXX" }

// Response (valid)
{ "valid": true, "tier": "pro", "email": "user@example.com", "expiry": 1234567890000 }

// Response (invalid)
{ "valid": false, "error": "License key not found" }
```

### `POST /admin/create`
Manually create a license (for refunds, giveaways, etc.).

```bash
curl -X POST https://devos-license-server.<subdomain>.workers.dev/admin/create \
  -H "Authorization: Bearer YOUR_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{ "email": "user@example.com", "durationDays": 365 }'
```

### `GET /health`
```json
{ "status": "ok", "ts": 1234567890000 }
```

---

## Local Development

```bash
wrangler dev
# Worker runs at http://localhost:8787
```
