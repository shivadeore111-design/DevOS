// ============================================================
// DevOS — Autonomous AI Execution System
// Copyright (c) 2026 Shiva Deore. All rights reserved.
// ============================================================

// auth/devosAuth.ts — JWT + bcrypt authentication layer
//
// Storage (both files live under workspace/ so they survive restarts):
//   workspace/users.json          — hashed credentials + profile
//   workspace/sessions-auth.json  — active JWT session index (for logout)
//
// JWT: 7-day expiry, signed with DEVOS_JWT_SECRET (falls back to a
// machine-stable secret derived from the install path so dev works
// without any env config).

import * as fs   from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import * as bcrypt from 'bcrypt'
import * as jwt    from 'jsonwebtoken'

// ── Constants ─────────────────────────────────────────────────

const BCRYPT_ROUNDS   = 12
const JWT_EXPIRY_SECS = 60 * 60 * 24 * 7   // 7 days
const WORKSPACE       = path.join(process.cwd(), 'workspace')
const USERS_FILE      = path.join(WORKSPACE, 'users.json')
const SESSIONS_FILE   = path.join(WORKSPACE, 'sessions-auth.json')

// ── Types ─────────────────────────────────────────────────────

export type UserTier = 'free' | 'starter' | 'builder' | 'pro'

export interface User {
  id:             string
  email:          string
  passwordHash:   string
  tier:           UserTier
  stripeCustomerId?: string
  createdAt:      string
  updatedAt:      string
}

export interface SafeUser {
  id:             string
  email:          string
  tier:           UserTier
  stripeCustomerId?: string
  createdAt:      string
}

export interface AuthResult {
  user:  SafeUser
  token: string
}

export interface JwtPayload {
  sub:   string   // user id
  email: string
  tier:  UserTier
  iat?:  number
  exp?:  number
}

// ── Secret ────────────────────────────────────────────────────

function getJwtSecret(): string {
  if (process.env.DEVOS_JWT_SECRET) return process.env.DEVOS_JWT_SECRET
  // Stable fallback: sha256 of install path — never changes on a given machine
  return crypto
    .createHash('sha256')
    .update('devos-auth:' + process.cwd())
    .digest('hex')
}

// ── Disk helpers ──────────────────────────────────────────────

function loadUsers(): User[] {
  try {
    if (!fs.existsSync(USERS_FILE)) return []
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8')) as User[]
  } catch { return [] }
}

function saveUsers(users: User[]): void {
  fs.mkdirSync(WORKSPACE, { recursive: true })
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2))
}

function loadSessions(): Record<string, number> {
  // Map of jti → expiry (unix seconds). Used for logout revocation.
  try {
    if (!fs.existsSync(SESSIONS_FILE)) return {}
    return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8')) as Record<string, number>
  } catch { return {} }
}

function saveSessions(sessions: Record<string, number>): void {
  fs.mkdirSync(WORKSPACE, { recursive: true })
  // Prune expired entries before saving
  const now = Math.floor(Date.now() / 1000)
  const pruned: Record<string, number> = {}
  for (const [jti, exp] of Object.entries(sessions)) {
    if (exp > now) pruned[jti] = exp
  }
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(pruned, null, 2))
}

// ── Token helpers ─────────────────────────────────────────────

function issueToken(user: User): string {
  const jti    = crypto.randomUUID()
  const secret = getJwtSecret()
  const token  = (jwt.sign as Function)(
    { sub: user.id, email: user.email, tier: user.tier, jti } satisfies Omit<JwtPayload, 'iat'|'exp'> & { jti: string },
    secret,
    { expiresIn: JWT_EXPIRY_SECS }
  ) as string

  // Record session so we can revoke on logout
  const sessions = loadSessions()
  sessions[jti]  = Math.floor(Date.now() / 1000) + JWT_EXPIRY_SECS
  saveSessions(sessions)

  return token
}

function toSafeUser(u: User): SafeUser {
  return {
    id:               u.id,
    email:            u.email,
    tier:             u.tier,
    stripeCustomerId: u.stripeCustomerId,
    createdAt:        u.createdAt,
  }
}

// ── DevosAuth class ───────────────────────────────────────────

class DevosAuth {

  // ── register ────────────────────────────────────────────────

  async register(email: string, password: string): Promise<AuthResult> {
    const normalised = email.trim().toLowerCase()
    if (!normalised || !password) throw new Error('Email and password are required')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalised)) throw new Error('Invalid email format')
    if (password.length < 8) throw new Error('Password must be at least 8 characters')

    const users = loadUsers()
    if (users.find(u => u.email === normalised)) throw new Error('Email already registered')

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)
    const now          = new Date().toISOString()
    const user: User   = {
      id:           crypto.randomUUID(),
      email:        normalised,
      passwordHash,
      tier:         'free',
      createdAt:    now,
      updatedAt:    now,
    }

    users.push(user)
    saveUsers(users)

    const token = issueToken(user)
    console.log(`[DevosAuth] ✅ Registered: ${normalised}`)
    return { user: toSafeUser(user), token }
  }

  // ── login ────────────────────────────────────────────────────

  async login(email: string, password: string): Promise<AuthResult> {
    const normalised = email.trim().toLowerCase()
    if (!normalised || !password) throw new Error('Email and password are required')

    const users = loadUsers()
    const user  = users.find(u => u.email === normalised)
    if (!user) throw new Error('Invalid email or password')

    const match = await bcrypt.compare(password, user.passwordHash)
    if (!match) throw new Error('Invalid email or password')

    const token = issueToken(user)
    console.log(`[DevosAuth] ✅ Login: ${normalised}`)
    return { user: toSafeUser(user), token }
  }

  // ── logout ───────────────────────────────────────────────────

  logout(token: string): void {
    try {
      const secret  = getJwtSecret()
      const decoded = jwt.verify(token, secret) as JwtPayload & { jti?: string }
      const jti     = decoded.jti
      if (!jti) return

      const sessions = loadSessions()
      delete sessions[jti]
      saveSessions(sessions)
      console.log(`[DevosAuth] 👋 Logged out: ${decoded.email}`)
    } catch {
      // Expired / invalid token — nothing to revoke
    }
  }

  // ── validateToken ────────────────────────────────────────────

  validateToken(token: string): SafeUser | null {
    try {
      const secret  = getJwtSecret()
      const decoded = jwt.verify(token, secret) as JwtPayload & { jti?: string }

      // Check revocation list
      if (decoded.jti) {
        const sessions = loadSessions()
        if (!(decoded.jti in sessions)) return null   // revoked
      }

      // Fetch up-to-date user record (tier may have changed since token was issued)
      const users = loadUsers()
      const user  = users.find(u => u.id === decoded.sub)
      if (!user) return null

      return toSafeUser(user)
    } catch {
      return null
    }
  }

  // ── getUserById ──────────────────────────────────────────────

  getUserById(id: string): SafeUser | null {
    const user = loadUsers().find(u => u.id === id)
    return user ? toSafeUser(user) : null
  }

  // ── updateTier (called by billingEngine on successful payment) ─

  updateTier(userId: string, tier: UserTier, stripeCustomerId?: string): void {
    const users = loadUsers()
    const idx   = users.findIndex(u => u.id === userId)
    if (idx === -1) throw new Error(`User ${userId} not found`)
    users[idx].tier      = tier
    users[idx].updatedAt = new Date().toISOString()
    if (stripeCustomerId) users[idx].stripeCustomerId = stripeCustomerId
    saveUsers(users)
    console.log(`[DevosAuth] 💎 Tier updated: ${users[idx].email} → ${tier}`)
  }

  // ── findByStripeCustomerId ─────────────────────────────────

  findByStripeCustomerId(customerId: string): User | null {
    return loadUsers().find(u => u.stripeCustomerId === customerId) ?? null
  }

  // ── Middleware factory ────────────────────────────────────────

  /**
   * Express middleware — attaches req.devosUser if JWT valid.
   * Responds 401 if token missing or invalid.
   */
  requireAuth() {
    return (req: any, res: any, next: any): void => {
      const header = (req.headers['authorization'] as string) ?? ''
      const token  = header.startsWith('Bearer ') ? header.slice(7) : ''
      if (!token) {
        res.status(401).json({ error: 'Authentication required' })
        return
      }
      const user = this.validateToken(token)
      if (!user) {
        res.status(401).json({ error: 'Invalid or expired token' })
        return
      }
      req.devosUser = user
      next()
    }
  }

  /**
   * Soft auth — attaches req.devosUser if token present and valid,
   * but does NOT block the request if no token. Used for endpoints
   * that are public but enhanced for authenticated users.
   */
  softAuth() {
    return (req: any, _res: any, next: any): void => {
      const header = (req.headers['authorization'] as string) ?? ''
      const token  = header.startsWith('Bearer ') ? header.slice(7) : ''
      if (token) {
        const user = this.validateToken(token)
        if (user) req.devosUser = user
      }
      next()
    }
  }
}

export const devosAuth = new DevosAuth()
