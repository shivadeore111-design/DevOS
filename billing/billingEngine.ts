// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// billing/billingEngine.ts — Stripe integration
//
// Reads price IDs from config/billing.json.
// Set STRIPE_SECRET_KEY in .env to activate.
// Without the key, all methods degrade gracefully (dev/self-hosted mode).
//
// Webhook events handled:
//   invoice.paid           → upgrade user tier
//   customer.subscription.deleted → downgrade to free
//   checkout.session.completed    → link stripe customer to user

import * as fs   from 'fs'
import * as path from 'path'
import { devosAuth, UserTier } from '../auth/devosAuth'

// ── Config ────────────────────────────────────────────────────

interface BillingPlan {
  id:      string
  name:    string
  price:   number
  priceId: string
  description: string
  limits:  Record<string, any>
  features: string[]
}

interface BillingConfig {
  stripe: {
    publishableKey: string
    webhookSecret:  string
    currency:       string
  }
  plans: BillingPlan[]
}

function loadBillingConfig(): BillingConfig {
  const configPath = path.join(process.cwd(), 'config', 'billing.json')
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8')) as BillingConfig
  } catch {
    return { stripe: { publishableKey: '', webhookSecret: '', currency: 'usd' }, plans: [] }
  }
}

// ── Stripe lazy loader ─────────────────────────────────────────

function getStripe(): any | null {
  const key = process.env.STRIPE_SECRET_KEY ?? ''
  if (!key) {
    console.warn('[BillingEngine] STRIPE_SECRET_KEY not set — Stripe disabled')
    return null
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Stripe = require('stripe')
    return typeof Stripe === 'function' ? new Stripe(key) : new Stripe.default(key)
  } catch {
    console.error('[BillingEngine] Failed to load stripe package')
    return null
  }
}

// ── Tier resolution (priceId → UserTier) ──────────────────────

function tierFromPriceId(priceId: string): UserTier {
  const cfg = loadBillingConfig()
  const plan = cfg.plans.find(p => p.priceId === priceId)
  if (!plan) return 'free'
  const valid: UserTier[] = ['free', 'starter', 'builder', 'pro']
  return valid.includes(plan.id as UserTier) ? (plan.id as UserTier) : 'free'
}

// ── BillingEngine class ───────────────────────────────────────

class BillingEngine {

  // ── Plans ────────────────────────────────────────────────────

  getPlans(): BillingPlan[] {
    return loadBillingConfig().plans
  }

  getPlan(tierId: string): BillingPlan | null {
    return this.getPlans().find(p => p.id === tierId) ?? null
  }

  // ── createCheckoutSession ────────────────────────────────────

  /**
   * Create a Stripe Checkout Session.
   * @param userId        DevOS user ID (stored in client_reference_id)
   * @param priceId       Stripe price ID from config/billing.json
   * @param successUrl    URL to redirect after payment
   * @param cancelUrl     URL to redirect on cancel
   * @returns             { url } on success, throws on failure
   */
  async createCheckoutSession(
    userId:     string,
    priceId:    string,
    successUrl  = 'http://localhost:3000/billing/success',
    cancelUrl   = 'http://localhost:3000/billing/cancel',
  ): Promise<{ url: string }> {
    const stripe = getStripe()
    if (!stripe) {
      // Dev mode: return a mock URL so the UI still works
      return { url: `http://localhost:3000/billing/dev-mock?priceId=${priceId}&userId=${userId}` }
    }

    // Look up existing Stripe customer for this user (avoids duplicates)
    const user    = devosAuth.getUserById(userId)
    const params: Record<string, any> = {
      mode:                'subscription',
      line_items:          [{ price: priceId, quantity: 1 }],
      client_reference_id: userId,
      success_url:         `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:          cancelUrl,
      metadata:            { userId },
    }

    if (user?.stripeCustomerId) {
      params.customer = user.stripeCustomerId
    }

    const session = await stripe.checkout.sessions.create(params)
    console.log(`[BillingEngine] ✅ Checkout session created: ${session.id}`)
    return { url: session.url as string }
  }

  // ── handleWebhook ────────────────────────────────────────────

  /**
   * Verify and process a Stripe webhook event.
   * Call this with the raw request body (Buffer) and the Stripe-Signature header.
   *
   * Handles:
   *   invoice.paid                      → upgrade tier
   *   customer.subscription.deleted     → downgrade to free
   *   checkout.session.completed        → link customer to user
   */
  async handleWebhook(payload: Buffer | string, sig: string): Promise<{ received: boolean; type?: string }> {
    const stripe = getStripe()
    if (!stripe) {
      console.warn('[BillingEngine] Stripe not configured — webhook ignored')
      return { received: false }
    }

    const cfg           = loadBillingConfig()
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? cfg.stripe.webhookSecret

    let event: any
    try {
      event = stripe.webhooks.constructEvent(payload, sig, webhookSecret)
    } catch (err: any) {
      console.error(`[BillingEngine] Webhook signature verification failed: ${err?.message}`)
      throw new Error(`Webhook signature invalid: ${err?.message}`)
    }

    console.log(`[BillingEngine] Webhook received: ${event.type}`)

    switch (event.type) {

      case 'checkout.session.completed': {
        const session  = event.data.object
        const userId   = (session.client_reference_id as string) ?? (session.metadata?.userId as string)
        const custId   = session.customer as string

        if (userId && custId) {
          try {
            // Link the Stripe customer ID to this DevOS user
            const current = devosAuth.getUserById(userId)
            if (current && !current.stripeCustomerId) {
              devosAuth.updateTier(userId, current.tier, custId)
            }
            console.log(`[BillingEngine] Linked customer ${custId} → user ${userId}`)
          } catch (e: any) {
            console.error(`[BillingEngine] Failed to link customer: ${e?.message}`)
          }
        }
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object
        const custId  = invoice.customer as string

        // Resolve priceId from the invoice line items
        const lineItem = invoice.lines?.data?.[0]
        const priceId  = (lineItem?.price?.id as string) ?? (lineItem?.plan?.id as string)

        if (!priceId) {
          console.warn('[BillingEngine] invoice.paid: no priceId found')
          break
        }

        const tier = tierFromPriceId(priceId)
        const user = devosAuth.findByStripeCustomerId(custId)

        if (user) {
          devosAuth.updateTier(user.id, tier, custId)
          console.log(`[BillingEngine] 💎 Upgraded ${user.email} → ${tier} (invoice.paid)`)
        } else {
          console.warn(`[BillingEngine] invoice.paid: no user found for customer ${custId}`)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const sub    = event.data.object
        const custId = sub.customer as string
        const user   = devosAuth.findByStripeCustomerId(custId)

        if (user) {
          devosAuth.updateTier(user.id, 'free')
          console.log(`[BillingEngine] 📉 Downgraded ${user.email} → free (subscription cancelled)`)
        }
        break
      }

      default:
        // Unhandled event — log and ignore
        console.log(`[BillingEngine] Unhandled event: ${event.type}`)
    }

    return { received: true, type: event.type }
  }

  // ── Customer portal ──────────────────────────────────────────

  /**
   * Create a Stripe Customer Portal session for billing management.
   */
  async createPortalSession(
    userId:     string,
    returnUrl = 'http://localhost:3000/billing',
  ): Promise<{ url: string }> {
    const stripe = getStripe()
    if (!stripe) return { url: returnUrl }

    const user = devosAuth.getUserById(userId)
    if (!user?.stripeCustomerId) throw new Error('No Stripe customer linked to this account')

    const session = await stripe.billingPortal.sessions.create({
      customer:   user.stripeCustomerId,
      return_url: returnUrl,
    })
    return { url: session.url as string }
  }
}

export const billingEngine = new BillingEngine()
